import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import {
  publishedEligibility,
  publishedJoins,
} from "../catalog/publication-eligibility.server";
import { publicInventoryJoin } from "../inventory/public-sql";
import { reservedSql } from "../inventory/queries.server";
import type { StopReason } from "./model";

export const promotionAvailability = `(CASE WHEN EXISTS(SELECT 1 FROM treido.inventory_catalogues ic WHERE ic.seller_id=l.seller_id AND ic.listing_id=l.id AND ic.mode='stocked') THEN stock.state='available' ELSE NOT EXISTS(SELECT 1 FROM treido.inventory_skus ui WHERE ui.seller_id=l.seller_id AND ui.listing_id=l.id AND ui.active AND (ui.on_hand-${reservedSql("ui.id")}<=0)) AND EXISTS(SELECT 1 FROM treido.inventory_skus ui WHERE ui.seller_id=l.seller_id AND ui.listing_id=l.id AND ui.active AND ui.on_hand-${reservedSql("ui.id")}>0) END)`;
export const currentEligibleSql = `SELECT l.id,p.revision,p.category_id AS "categoryId",p.country,p.payload->>'title' AS title ${publishedJoins} ${publicInventoryJoin} WHERE l.seller_id=$1 AND l.id=$2 AND ${publishedEligibility} AND ${promotionAvailability} AND p.payload->>'currency'='EUR'`;
export async function currentEligible(
  tx: SellerTransaction,
  sellerId: string,
  listingId: string,
) {
  const rows = await tx.client.query<{
    id: string;
    revision: number;
    categoryId: string;
    country: "BG";
    title: string;
  }>(currentEligibleSql, [sellerId, listingId]);
  return rows.rows[0] ?? null;
}
export async function currentEligibleMany(
  tx: SellerTransaction,
  sellerId: string,
  listingIds: readonly string[],
) {
  if (!listingIds.length) return [];
  // Bounded application-owned IDs only; reuse the exact canonical promotion predicate.
  if (listingIds.length > 61)
    throw new Error("Promotion eligibility projection too large");
  return (
    await tx.client.query<{
      id: string;
      revision: number;
      categoryId: string;
      country: "BG";
      title: string;
    }>(currentEligibleSql.replace("l.id=$2", "l.id=ANY($2::uuid[])"), [
      sellerId,
      listingIds,
    ])
  ).rows;
}
export async function listingStopReason(
  tx: SellerTransaction,
  sellerId: string,
  listingId: string,
): Promise<StopReason> {
  const row = (
    await tx.client.query<{ moderation: string; status: string }>(
      `SELECT l.moderation_state AS moderation,s.status FROM treido.listings l JOIN treido.seller_accounts s ON s.id=l.seller_id WHERE l.seller_id=$1 AND l.id=$2`,
      [sellerId, listingId],
    )
  ).rows[0];
  return row?.status !== "active"
    ? "seller_restricted"
    : row.moderation !== "clear"
      ? "moderation"
      : "listing_unavailable";
}
