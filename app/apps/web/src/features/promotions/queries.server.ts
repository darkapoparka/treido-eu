import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizePromotion } from "./authority.server";
import { currentEligibleMany } from "./eligibility.server";
import {
  type ReviewRow,
  databaseTime,
  capacity,
  approvedProduct,
  approvedPromotionPayment,
  type CampaignRow,
} from "./storage.server";
import { promotionPaymentBridge } from "./payment-bridge.server";
import {
  PRODUCTS,
  UUID,
  type PromotionView,
  type CampaignView,
  type Terms,
} from "./model";
import { SellerError } from "../sellers/errors";

/** Explicit unavailability is an error; a successful empty query is genuinely empty. Reads never create/advance campaigns. */
export async function readPromotions(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
): Promise<PromotionView> {
  if (!UUID(sellerId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const access = await authorizePromotion(tx, identity, sellerId),
      now = await databaseTime(tx),
      bridge = promotionPaymentBridge();
    const rows = (
      await tx.client.query<CampaignRow & { title: string }>(
        `SELECT c.id,c.seller_id AS "sellerId",c.listing_id AS "listingId",c.product_id AS "productId",c.revision,c.state,c.reason,c.created_at AS "createdAt",coalesce(d.payload->>'title','') AS title FROM treido.promotion_campaigns c LEFT JOIN treido.listing_drafts d ON d.seller_id=c.seller_id AND d.listing_id=c.listing_id WHERE c.seller_id=$1 ORDER BY c.created_at DESC,c.id DESC LIMIT 31`,
        [sellerId],
      )
    ).rows;
    const selected = rows.slice(0, 30),
      ids = selected.map((c) => c.id);
    const eligible = await currentEligibleMany(
      tx,
      sellerId,
      selected.map((c) => c.listingId),
    );
    const reviews = (
      await tx.client.query<ReviewRow & { campaignId: string }>(
        `SELECT DISTINCT ON (campaign_id) campaign_id AS "campaignId",id,campaign_revision AS "campaignRevision",listing_revision AS "listingRevision",category_id AS "categoryId",country,product_policy_id AS "policyId",capacity_id AS "capacityId",terms,terms_hash AS "termsHash",expires_at AS "expiresAt" FROM treido.promotion_reviews WHERE seller_id=$1 AND campaign_id=ANY($2::uuid[]) ORDER BY campaign_id,created_at DESC,id DESC`,
        [sellerId, ids],
      )
    ).rows;
    const attempts = (
      await tx.client.query<{
        campaignId: string;
        id: string;
        state: string;
        refundable: boolean;
        checkoutUrl: string | null;
      }>(
        `SELECT campaign_id AS "campaignId",id,state,state='paid' AS refundable,checkout_url AS "checkoutUrl" FROM treido.promotion_attempts WHERE seller_id=$1 AND campaign_id=ANY($2::uuid[])`,
        [sellerId, ids],
      )
    ).rows;
    const purchases = (
      await tx.client.query<{
        campaignId: string;
        terms: Terms;
        acceptedAt: Date;
        startsAt: Date | null;
        endsAt: Date | null;
      }>(
        `SELECT p.campaign_id AS "campaignId",p.terms,p.accepted_at AS "acceptedAt",i.starts_at AS "startsAt",i.ends_at AS "endsAt" FROM treido.promotion_purchases p LEFT JOIN treido.promotion_intervals i ON i.campaign_id=p.campaign_id WHERE p.seller_id=$1 AND p.campaign_id=ANY($2::uuid[])`,
        [sellerId, ids],
      )
    ).rows;
    const measured = (
      await tx.client.query<{
        campaignId: string;
        impressions: number;
        clicks: number;
        inquiries: number;
      }>(
        `SELECT campaign_id AS "campaignId",count(*) FILTER(WHERE kind='impression')::int AS impressions,count(*) FILTER(WHERE kind='click')::int AS clicks,count(*) FILTER(WHERE kind='inquiry')::int AS inquiries FROM treido.promotion_metrics WHERE campaign_id=ANY($1::uuid[]) AND expires_at>clock_timestamp() GROUP BY campaign_id`,
        [ids],
      )
    ).rows;
    const remedies = (
      await tx.client.query<{
        campaignId: string;
        kind: "full_refund_review" | "prorated_review";
        maximumMinor: number;
        createdAt: Date;
      }>(
        `SELECT campaign_id AS "campaignId",kind,maximum_minor AS "maximumMinor",created_at AS "createdAt" FROM treido.promotion_remedy_reviews WHERE campaign_id=ANY($1::uuid[])`,
        [ids],
      )
    ).rows;
    const waiting = (
      await tx.client.query<{
        campaignId: string;
        position: number;
        expiresAt: Date;
      }>(
        `SELECT r.campaign_id AS "campaignId",r.expires_at AS "expiresAt",(SELECT count(*)::int FROM treido.promotion_reservations ahead WHERE ahead.capacity_id=r.capacity_id AND ahead.status='waitlisted' AND ahead.expires_at>clock_timestamp() AND (ahead.created_at,ahead.campaign_id)<=(r.created_at,r.campaign_id)) AS position FROM treido.promotion_reservations r WHERE r.campaign_id=ANY($1::uuid[]) AND r.status='waitlisted' AND r.expires_at>clock_timestamp()`,
        [ids],
      )
    ).rows;
    const campaigns: CampaignView[] = [];
    for (const c of selected) {
      const listing = eligible.find((row) => row.id === c.listingId),
        review = reviews.find((row) => row.campaignId === c.id) ?? null;
      const policy = listing
        ? await approvedProduct(
            tx,
            c.productId,
            { ...listing, kind: access.seller.kind },
            bridge,
          )
        : null;
      const paymentReady = policy
        ? await approvedPromotionPayment(tx, policy.id, sellerId, bridge)
        : false;
      const attempted = attempts.find((row) => row.campaignId === c.id) ?? null;
      const attempt = attempted
        ? {
            id: attempted.id,
            state: attempted.state,
            refundable: attempted.refundable,
            checkoutUrl:
              attempted.state === "pending" &&
              paymentReady &&
              !!listing &&
              !!policy &&
              policy.id === review?.policyId
                ? attempted.checkoutUrl
                : null,
          }
        : null;
      const purchase = purchases.find((row) => row.campaignId === c.id);
      const metrics = measured.find((row) => row.campaignId === c.id) ?? {
        impressions: 0,
        clicks: 0,
        inquiries: 0,
      };
      const remedy = remedies.find((row) => row.campaignId === c.id),
        queue = waiting.find((row) => row.campaignId === c.id);
      const cap =
        policy && review?.capacityId === policy.capacityId
          ? await capacity(tx, policy.capacityId, false)
          : null;
      const expired =
        purchase?.terms.durationSeconds !== 0 &&
        purchase?.endsAt !== null &&
        purchase?.endsAt !== undefined &&
        purchase.endsAt <= now;
      const blockedActive =
        c.state === "active" &&
        (!listing ||
          !policy ||
          !paymentReady ||
          policy.id !== review?.policyId ||
          review?.listingRevision !== listing.revision);
      campaigns.push({
        id: c.id,
        listingId: c.listingId,
        title: c.title,
        productId: c.productId,
        revision: c.revision,
        state:
          expired && c.state !== "cancelled"
            ? "completed"
            : blockedActive
              ? "paused"
              : c.state,
        reason: expired
          ? "expired"
          : blockedActive
            ? !listing || review?.listingRevision !== listing.revision
              ? "listing_unavailable"
              : "platform_failure"
            : c.reason,
        createdAt: c.createdAt.toISOString(),
        eligible: !!listing,
        remedy: remedy
          ? {
              kind: remedy.kind,
              maximumMinor: remedy.maximumMinor,
              createdAt: remedy.createdAt.toISOString(),
            }
          : null,
        waiting: queue
          ? {
              position: queue.position,
              expiresAt: queue.expiresAt.toISOString(),
            }
          : null,
        attempt,
        purchase: purchase
          ? {
              terms: purchase.terms,
              acceptedAt: purchase.acceptedAt.toISOString(),
              interval:
                purchase.startsAt && purchase.endsAt
                  ? {
                      startsAt: purchase.startsAt.toISOString(),
                      endsAt: purchase.endsAt.toISOString(),
                    }
                  : null,
            }
          : null,
        review: review
          ? {
              id: review.id,
              campaignRevision: review.campaignRevision,
              termsHash: review.termsHash,
              terms: review.terms,
              proposedMinor: PRODUCTS[c.productId].proposedMinor,
              expiresAt: review.expiresAt.toISOString(),
              saleAvailable:
                !!bridge &&
                paymentReady &&
                !!listing &&
                !!policy &&
                policy.id === review.policyId &&
                review.expiresAt > now &&
                review.campaignRevision === c.revision &&
                review.listingRevision === listing.revision,
              capacity: cap?.status ?? "unavailable",
              country: review.country,
              categoryId: review.categoryId,
              listingRevision: review.listingRevision,
            }
          : null,
        metrics: {
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          inquiries: metrics.inquiries,
        },
      });
    }
    const listings = (
      await tx.client.query<{ id: string; title: string }>(
        `SELECT l.id,coalesce(d.payload->>'title','') AS title FROM treido.listings l JOIN treido.listing_drafts d ON d.seller_id=l.seller_id AND d.listing_id=l.id WHERE l.seller_id=$1 ORDER BY l.created_at DESC,l.id DESC LIMIT 31`,
        [sellerId],
      )
    ).rows;
    const choices: PromotionView["listings"] = [];
    const eligibleChoices = await currentEligibleMany(
      tx,
      sellerId,
      listings.slice(0, 30).map((item) => item.id),
    );
    for (const item of listings.slice(0, 30))
      choices.push({
        ...item,
        eligible: eligibleChoices.some((row) => row.id === item.id),
      });
    return {
      actorKey: access.actorKey,
      sellerId,
      sellerName: access.seller.name,
      canBill: access.context.capabilities.includes("billing.manage"),
      paymentAvailable: campaigns.some((c) => c.review?.saleAvailable === true),
      campaigns,
      listings: choices,
      truncated: rows.length > 30 || listings.length > 30,
      observedAt: now.toISOString(),
    };
  });
}
