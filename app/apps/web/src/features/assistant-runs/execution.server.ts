import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import type { InputMode } from "./model";
import {
  ownedInputRun,
  inputWorkspace,
  requireInputConsent,
  lockInputSpending,
  requireInputStorage,
  requireInputLifecycle,
} from "./storage.server";
import {
  runtimePolicy,
  requirePolicy,
  parsePolicyConfig,
} from "./policy.server";
import { gatewayAdapter, verifiedUsage } from "./provider.server";
import { readOwnedInputBytes } from "./media.server";
import {
  authorizeAssistantMaintenance,
  type AssistantMaintenanceContext,
} from "./maintenance-authority.server";

/** Invoked only by the original deliberate execute command. Durable emission
 * marker survives every failure, cancellation and retry; there is no POST repair. */
export async function performAssistantInput(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  runId: string,
  inputMode: InputMode,
  freshIdentity: () => Promise<VerifiedIdentity>,
  signal?: AbortSignal,
) {
  let authorizedUserId: string | null = null;
  let claimedEmission = false;
  try {
    const context = await inTransaction(database, async (tx) => {
      await requireInputStorage(tx);
      await requireInputLifecycle(tx);
      const user = await authorizeHuman(tx, identity, false),
        run = await ownedInputRun(tx, user.id, inputMode, runId);
      if (
        run.expired ||
        run.state !== "calling" ||
        !run.input ||
        run.steps !== 0
      )
        throw new SellerError("CONFLICT");
      const policy = requirePolicy(
        await runtimePolicy(tx, run.policyId),
        inputMode,
      );
      await requireInputConsent(tx, user.id, inputMode, policy.id);
      return { run, policy, userId: user.id };
    });
    authorizedUserId = context.userId;
    signal?.throwIfAborted();
    const media = context.run.mediaId
      ? await readOwnedInputBytes(database, identity, context.run.mediaId)
      : undefined;
    const fresh = await freshIdentity();
    if (fresh.subject !== identity.subject)
      throw new SellerError("UNAUTHENTICATED");
    await inTransaction(database, async (tx) => {
      const user = await authorizeHuman(tx, fresh, true),
        ws = await inputWorkspace(tx, user.id, inputMode, true),
        run = await ownedInputRun(tx, user.id, inputMode, runId, true);
      await requireInputLifecycle(tx);
      requirePolicy(await runtimePolicy(tx, run.policyId), inputMode);
      await requireInputConsent(tx, user.id, inputMode, run.policyId);
      if (ws?.runId !== runId || run.expired || run.state !== "calling")
        throw new SellerError("CONFLICT");
      signal?.throwIfAborted();
      const claimed = await tx.client.query(
        "UPDATE treido.assistant_runs SET emission_started_at=clock_timestamp(),steps=1 WHERE id=$1 AND emission_started_at IS NULL AND steps=0 RETURNING id",
        [runId],
      );
      if (claimed.rowCount !== 1) throw new SellerError("CONFLICT");
    });
    claimedEmission = true;
    const result = await gatewayAdapter(context.policy).interpret(
      {
        mode: inputMode,
        criteria: context.run.input!.criteria,
        prompt: context.run.input!.prompt,
        ...media,
      },
      async (id) => {
        // Minimal external correlation survives cancellation/restriction, but
        // carries no private response or newly granted account authority.
        await inTransaction(database, async (tx) => {
          await tx.client.query(
            "UPDATE treido.assistant_runs SET provider_id=$2 WHERE id=$1 AND user_id=$3 AND emission_started_at IS NOT NULL AND provider_id IS NULL",
            [runId, id, context.userId],
          );
        });
      },
      signal,
    );
    const current = await freshIdentity();
    if (current.subject !== identity.subject)
      throw new SellerError("UNAUTHENTICATED");
    await inTransaction(database, async (tx) => {
      const user = await authorizeHuman(tx, current, true),
        ws = await inputWorkspace(tx, user.id, inputMode, true),
        run = await ownedInputRun(tx, user.id, inputMode, runId, true);
      requirePolicy(await runtimePolicy(tx, run.policyId), inputMode);
      await requireInputConsent(tx, user.id, inputMode, run.policyId);
      if (
        ws?.runId !== runId ||
        run.expired ||
        run.state !== "calling" ||
        !run.input
      )
        throw new SellerError("CONFLICT");
      await tx.client.query(
        "UPDATE treido.assistant_runs SET state='proposed',proposal=$2::jsonb WHERE id=$1",
        [runId, JSON.stringify(result.proposal)],
      );
      await tx.client.query(
        "UPDATE treido.assistant_run_reservations SET status='unknown' WHERE run_id=$1 AND status='calling'",
        [runId],
      );
      await tx.client.query(
        "UPDATE treido.buyer_assistant_workspaces SET revision=revision+1 WHERE user_id=$1 AND mode=$2",
        [user.id, inputMode],
      );
    });
  } catch (error) {
    // A failed initial owner/mode/consent check grants no recovery authority.
    if (!authorizedUserId) throw error;
    try {
      await inTransaction(database, async (tx) => {
        const owner = (
          await tx.client.query<{ id: string }>(
            "SELECT u.id FROM treido.users u JOIN treido.assistant_runs r ON r.user_id=u.id WHERE r.id=$1 AND r.user_id=$2 AND r.mode=$3 FOR UPDATE OF u",
            [runId, authorizedUserId, inputMode],
          )
        ).rows[0];
        if (!owner) throw new SellerError("NOT_FOUND");
        await lockInputSpending(tx);
        await tx.client.query(
          "UPDATE treido.assistant_runs SET state=CASE WHEN emission_started_at IS NULL AND steps=0 THEN 'failed' ELSE 'unknown' END WHERE id=$1 AND user_id=$2 AND mode=$3 AND state='calling' AND ($4::boolean OR (emission_started_at IS NULL AND steps=0))",
          [runId, authorizedUserId, inputMode, claimedEmission],
        );
        await tx.client.query(
          "UPDATE treido.assistant_run_reservations b SET status=CASE WHEN r.emission_started_at IS NULL AND r.steps=0 AND r.state IN ('failed','cancelled') THEN 'released' ELSE 'unknown' END FROM treido.assistant_runs r WHERE b.run_id=r.id AND b.run_id=$1 AND b.user_id=$2 AND r.user_id=$2 AND r.mode=$3 AND b.status='calling' AND ($4::boolean OR (r.emission_started_at IS NULL AND r.steps=0 AND r.state IN ('failed','cancelled')))",
          [runId, authorizedUserId, inputMode, claimedEmission],
        );
      });
    } catch {
      console.error("Treido assistant emission recovery remains pending.");
    }
    throw error;
  }
}
/** Service-only GET reconciliation for an exact captured original generation.
 * No guessed ID, aggregated balance, transcription ID or repeated inference. */
