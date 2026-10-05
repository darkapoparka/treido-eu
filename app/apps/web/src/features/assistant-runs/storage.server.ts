import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { SellerError } from "../sellers/errors";
import type { InputMode, Interpretation, RunState } from "./model";
import type { RuntimePolicy } from "./policy.server";
import { requireJobBindings } from "../../server/jobs/config.server";
import { JobError } from "../../server/jobs/model";
export async function inputLifecycleReady(
  tx: Pick<SellerTransaction, "client">,
) {
  const ready = (
    await tx.client.query<{ ready: boolean }>(
      "SELECT to_regprocedure('treido.assistant_enqueue_maintenance(integer)') IS NOT NULL AS ready",
    )
  ).rows[0]?.ready;
  if (!ready) return false;
  try {
    requireJobBindings();
    return true;
  } catch (error) {
    if (error instanceof JobError && error.code === "NOT_AVAILABLE")
      return false;
    throw error;
  }
}
export async function requireInputLifecycle(
  tx: Pick<SellerTransaction, "client">,
) {
  if (!(await inputLifecycleReady(tx))) throw new SellerError("NOT_AVAILABLE");
}
export type InputWorkspace = {
  revision: number;
  runId: string | null;
  assetId: string | null;
};
export type InputRun = {
  id: string;
  userId: string;
  mode: InputMode;
  policyId: string;
  mediaId: string | null;
  state: RunState;
  input: { criteria: string; prompt: string } | null;
  proposal: Interpretation | null;
  accepted: string | null;
  providerId: string | null;
  steps: number;
  expiresAt: Date;
  expired: boolean;
};
export type InputMedia = {
  id: string;
  userId: string;
  mode: "photo" | "voice";
  policyId: string;
  bytes: number;
  contentType: string;
  checksum: string;
  scope: string;
  staging: string;
  immutable: string | null;
  ready: string | null;
  readyChecksum: string | null;
  readyBytes: number | null;
  state: string;
  expiresAt: Date;
  writeUntil: Date;
  expired: boolean;
};
export async function requireInputStorage(
  tx: Pick<SellerTransaction, "client">,
) {
  const row = (
    await tx.client.query<{
      ready: boolean;
    }>(`SELECT to_regclass('treido.assistant_runtime_policies') IS NOT NULL
    AND to_regclass('treido.buyer_assistant_workspaces') IS NOT NULL AND to_regclass('treido.buyer_assistant_consents') IS NOT NULL
    AND to_regclass('treido.assistant_runs') IS NOT NULL AND to_regclass('treido.assistant_run_reservations') IS NOT NULL
    AND to_regclass('treido.buyer_assistant_receipts') IS NOT NULL AND to_regclass('treido.assistant_media_assets') IS NOT NULL
    AND to_regclass('treido.assistant_media_objects') IS NOT NULL AND to_regclass('treido.assistant_usage_evidence') IS NOT NULL AS ready`)
  ).rows[0];
  if (!row?.ready) throw new SellerError("NOT_AVAILABLE");
}
export async function inputWorkspace(
  tx: SellerTransaction,
  userId: string,
  inputMode: InputMode,
  lock = false,
) {
  return (
    await tx.client.query<InputWorkspace>(
      `SELECT revision,current_run_id AS "runId",current_asset_id AS "assetId" FROM treido.buyer_assistant_workspaces WHERE user_id=$1 AND mode=$2 ${lock ? "FOR UPDATE" : ""}`,
      [userId, inputMode],
    )
  ).rows[0];
}
export async function ownedInputRun(
  tx: SellerTransaction,
  userId: string,
  inputMode: InputMode,
  id: string,
  lock = false,
) {
  const row = (
    await tx.client.query<InputRun>(
      `SELECT id,user_id AS "userId",mode,policy_id AS "policyId",media_id AS "mediaId",state,input_json AS input,proposal,accepted_criteria AS accepted,provider_id AS "providerId",steps,expires_at AS "expiresAt",expires_at<=clock_timestamp() AS expired FROM treido.assistant_runs WHERE id=$1 AND user_id=$2 AND mode=$3 ${lock ? "FOR UPDATE" : ""}`,
      [id, userId, inputMode],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  return row;
}
export async function ownedInputMedia(
  tx: SellerTransaction,
  userId: string,
  id: string,
  lock = false,
) {
  const row = (
    await tx.client.query<InputMedia>(
      `SELECT id,user_id AS "userId",mode,policy_id AS "policyId",expected_bytes AS bytes,content_type AS "contentType",expected_checksum AS checksum,storage_scope AS scope,staging_key AS staging,immutable_key AS immutable,ready_key AS ready,ready_checksum AS "readyChecksum",ready_bytes AS "readyBytes",state,expires_at AS "expiresAt",write_until AS "writeUntil",expires_at<=clock_timestamp() AS expired FROM treido.assistant_media_assets WHERE id=$1 AND user_id=$2 ${lock ? "FOR UPDATE" : ""}`,
      [id, userId],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  return row;
}
export async function requireInputConsent(
  tx: SellerTransaction,
  userId: string,
  inputMode: InputMode,
  policyId: string,
) {
  const row = (
    await tx.client.query<{ allowed: boolean }>(
      `SELECT granted AND expires_at>clock_timestamp() AND policy_id=$3 AS allowed FROM treido.buyer_assistant_consents WHERE user_id=$1 AND mode=$2 FOR SHARE`,
      [userId, inputMode, policyId],
    )
  ).rows[0];
  if (!row?.allowed) throw new SellerError("FORBIDDEN");
}
export async function lockInputSpending(tx: SellerTransaction) {
  const binding = requireBackendBindings();
  await tx.client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [
      "treido-assistant-spending-v1:" +
        binding.identity.applicationId +
        ":" +
        binding.environment,
    ],
  );
}
/** Same human lock as F22/Gift precedes this platform lock. All policy versions
 * share costs; unknown and pending reservations are never aged out as zero. */
export async function reserveInputMoney(
  tx: SellerTransaction,
  userId: string,
  policy: RuntimePolicy,
) {
  await lockInputSpending(tx);
  const row = (
    await tx.client.query<{ human: string; platform: string }>(
      `SELECT
    coalesce(sum(CASE WHEN user_id=$1 THEN CASE WHEN status='settled' THEN actual_minor ELSE reserved_minor END ELSE 0 END),0)::text AS human,
    coalesce(sum(CASE WHEN status='settled' THEN actual_minor ELSE reserved_minor END),0)::text AS platform
    FROM treido.assistant_run_reservations WHERE application_id=$2 AND environment=$3 AND currency=$4
    AND (status IN ('reserved','calling','unknown') OR (status='settled' AND created_at>clock_timestamp()-interval '24 hours'))`,
      [
        userId,
        policy.applicationId,
        policy.environment,
        policy.config.budgetCurrency,
      ],
    )
  ).rows[0];
  const human = Number(row?.human),
    platform = Number(row?.platform),
    amount = policy.config.runMinor;
  if (
    !Number.isSafeInteger(human) ||
    !Number.isSafeInteger(platform) ||
    human < 0 ||
    platform < 0
  )
    throw new SellerError("NOT_AVAILABLE");
  if (
    human + amount > policy.config.humanDailyMinor ||
    platform + amount > policy.config.platformDailyMinor
  )
    throw new SellerError("QUOTA_EXCEEDED");
}
