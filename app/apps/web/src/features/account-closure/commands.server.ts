import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import {
  CLOSURE_LIMITS,
  ClosureError,
  parseCommand,
  type Acknowledgment,
} from "./model";
import {
  actorKey,
  approvedBinding,
  approvedPolicy,
  effectColumns,
  lockOwnSecurityEffect,
  ownLifecycleUser,
  readClosurePlan,
  requireRecent,
  storageReady,
  type EffectRow,
} from "./storage.server";
import { ownSessions } from "./clerk-adapter.server";
import { buildPlan, createPlanEffects } from "./planning.server";
import { preferenceStorageReady } from "./preferences.server";
export async function changeClosure(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseCommand(raw),
    recent = command.operation.kind !== "preferences";
  if (recent) requireRecent(identity);
  if (command.actorKey !== actorKey(identity))
    throw new ClosureError("FORBIDDEN");
  const recovered = await recoverClosure(database, identity, command);
  if (recovered) return recovered;
  // Provider reads only, outside database locks. No effect precedes a durable intent.
  let sessions: Awaited<ReturnType<typeof ownSessions>> | null = null;
  let sessionBindingId: string | null = null;
  if (
    command.operation.kind === "review" ||
    command.operation.kind === "revokeSession"
  ) {
    const binding = await inTransaction(database, async (tx) => {
      await storageReady(tx);
      await authorizeHuman(tx, identity, false);
      return approvedBinding(tx);
    });
    sessionBindingId = binding.id;
    sessions = await ownSessions(identity, binding);
    if (sessions.limited && command.operation.kind === "review")
      throw new ClosureError("QUOTA_EXCEEDED");
  }
  return inTransaction(database, async (tx) => {
    if (recent) await storageReady(tx);
    else await preferenceStorageReady(tx);
    const user = recent
      ? await ownLifecycleUser(tx, identity, true)
      : await authorizeHuman(tx, identity, true);
    await tx.client.query(
      `INSERT INTO treido.account_lifecycle_workspaces(user_id) VALUES($1) ON CONFLICT DO NOTHING`,
      [user.id],
    );
    const workspace = (
      await tx.client.query<{ revision: number }>(
        `SELECT revision FROM treido.account_lifecycle_workspaces WHERE user_id=$1 FOR UPDATE`,
        [user.id],
      )
    ).rows[0];
    const hash = inputHash(command);
    const receipt = (
      await tx.client.query<{ hash: string; acknowledgment: Acknowledgment }>(
        `SELECT input_hash AS hash,acknowledgment FROM treido.account_lifecycle_receipts WHERE user_id=$1 AND request_id=$2`,
        [user.id, command.requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.hash !== hash) throw new ClosureError("CONFLICT");
      if (recent) requireRecent(identity);
      return { acknowledgment: receipt.acknowledgment, replayed: true };
    }
    if (workspace.revision !== command.expectedRevision)
      throw new ClosureError("CONFLICT");
    if (
      user.status !== "active" &&
      !["cancel", "recheck"].includes(command.operation.kind)
    )
      throw new ClosureError("FORBIDDEN");
    const rate = (
      await tx.client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM treido.account_lifecycle_receipts WHERE user_id=$1 AND created_at>clock_timestamp()-interval '1 minute'`,
        [user.id],
      )
    ).rows[0].count;
    if (rate >= CLOSURE_LIMITS.commandsPerMinute)
      throw new ClosureError("QUOTA_EXCEEDED");
    const revision = workspace.revision + 1,
      op = command.operation;
    let resourceId: string = user.id,
      state: string;
    if (op.kind === "preferences") {
      await authorizeHuman(tx, identity, false);
      await tx.client.query(
        `UPDATE treido.account_lifecycle_workspaces SET locale=$2,browse_scope=$3 WHERE user_id=$1`,
        [user.id, op.locale, op.browseScope],
      );
      state = "saved";
    } else if (op.kind === "review") {
      if (!sessionBindingId) throw new ClosureError("BINDING_REQUIRED");
      const policy = await approvedPolicy(tx, op.policyId),
        binding = await approvedBinding(tx, sessionBindingId);
      if (!sessions) throw new ClosureError("NOT_AVAILABLE");
      const plan = await buildPlan(
        tx,
        user.id,
        identity.subject,
        op.closureRequestId,
        policy.id,
        policy.value,
        binding,
        sessions.targets,
      );
      resourceId = plan.id;
      state = "reviewed";
    } else if (op.kind === "confirm") {
      const plan = await readClosurePlan(tx, user.id, op.planId, true);
      if (
        !plan ||
        plan.hash !== op.planHash ||
        inputHash(plan.payload) !== plan.hash
      )
        throw new ClosureError("CONFLICT");
      if (plan.state !== "reviewed") throw new ClosureError("CONFLICT");
      if (plan.expired) throw new ClosureError("EXPIRED");
      requireRecent(identity);
      await tx.client.query(
        `SELECT treido.account_accept_closure($1::uuid,$2::uuid,$3::text,$4::uuid)`,
        [user.id, plan.id, op.planHash, command.requestId],
      );
      await createPlanEffects(tx, plan.id, user.id, plan.payload);
      await tx.client.query(`SELECT treido.account_enqueue_closure($1::uuid)`, [
        plan.id,
      ]);
      resourceId = plan.id;
      state = "accepted";
    } else if (op.kind === "cancel") {
      await tx.client.query(
        `SELECT treido.account_cancel_closure($1::uuid,$2::uuid)`,
        [user.id, op.planId],
      );
      resourceId = op.planId;
      state = "cancelled";
    } else if (op.kind === "recheck") {
      const plan = await readClosurePlan(tx, user.id, op.planId, true);
      if (!plan || !plan.acceptedAt || plan.state === "cancelled")
        throw new ClosureError("NOT_FOUND");
      await tx.client.query(`SELECT treido.account_enqueue_closure($1::uuid)`, [
        plan.id,
      ]);
      resourceId = plan.id;
      state = plan.state;
    } else {
      if (!sessions) throw new ClosureError("NOT_AVAILABLE");
      const target = sessions.targets.find(
        (session) => session.ref === op.sessionRef,
      );
      if (!target) throw new ClosureError("FORBIDDEN");
      if (!sessionBindingId) throw new ClosureError("BINDING_REQUIRED");
      const binding = await approvedBinding(tx, sessionBindingId);
      if (!binding.securityEnabled) throw new ClosureError("BINDING_REQUIRED");
      resourceId = randomUUID();
      state = "prepared";
      const payload = { sessionId: target.id };
      const unresolved = await lockOwnSecurityEffect(
        tx,
        user.id,
        identity.subject,
        inputHash(payload),
      );
      if (unresolved) throw new ClosureError("CONFLICT");
      await tx.client.query(
        `INSERT INTO treido.account_lifecycle_effects(id,user_id,plan_id,binding_id,subject,kind,target,target_hash,operation_key,due_at) VALUES($1,$2,NULL,$3,$4,'session.revoke',$5::jsonb,$6,$7,clock_timestamp())`,
        [
          resourceId,
          user.id,
          binding.id,
          identity.subject,
          JSON.stringify(payload),
          inputHash(payload),
          command.requestId,
        ],
      );
    }
    const acknowledgment: Acknowledgment = {
      revision,
      resourceId,
      kind: op.kind,
      state,
    };
    if (recent) requireRecent(identity);
    await tx.client.query(
      `UPDATE treido.account_lifecycle_workspaces SET revision=$2 WHERE user_id=$1`,
      [user.id, revision],
    );
    await tx.client.query(
      `INSERT INTO treido.account_lifecycle_receipts(user_id,request_id,input_hash,acknowledgment,accepted_revision) VALUES($1,$2,$3,$4::jsonb,$5)`,
      [
        user.id,
        command.requestId,
        hash,
        JSON.stringify(acknowledgment),
        revision,
      ],
    );
    return { acknowledgment, replayed: false };
  });
}
/** Own exact original request only; recovery never rebuilds a plan or repeats a provider POST. */
export function recoverClosure(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseCommand(raw),
    recent = command.operation.kind !== "preferences";
  if (recent) requireRecent(identity);
  if (command.actorKey !== actorKey(identity))
    throw new ClosureError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    if (recent) await storageReady(tx);
    else await preferenceStorageReady(tx);
    let user;
    try {
      user = recent
        ? await ownLifecycleUser(tx, identity, false)
        : await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (
        !recent &&
        error instanceof Error &&
        "code" in error &&
        error.code === "NOT_FOUND"
      )
        return null;
      throw error;
    }
    const receipt = (
      await tx.client.query<{ hash: string; acknowledgment: Acknowledgment }>(
        `SELECT input_hash AS hash,acknowledgment FROM treido.account_lifecycle_receipts WHERE user_id=$1 AND request_id=$2`,
        [user.id, command.requestId],
      )
    ).rows[0];
    if (receipt && receipt.hash !== inputHash(command))
      throw new ClosureError("CONFLICT");
    if (recent) requireRecent(identity);
    return receipt
      ? { acknowledgment: receipt.acknowledgment, replayed: true }
      : null;
  });
}
export function ownSecurityEffect(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  id: string,
) {
  requireRecent(identity);
  return inTransaction(database, async (tx) => {
    await storageReady(tx);
    const user = await authorizeHuman(tx, identity, false);
    const row = (
      await tx.client.query<EffectRow>(
        `SELECT ${effectColumns} FROM treido.account_lifecycle_effects WHERE user_id=$1 AND id=$2 AND plan_id IS NULL AND kind='session.revoke'`,
        [user.id, id],
      )
    ).rows[0];
    if (!row || row.subject !== identity.subject)
      throw new ClosureError("FORBIDDEN");
    return row;
  });
}
