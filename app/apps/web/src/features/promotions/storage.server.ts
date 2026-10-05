import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import type { PromotionPaymentBridge } from "./payment-bridge.server";
import {
  validTerms,
  type Terms,
  type ProductId,
  type CampaignState,
  type StopReason,
} from "./model";

export type CampaignRow = {
  id: string;
  sellerId: string;
  listingId: string;
  productId: ProductId;
  revision: number;
  state: CampaignState;
  reason: StopReason | null;
  createdAt: Date;
};
export async function campaign(
  tx: SellerTransaction,
  sellerId: string,
  id: string,
  lock = false,
) {
  return (
    (
      await tx.client.query<CampaignRow>(
        `SELECT id,seller_id AS "sellerId",listing_id AS "listingId",product_id AS "productId",revision,state,reason,created_at AS "createdAt" FROM treido.promotion_campaigns WHERE seller_id=$1 AND id=$2 ${lock ? "FOR UPDATE" : ""}`,
        [sellerId, id],
      )
    ).rows[0] ?? null
  );
}
export async function databaseTime(tx: SellerTransaction) {
  return (
    await tx.client.query<{ now: Date }>("SELECT clock_timestamp() AS now")
  ).rows[0].now;
}
export type PolicyRow = {
  id: string;
  terms: Terms;
  capacityId: string;
  slots: number;
  waitlistLimit: number;
};
export async function approvedProduct(
  tx: SellerTransaction,
  product: ProductId,
  scope: { categoryId: string; country: string; kind: string },
  bridge: PromotionPaymentBridge | null,
): Promise<PolicyRow | null> {
  if (!bridge) return null;
  const b = bridge.binding;
  const row = (
    await tx.client.query<PolicyRow>(
      `SELECT pp.id,pp.terms,pc.id AS "capacityId",pc.slots,pc.waitlist_limit AS "waitlistLimit" FROM treido.promotion_products pp JOIN treido.promotion_capacity pc ON pc.product_policy_id=pp.id AND pc.country=$2 AND pc.category_id=$3 AND pc.seller_kind=$4 WHERE pp.product_id=$1 AND pp.platform_account=$5 AND pp.environment=$6 AND pp.application_id=$7 AND pp.livemode=$8 AND pp.approved_at<=clock_timestamp() AND pp.revoked_at IS NULL AND pc.approved_at<=clock_timestamp() AND pc.revoked_at IS NULL AND pp.version=(SELECT max(latest.version) FROM treido.promotion_products latest WHERE latest.product_id=pp.product_id AND latest.platform_account=pp.platform_account AND latest.environment=pp.environment AND latest.application_id=pp.application_id AND latest.livemode=pp.livemode) FOR SHARE OF pp`,
      [
        product,
        scope.country,
        scope.categoryId,
        scope.kind,
        b.platformAccount,
        b.environment,
        b.applicationId,
        b.livemode,
      ],
    )
  ).rows[0];
  return row && validTerms(row.terms) && row.terms.productId === product
    ? row
    : null;
}
export async function capacity(
  tx: SellerTransaction,
  capacityId: string,
  lock: boolean,
) {
  const row = (
    await tx.client.query<{ slots: number; waitlistLimit: number }>(
      `SELECT slots,waitlist_limit AS "waitlistLimit" FROM treido.promotion_capacity WHERE id=$1 AND approved_at<=clock_timestamp() AND revoked_at IS NULL ${lock ? "FOR UPDATE" : ""}`,
      [capacityId],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_AVAILABLE");
  const counts = (
    await tx.client.query<{ reserved: number; waiting: number }>(
      `SELECT count(*) FILTER(WHERE status IN ('reserved','serving'))::int AS reserved,count(*) FILTER(WHERE status='waitlisted')::int AS waiting FROM treido.promotion_reservations r WHERE capacity_id=$1 AND status<>'released' AND (expires_at>clock_timestamp() OR EXISTS(SELECT 1 FROM treido.promotion_attempts pa WHERE pa.campaign_id=r.campaign_id AND pa.state NOT IN ('prepared','cancelled')))`,
      [capacityId],
    )
  ).rows[0];
  return {
    ...row,
    ...counts,
    status:
      counts.reserved < row.slots
        ? ("available" as const)
        : counts.waiting < row.waitlistLimit
          ? ("waitlist" as const)
          : ("full" as const),
  };
}
/** Approved original provider/customer mappings only; absent optional bridge storage is unavailable. */
export async function approvedPromotionPayment(
  tx: SellerTransaction,
  policyId: string,
  sellerId: string,
  bridge: PromotionPaymentBridge | null,
) {
  if (!bridge) return false;
  const ready = (
    await tx.client.query<{ ready: boolean }>(
      `SELECT to_regclass('treido.promotion_payment_bindings') IS NOT NULL AND to_regclass('treido.promotion_customer_bindings') IS NOT NULL AND to_regclass('treido.promotion_checkout_intents') IS NOT NULL AS ready`,
    )
  ).rows[0];
  if (!ready) throw new SellerError("NOT_AVAILABLE");
  if (!ready.ready) return false;
  const b = bridge.binding;
  return !!(
    await tx.client.query(
      `SELECT pb.id FROM treido.promotion_payment_bindings pb JOIN treido.promotion_customer_bindings cb ON cb.platform_account=pb.platform_account AND cb.livemode=pb.livemode AND cb.environment=pb.environment AND cb.application_id=pb.application_id WHERE pb.product_policy_id=$1 AND cb.seller_id=$2 AND pb.platform_account=$3 AND pb.livemode=$4 AND pb.environment=$5 AND pb.application_id=$6 AND pb.purpose='promotion' AND cb.purpose='promotion' AND pb.approved_at<=clock_timestamp() AND cb.approved_at<=clock_timestamp() AND pb.revoked_at IS NULL AND cb.revoked_at IS NULL`,
      [
        policyId,
        sellerId,
        b.platformAccount,
        b.livemode,
        b.environment,
        b.applicationId,
      ],
    )
  ).rows[0];
}
export type ReviewRow = {
  id: string;
  campaignRevision: number;
  listingRevision: number;
  categoryId: string;
  country: "BG";
  policyId: string | null;
  capacityId: string | null;
  terms: Terms | null;
  termsHash: string;
  expiresAt: Date;
};
export async function latestReview(
  tx: SellerTransaction,
  sellerId: string,
  campaignId: string,
) {
  return (
    (
      await tx.client.query<ReviewRow>(
        `SELECT id,campaign_revision AS "campaignRevision",listing_revision AS "listingRevision",category_id AS "categoryId",country,product_policy_id AS "policyId",capacity_id AS "capacityId",terms,terms_hash AS "termsHash",expires_at AS "expiresAt" FROM treido.promotion_reviews WHERE seller_id=$1 AND campaign_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1`,
        [sellerId, campaignId],
      )
    ).rows[0] ?? null
  );
}
export function reviewHash(value: {
  listingId: string;
  listingRevision: number;
  productId: ProductId;
  categoryId: string;
  policyId: string | null;
  capacityId: string | null;
  terms: Terms | null;
}) {
  return inputHash({ format: "promotion-review-v1", ...value });
}
export async function lockPublication(
  tx: SellerTransaction,
  sellerId: string,
  listingId: string,
) {
  const listing = (
    await tx.client.query(
      `SELECT id FROM treido.listings WHERE seller_id=$1 AND id=$2 FOR SHARE`,
      [sellerId, listingId],
    )
  ).rows[0];
  if (!listing) throw new SellerError("NOT_FOUND");
  // Same SKU locks as the existing allocation service, before the fresh eligibility read.
  await tx.client.query(
    `SELECT id FROM treido.inventory_skus WHERE seller_id=$1 AND listing_id=$2 ORDER BY id FOR SHARE`,
    [sellerId, listingId],
  );
}
