import "server-only";
import { createHmac } from "node:crypto";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { SellerError } from "../sellers/errors";
import type { Criteria, SearchStatus } from "./model";
export function searchActorKey(identity: VerifiedIdentity) {
  return createHmac("sha256", publicDiscoveryKey())
    .update("buyer-saved-search-actor-v1:" + identity.subject)
    .digest("hex");
}
export async function searchStorageReady(tx: {
  client: Pick<import("pg").PoolClient, "query">;
}) {
  const row = (
    await tx.client.query<{
      ready: boolean;
    }>(`SELECT to_regclass('treido.buyer_saved_search_workspaces') IS NOT NULL
    AND to_regclass('treido.buyer_saved_searches') IS NOT NULL AND to_regclass('treido.buyer_saved_search_versions') IS NOT NULL
    AND to_regclass('treido.buyer_saved_search_receipts') IS NOT NULL AND to_regclass('treido.buyer_saved_search_runs') IS NOT NULL
    AND to_regclass('treido.buyer_search_observations') IS NOT NULL AND to_regclass('treido.buyer_search_notifications') IS NOT NULL AS ready`)
  ).rows[0];
  return !!row?.ready;
}
export async function requireSearchStorage(
  tx: Pick<SellerTransaction, "client">,
) {
  if (!(await searchStorageReady(tx))) throw new SellerError("NOT_AVAILABLE");
}
export type SearchRow = {
  id: string;
  userId: string;
  name: string | null;
  status: SearchStatus;
  version: number;
  generation: number;
  frequency: 60 | 1440;
  consentAt: Date | null;
  lastCheckAt: Date | null;
  criteria: Criteria;
};
export const searchColumns = `s.id,s.user_id AS "userId",s.name,s.status,s.criteria_version AS version,s.consent_generation AS generation,
 s.frequency_minutes AS frequency,s.consent_at AS "consentAt",s.last_check_at AS "lastCheckAt",v.criteria`;
export const searchFrom = `FROM treido.buyer_saved_searches s LEFT JOIN treido.buyer_saved_search_versions v
 ON v.user_id=s.user_id AND v.search_id=s.id AND v.version=s.criteria_version`;
