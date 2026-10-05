import "server-only";
import { createHmac } from "node:crypto";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { SellerError } from "../sellers/errors";
import { readToolFacts } from "../shopping-tools/catalogue.server";
import { ASSISTANT_LIMITS } from "./limits";
export function assistantActorKey(identity: VerifiedIdentity) {
  return createHmac("sha256", publicDiscoveryKey())
    .update("treido-f22-actor-v1:" + identity.subject)
    .digest("hex");
}
export function requireAssistantActor(identity: VerifiedIdentity, key: string) {
  if (key !== assistantActorKey(identity))
    throw new SellerError("UNAUTHENTICATED");
}
/** Check before any identity provisioning; missing storage stays unavailable. */
export async function requireAssistantStorage(
  tx: Pick<SellerTransaction, "client">,
) {
  const row = (
    await tx.client.query<{ ready: boolean }>(`SELECT
    to_regclass('treido.buyer_compatibility_workspaces') IS NOT NULL AND
    to_regclass('treido.buyer_compatibility_observations') IS NOT NULL AND
    to_regclass('treido.buyer_compatibility_receipts') IS NOT NULL AND
    to_regclass('treido.seller_helper_workspaces') IS NOT NULL AND
    to_regclass('treido.seller_helper_proposals') IS NOT NULL AND
    to_regclass('treido.seller_helper_acceptance_intents') IS NOT NULL AND
    to_regclass('treido.seller_helper_receipts') IS NOT NULL AS ready`)
  ).rows[0];
  if (!row?.ready) throw new SellerError("NOT_AVAILABLE");
}
/** Both sides of F22 share a human budget under the already-held exclusive
 * human lock. Seller switching cannot multiply runs. No model/provider is called. */
export async function checkAssistantBudget(
  tx: SellerTransaction,
  userId: string,
  run: boolean,
) {
  // The additive Gift relation is optional for existing F22 commands. Gift
  // itself checks all its storage before authorizing/provisioning a human.
  const available = (
    await tx.client.query<{ ready: boolean; inputReady: boolean }>(
      "SELECT to_regclass('treido.buyer_gift_receipts') IS NOT NULL AS ready, to_regclass('treido.buyer_assistant_receipts') IS NOT NULL AND to_regclass('treido.assistant_run_reservations') IS NOT NULL AS \"inputReady\"",
    )
  ).rows[0];
  const giftReady = available?.ready;
  const giftCommands = giftReady
    ? "UNION ALL SELECT created_at,operation IN ('find','page','refresh') AS run FROM treido.buyer_gift_receipts WHERE user_id=$1"
    : "";
  const inputReady = available?.inputReady;
  // One reservation is one daily run; its command receipt counts only rate.
  // Pending/possibly emitted calls keep their slot even across a day boundary.
  const inputCommands = inputReady
    ? "UNION ALL SELECT created_at,false AS run FROM treido.buyer_assistant_receipts WHERE user_id=$1"
    : "";
  const reservedRuns = inputReady
    ? "+ (SELECT count(*)::int FROM treido.assistant_run_reservations WHERE user_id=$1 AND (created_at>clock_timestamp()-interval '24 hours' OR status IN ('reserved','calling','unknown')))"
    : "";
  const counts = (
    await tx.client.query<{ recent: number; runs: number }>(
      `WITH commands AS (
    SELECT created_at,operation IN ('check','refresh') AS run FROM treido.buyer_compatibility_receipts WHERE user_id=$1
    UNION ALL SELECT created_at,operation='prepare' AS run FROM treido.seller_helper_receipts WHERE user_id=$1
    ${giftCommands}
    ${inputCommands}
  ) SELECT count(*) FILTER(WHERE created_at>clock_timestamp()-interval '1 minute')::int AS recent,
    count(*) FILTER(WHERE run AND created_at>clock_timestamp()-interval '24 hours')::int ${reservedRuns} AS runs FROM commands
    WHERE created_at>clock_timestamp()-interval '24 hours'`,
      [userId],
    )
  ).rows[0];
  if (
    !counts ||
    counts.recent >= ASSISTANT_LIMITS.commandsPerMinute ||
    (run && counts.runs >= ASSISTANT_LIMITS.runsPerDay)
  )
    throw new SellerError("QUOTA_EXCEEDED");
}
export async function readAssistantFacts(
  tx: Pick<SellerTransaction, "client">,
  userId: string | null,
  ids: string[],
) {
  const facts = await readToolFacts(tx, ids);
  if (!userId || !facts.size) return facts;
  const denied = (
    await tx.client.query<{ sellerId: string }>(
      `SELECT seller_id AS "sellerId" FROM treido.contact_preferences
    WHERE buyer_id=$1 AND seller_id=ANY($2::uuid[]) AND (buyer_blocked OR seller_blocked)`,
      [
        userId,
        [...new Set([...facts.values()].map((fact) => fact.card.seller.id))],
      ],
    )
  ).rows;
  const sellers = new Set(denied.map((row) => row.sellerId));
  for (const [id, fact] of facts)
    if (sellers.has(fact.card.seller.id)) facts.delete(id);
  return facts;
}
