import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  checkAssistantBudget,
  requireAssistantActor,
  requireAssistantStorage,
} from "../assistant-tools/storage.server";
import {
  parseInputCommand,
  preserveConstraints,
  type InputChange,
  type InputCommand,
} from "./model";
import { runtimePolicy, requirePolicy } from "./policy.server";
import {
  requireInputStorage,
  requireInputLifecycle,
  inputWorkspace,
  ownedInputMedia,
  ownedInputRun,
  requireInputConsent,
  reserveInputMoney,
  lockInputSpending,
} from "./storage.server";
import {
  inputMediaStorage,
  registerInputObject,
  claimMediaValidation,
  completeInputMedia,
} from "./media.server";
import { gatewayAdapter } from "./provider.server";
import { performAssistantInput } from "./execution.server";
import { inputCatalogue } from "./catalogue.server";
import { MEDIA_RETENTION } from "../../server/media/retention.server";

async function cancelWorkspaceInputs(
  tx: SellerTransaction,
  userId: string,
  inputMode: InputCommand["mode"],
  runId: string | null,
  assetId: string | null,
) {
  await lockInputSpending(tx);
  if (runId) {
    await ownedInputRun(tx, userId, inputMode, runId, true);
    await tx.client.query(
      "UPDATE treido.assistant_runs SET state='cancelled',input_json=NULL,proposal=NULL,accepted_criteria=NULL WHERE id=$1 AND user_id=$2",
      [runId, userId],
    );
    await tx.client.query(
      "UPDATE treido.assistant_run_reservations b SET status=CASE WHEN b.status IN ('reserved','calling') AND r.emission_started_at IS NULL AND r.steps=0 THEN 'released' WHEN b.status IN ('calling','unknown') THEN 'unknown' ELSE b.status END FROM treido.assistant_runs r WHERE b.run_id=r.id AND b.run_id=$1 AND b.user_id=$2",
      [runId, userId],
    );
  }
  if (assetId)
    await tx.client.query(
      "UPDATE treido.assistant_media_assets SET state='cancelled' WHERE id=$1 AND user_id=$2 AND state<>'expired'",
      [assetId, userId],
    );
}
export async function changeAssistantInput(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
  freshIdentity: () => Promise<VerifiedIdentity>,
  signal?: AbortSignal,
): Promise<InputChange> {
  const command = parseInputCommand(raw);
  requireAssistantActor(identity, command.actorKey);
  const result = await inTransaction(database, async (tx) => {
    await requireInputStorage(tx);
    await requireAssistantStorage(tx);
    const op = command.operation;
    const user = await authorizeHuman(tx, identity, true);
    await tx.client.query(
      "INSERT INTO treido.buyer_assistant_workspaces(user_id,mode) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [user.id, command.mode],
    );
    const ws = await inputWorkspace(tx, user.id, command.mode, true);
    if (!ws) throw new SellerError("NOT_AVAILABLE");
    const hash = inputHash(command),
      prior = (
        await tx.client.query<{
          hash: string;
          revision: number;
          runId: string | null;
          assetId: string | null;
        }>(
          'SELECT input_hash AS hash,accepted_revision AS revision,run_id AS "runId",asset_id AS "assetId" FROM treido.buyer_assistant_receipts WHERE user_id=$1 AND request_id=$2',
          [user.id, command.requestId],
        )
      ).rows[0];
    if (prior) {
      if (prior.hash !== hash) throw new SellerError("CONFLICT");
      return {
        ack: {
          revision: prior.revision,
          runId: prior.runId,
          assetId: prior.assetId,
          replayed: true,
        },
        effect: null,
      };
    }
    const policy =
      "policyId" in op && !(op.kind === "consent" && !op.granted)
        ? requirePolicy(
            await runtimePolicy(tx, op.policyId),
            op.kind === "prepare" ? command.mode : undefined,
          )
        : null;
    if (ws.revision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    await checkAssistantBudget(tx, user.id, op.kind === "prepare");
    let runId = ws.runId,
      assetId = ws.assetId,
      effect: "complete" | "execute" | null = null;
    if (op.kind === "consent") {
      if (op.granted) requirePolicy(policy);
      if (op.granted)
        await tx.client.query(
          `INSERT INTO treido.buyer_assistant_consents(user_id,mode,policy_id,granted,expires_at) VALUES($1,$2,$3,true,clock_timestamp()+make_interval(secs=>$4)) ON CONFLICT(user_id,mode) DO UPDATE SET policy_id=excluded.policy_id,granted=true,expires_at=excluded.expires_at,revision=treido.buyer_assistant_consents.revision+1,updated_at=clock_timestamp()`,
          [user.id, command.mode, op.policyId, policy!.config.consentSeconds],
        );
      else
        await tx.client.query(
          "UPDATE treido.buyer_assistant_consents SET granted=false,expires_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() WHERE user_id=$1 AND mode=$2",
          [user.id, command.mode],
        );
      if (!op.granted) {
        await cancelWorkspaceInputs(tx, user.id, command.mode, runId, assetId);
        runId = null;
        assetId = null;
      }
    } else if (op.kind === "stage") {
      await requireInputLifecycle(tx);
      await requireInputConsent(tx, user.id, command.mode, policy!.id);
      if (assetId || runId) throw new SellerError("CONFLICT");
      const count = (
        await tx.client.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM treido.assistant_media_assets WHERE user_id=$1 AND created_at>clock_timestamp()-interval '24 hours'",
          [user.id],
        )
      ).rows[0];
      if (!count || count.count >= 20) throw new SellerError("QUOTA_EXCEEDED");
      const storage = inputMediaStorage(policy!),
        id = randomUUID(),
        key = `${storage.prefix}staging/assistant/${user.id}/${id}`;
      const row = (
        await tx.client.query<{ expiresAt: Date; writeUntil: Date }>(
          `WITH lifetime AS MATERIALIZED (SELECT clock_timestamp()+make_interval(secs=>$11) AS expires_at)
          INSERT INTO treido.assistant_media_assets(id,user_id,mode,policy_id,input_hash,expected_bytes,content_type,expected_checksum,storage_scope,staging_key,expires_at,write_until)
          SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,lifetime.expires_at,lifetime.expires_at+make_interval(secs=>$12) FROM lifetime
          RETURNING expires_at AS "expiresAt",write_until AS "writeUntil"`,
          [
            id,
            user.id,
            command.mode,
            policy!.id,
            inputHash(op),
            op.bytes,
            op.contentType,
            op.checksum,
            storage.scope,
            key,
            policy!.config.mediaSeconds,
            MEDIA_RETENTION.writeSeconds,
          ],
        )
      ).rows[0];
      if (!row) throw new SellerError("NOT_AVAILABLE");
      await registerInputObject(
        tx,
        {
          id,
          userId: user.id,
          scope: storage.scope,
          expiresAt: row.expiresAt,
          writeUntil: row.writeUntil,
        },
        key,
        "staging",
      );
      assetId = id;
    } else if (op.kind === "complete") {
      if (assetId !== op.assetId) throw new SellerError("CONFLICT");
      await claimMediaValidation(tx, user.id, command.mode, op.assetId);
      effect = "complete";
    } else if (op.kind === "prepare") {
      await requireInputLifecycle(tx);
      await requireInputConsent(tx, user.id, command.mode, policy!.id);
      gatewayAdapter(policy!);
      if (runId || assetId !== op.mediaId) throw new SellerError("CONFLICT");
      if (op.mediaId) {
        const media = await ownedInputMedia(tx, user.id, op.mediaId, true);
        if (
          media.expired ||
          media.state !== "ready" ||
          media.mode !== command.mode ||
          media.policyId !== policy!.id
        )
          throw new SellerError("NOT_AVAILABLE");
        inputMediaStorage(policy!);
      }
      await reserveInputMoney(tx, user.id, policy!);
      runId = randomUUID();
      await tx.client.query(
        `INSERT INTO treido.assistant_runs(id,user_id,mode,policy_id,media_id,input_hash,input_json,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,clock_timestamp()+make_interval(secs=>$8))`,
        [
          runId,
          user.id,
          command.mode,
          policy!.id,
          op.mediaId,
          inputHash(op),
          JSON.stringify({ criteria: op.criteria, prompt: op.prompt }),
          policy!.config.inputSeconds,
        ],
      );
      await tx.client.query(
        "INSERT INTO treido.assistant_run_reservations(run_id,user_id,application_id,environment,reserved_minor,currency) VALUES($1,$2,$3,$4,$5,$6)",
        [
          runId,
          user.id,
          policy!.applicationId,
          policy!.environment,
          policy!.config.runMinor,
          policy!.config.budgetCurrency,
        ],
      );
    } else if (op.kind === "execute") {
      await requireInputLifecycle(tx);
      if (runId !== op.runId) throw new SellerError("CONFLICT");
      const run = await ownedInputRun(
        tx,
        user.id,
        command.mode,
        op.runId,
        true,
      );
      const current = requirePolicy(
        await runtimePolicy(tx, run.policyId),
        command.mode,
      );
      await requireInputConsent(tx, user.id, command.mode, current.id);
      gatewayAdapter(current);
      if (run.expired || run.state !== "reserved" || run.steps !== 0)
        throw new SellerError("CONFLICT");
      await tx.client.query(
        "UPDATE treido.assistant_runs SET state='calling' WHERE id=$1",
        [run.id],
      );
      await tx.client.query(
        "UPDATE treido.assistant_run_reservations SET status='calling' WHERE run_id=$1 AND status='reserved'",
        [run.id],
      );
      effect = "execute";
    } else if (op.kind === "accept") {
      if (runId !== op.runId) throw new SellerError("CONFLICT");
      const run = await ownedInputRun(
        tx,
        user.id,
        command.mode,
        op.runId,
        true,
      );
      const current = requirePolicy(await runtimePolicy(tx, run.policyId));
      await requireInputConsent(tx, user.id, command.mode, current.id);
      if (
        run.expired ||
        run.state !== "proposed" ||
        !run.input ||
        !run.proposal
      )
        throw new SellerError("CONFLICT");
      const canonical = preserveConstraints(run.input.criteria, op.criteria);
      await inputCatalogue(tx, user.id, canonical);
      await tx.client.query(
        "UPDATE treido.assistant_runs SET state='accepted',accepted_criteria=$2 WHERE id=$1",
        [run.id, canonical],
      );
    } else {
      if (runId !== op.runId || assetId !== op.assetId)
        throw new SellerError("CONFLICT");
      await cancelWorkspaceInputs(tx, user.id, command.mode, runId, assetId);
      runId = null;
      assetId = null;
    }
    const revision = ws.revision + 1;
    await tx.client.query(
      "UPDATE treido.buyer_assistant_workspaces SET revision=$3,current_run_id=$4,current_asset_id=$5 WHERE user_id=$1 AND mode=$2",
      [user.id, command.mode, revision, runId, assetId],
    );
    await tx.client.query(
      "INSERT INTO treido.buyer_assistant_receipts(user_id,request_id,input_hash,operation,accepted_revision,run_id,asset_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [user.id, command.requestId, hash, op.kind, revision, runId, assetId],
    );
    return { ack: { revision, runId, assetId, replayed: false }, effect };
  });
  if (result.effect === "complete" && result.ack.assetId)
    await completeInputMedia(
      database,
      identity,
      result.ack.assetId,
      freshIdentity,
    );
  if (result.effect === "execute" && result.ack.runId)
    await performAssistantInput(
      database,
      identity,
      result.ack.runId,
      command.mode,
      freshIdentity,
      signal,
    );
  return result.ack;
}