export async function reconcileAssistantUsage(
  database: SellerDatabase,
  runId: string,
  job: AssistantMaintenanceContext,
) {
  if (job.resourceId !== runId) throw new SellerError("FORBIDDEN");
  const context = await inTransaction(database, async (tx) => {
    await authorizeAssistantMaintenance(tx, job, "assistant.usage");
    await requireInputStorage(tx);
    const row = (
      await tx.client.query<{
        userId: string;
        mode: InputMode;
        policyId: string;
        providerId: string | null;
      }>(
        'SELECT user_id AS "userId",mode,policy_id AS "policyId",provider_id AS "providerId" FROM treido.assistant_runs WHERE id=$1',
        [runId],
      )
    ).rows[0];
    if (!row || !row.providerId || row.mode === "voice") return null;
    const policy = requirePolicy(await runtimePolicy(tx));
    const original = (
      await tx.client.query<{ config: unknown }>(
        "SELECT config FROM treido.assistant_runtime_policies WHERE id=$1 AND application_id=$2 AND environment=$3 AND approved_at<=clock_timestamp()",
        [row.policyId, policy.applicationId, policy.environment],
      )
    ).rows[0];
    if (!original) throw new SellerError("NOT_AVAILABLE");
    const terms = parsePolicyConfig(original.config);
    // Reconciliation uses a CURRENT qualified account credential while keeping
    // the immutable original model/account terms. Revoking optional processing
    // never erases an already accepted charge or requires its old credential.
    if (
      terms.gatewayAccountId !== policy.config.gatewayAccountId ||
      terms.gatewayProjectId !== policy.config.gatewayProjectId ||
      terms.models[row.mode] !== policy.config.models[row.mode]
    )
      throw new SellerError("NOT_AVAILABLE");
    return { ...row, policy };
  });
  if (!context) return { pending: true };
  const usage = await gatewayAdapter(context.policy).lookupUsage(
    context.providerId!,
    context.mode,
  );
  if (!usage || !verifiedUsage(usage)) return { pending: true };
  await inTransaction(database, async (tx) => {
    await authorizeAssistantMaintenance(tx, job, "assistant.usage");
    requirePolicy(await runtimePolicy(tx, context.policy.id));
    const owner = await tx.client.query(
      "SELECT id FROM treido.users WHERE id=$1 FOR UPDATE",
      [context.userId],
    );
    if (owner.rowCount !== 1) throw new SellerError("NOT_FOUND");
    await lockInputSpending(tx);
    const row = (
      await tx.client.query<{ providerId: string; policyId: string }>(
        'SELECT provider_id AS "providerId",policy_id AS "policyId" FROM treido.assistant_runs WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [runId, context.userId],
      )
    ).rows[0];
    if (
      !row ||
      row.providerId !== usage.id ||
      row.policyId !== context.policyId
    )
      throw new SellerError("CONFLICT");
    await tx.client.query(
      "INSERT INTO treido.assistant_usage_evidence(run_id,provider_id,actual_minor,currency,proof_hash) VALUES($1,$2,$3,'USD',$4) ON CONFLICT DO NOTHING",
      [runId, usage.id, usage.minor, usage.proofHash],
    );
    const proof = (
      await tx.client.query<{ minor: number; id: string }>(
        "SELECT actual_minor AS minor,provider_id AS id FROM treido.assistant_usage_evidence WHERE run_id=$1",
        [runId],
      )
    ).rows[0];
    if (!proof || proof.id !== usage.id || proof.minor !== usage.minor)
      throw new SellerError("CONFLICT");
    await tx.client.query(
      "UPDATE treido.assistant_run_reservations SET status='settled',actual_minor=$2 WHERE run_id=$1 AND status IN ('calling','unknown')",
      [runId, usage.minor],
    );
  });
  return { pending: false };
}
