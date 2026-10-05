import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "./errors";
import { readSellerEntitlements } from "../seller-billing/storage.server";
import { FREE_DRAFT_LIMITS } from "../selling/draft-quota";
/** Version-one Free catalogue entitlements from billing.md. Paid grants require T13. */
export const FREE_CATALOGUE_LIMITS = {
  personal: {
    variants: 1,
    importRows: 0,
    seats: 1,
    drafts: FREE_DRAFT_LIMITS.personal,
  },
  business: {
    variants: 25,
    importRows: 25,
    seats: 3,
    drafts: FREE_DRAFT_LIMITS.business,
  },
} as const;
export async function readFreeCatalogueLimits(
  tx: SellerTransaction,
  sellerId: string,
  kind: "personal" | "business",
  write = false,
) {
  const row = (
    await tx.client.query<{ planId: string; version: number; drafts: number }>(
      'SELECT plan_id AS "planId",plan_version AS version,draft_count AS drafts FROM treido.seller_usage WHERE seller_id=$1 FOR ' +
        (write ? "UPDATE" : "SHARE"),
      [sellerId],
    )
  ).rows[0];
  if (!row || row.version !== 1 || row.planId !== kind + "_free")
    throw new SellerError("NOT_AVAILABLE");
  return {
    ...await readSellerEntitlements(tx, sellerId, kind),
    draftCount: row.drafts,
  };
}
