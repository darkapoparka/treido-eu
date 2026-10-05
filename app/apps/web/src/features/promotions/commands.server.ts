import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { SellerError } from "../sellers/errors";
import { authorizePromotion } from "./authority.server";
import { currentEligible, listingStopReason } from "./eligibility.server";
import {
  campaign,
  databaseTime,
  approvedProduct,
  approvedPromotionPayment,
  capacity,
  latestReview,
  reviewHash,
  lockPublication,
} from "./storage.server";
import {
  promotionPaymentBridge,
  type PromotionPaymentBridge,
  type PromotionIntent,
} from "./payment-bridge.server";
import {
  parseCommand,
  lifecycle,
  deliveryRemedy,
  type Acknowledgment,
  type CampaignState,
  type PromotionCommand,
} from "./model";

/** Stable intent is committed here; provider calls belong to the canonical owner outside this transaction. */
export async function executePromotion(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
  bridge: PromotionPaymentBridge | null = promotionPaymentBridge(),
): Promise<Acknowledgment> {
  const command = parseCommand(raw);
  if (
    command.action === "purchase" &&
    !hasVerifiedRecentAuthentication(identity)
  )
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const access = await authorizePromotion(
      tx,
      identity,
      command.sellerId,
      true,
    );
    if (command.actorKey !== access.actorKey)
      throw new SellerError("FORBIDDEN");
    if (command.action === "purchase")
      await authorizeSeller(tx, identity, command.sellerId, "billing.manage");
    const hash = inputHash(command);
    const prior = (
      await tx.client.query<{ hash: string; ack: Acknowledgment }>(
        `SELECT input_hash AS hash,acknowledgment AS ack FROM treido.promotion_receipts WHERE actor_id=$1 AND seller_id=$2 AND request_id=$3`,
        [access.user.id, command.sellerId, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.hash !== hash) throw new SellerError("CONFLICT");
      return prior.ack;
    }
    const recent = (
      await tx.client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM treido.promotion_receipts WHERE actor_id=$1 AND seller_id=$2 AND created_at>clock_timestamp()-interval '1 hour'`,
        [access.user.id, command.sellerId],
      )
    ).rows[0];
    if (recent.count >= 120) throw new SellerError("QUOTA_EXCEEDED");
    const previous = await campaign(
      tx,
      command.sellerId,
      command.campaignId,
      true,
    );
    if ((previous?.revision ?? 0) !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    if (previous && ["cancelled", "completed"].includes(previous.state))
      throw new SellerError("CONFLICT");
    if (!previous && command.action !== "save")
      throw new SellerError("NOT_FOUND");
    const now = await databaseTime(tx);
    let state: CampaignState = previous?.state ?? "draft",
      reason = previous?.reason ?? null,
      reviewId: string | null = null,
      attemptId: string | null = null;
    const nextRevision = command.expectedRevision + 1;
    if (command.action === "save") {
      if (previous && previous.state !== "draft")
        throw new SellerError("CONFLICT");
      await lockPublication(tx, command.sellerId, command.listingId);
      if (!previous) {
        const count = (
          await tx.client.query<{ count: number }>(
            `SELECT count(*)::int AS count FROM treido.promotion_campaigns WHERE seller_id=$1 AND state NOT IN ('cancelled','completed')`,
            [command.sellerId],
          )
        ).rows[0].count;
        if (count >= 100) throw new SellerError("QUOTA_EXCEEDED");
        await tx.client.query(
          `INSERT INTO treido.promotion_campaigns(id,seller_id,listing_id,product_id,revision,state) VALUES($1,$2,$3,$4,$5,'draft')`,
          [
            command.campaignId,
            command.sellerId,
            command.listingId,
            command.productId,
            nextRevision,
          ],
        );
      } else
        await tx.client.query(
          `UPDATE treido.promotion_campaigns SET listing_id=$3,product_id=$4,revision=$5,reason=NULL,updated_at=clock_timestamp() WHERE seller_id=$1 AND id=$2`,
          [
            command.sellerId,
            command.campaignId,
            command.listingId,
            command.productId,
            nextRevision,
          ],
        );
      reason = null;
    } else if (previous && command.action === "review") {
      if (previous.state !== "draft") throw new SellerError("CONFLICT");
      await lockPublication(tx, command.sellerId, previous.listingId);
      const listing = await currentEligible(
        tx,
        command.sellerId,
        previous.listingId,
      );
      if (!listing) throw new SellerError("NOT_AVAILABLE");
      const policy = await approvedProduct(
        tx,
        previous.productId,
        {
          categoryId: listing.categoryId,
          country: listing.country,
          kind: access.seller.kind,
        },
        bridge,
      );
      reviewId = randomUUID();
      const termsHash = reviewHash({
        listingId: previous.listingId,
        listingRevision: listing.revision,
        categoryId: listing.categoryId,
        productId: previous.productId,
        policyId: policy?.id ?? null,
        capacityId: policy?.capacityId ?? null,
        terms: policy?.terms ?? null,
      });
      await tx.client.query(
        `INSERT INTO treido.promotion_reviews(id,seller_id,campaign_id,campaign_revision,listing_revision,category_id,country,product_policy_id,capacity_id,terms,terms_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
        [
          reviewId,
          command.sellerId,
          previous.id,
          nextRevision,
          listing.revision,
          listing.categoryId,
          listing.country,
          policy?.id ?? null,
          policy?.capacityId ?? null,
          policy ? JSON.stringify(policy.terms) : null,
          termsHash,
          new Date(now.getTime() + 900000),
        ],
      );
    } else if (previous && command.action === "waitlist") {
      if (previous.state !== "draft" || !bridge)
        throw new SellerError("NOT_AVAILABLE");
      await lockPublication(tx, command.sellerId, previous.listingId);
      const listing = await currentEligible(
          tx,
          command.sellerId,
          previous.listingId,
        ),
        review = await latestReview(tx, command.sellerId, previous.id);
      if (
        !listing ||
        !review ||
        review.expiresAt <= now ||
        review.campaignRevision !== previous.revision ||
        review.listingRevision !== listing.revision
      )
        throw new SellerError("CONFLICT");
      const policy = await approvedProduct(
        tx,
        previous.productId,
        { ...listing, kind: access.seller.kind },
        bridge,
      );
      if (!policy || policy.id !== review.policyId)
        throw new SellerError("NOT_AVAILABLE");
      const cap = await capacity(tx, policy.capacityId, true);
      if (cap.status !== "waitlist")
        throw new SellerError(
          cap.status === "full" ? "QUOTA_EXCEEDED" : "CONFLICT",
        );
      if (
        (
          await tx.client.query(
            `SELECT 1 FROM treido.promotion_reservations WHERE campaign_id=$1`,
            [previous.id],
          )
        ).rows[0]
      )
        throw new SellerError("CONFLICT");
      await tx.client.query(
        `INSERT INTO treido.promotion_reservations(campaign_id,capacity_id,status,expires_at) VALUES($1,$2,'waitlisted',$3)`,
        [previous.id, policy.capacityId, new Date(now.getTime() + 604800000)],
      );
      reviewId = review.id;
    } else if (previous && command.action === "purchase") {
      if (!bridge || previous.state !== "draft")
        throw new SellerError("NOT_AVAILABLE");
      await lockPublication(tx, command.sellerId, previous.listingId);
      const review = await latestReview(tx, command.sellerId, previous.id),
        listing = await currentEligible(
          tx,
          command.sellerId,
          previous.listingId,
        );
      if (
        !review ||
        !listing ||
        review.id !== command.reviewId ||
        review.campaignRevision !== previous.revision ||
        review.termsHash !== command.termsHash ||
        review.expiresAt <= now ||
        review.listingRevision !== listing.revision ||
        !review.terms ||
        !review.policyId ||
        !review.capacityId
      )
        throw new SellerError("CONFLICT");
      const policy = await approvedProduct(
        tx,
        previous.productId,
        {
          categoryId: listing.categoryId,
          country: listing.country,
          kind: access.seller.kind,
        },
        bridge,
      );
      if (
        !policy ||
        policy.id !== review.policyId ||
        policy.capacityId !== review.capacityId ||
        inputHash(policy.terms) !== inputHash(review.terms) ||
        !(await approvedPromotionPayment(
          tx,
          policy.id,
          command.sellerId,
          bridge,
        ))
      )
        throw new SellerError("NOT_AVAILABLE");
      const cap = await capacity(tx, policy.capacityId, true);
      if (cap.status !== "available")
        throw new SellerError(
          cap.status === "full" ? "QUOTA_EXCEEDED" : "NOT_AVAILABLE",
        );
      const first = (
        await tx.client.query<{ id: string }>(
          `SELECT campaign_id AS id FROM treido.promotion_reservations WHERE capacity_id=$1 AND status='waitlisted' AND expires_at>clock_timestamp() ORDER BY created_at,campaign_id LIMIT 1`,
          [policy.capacityId],
        )
      ).rows[0];
      if (first && first.id !== previous.id)
        throw new SellerError("NOT_AVAILABLE");
      const reserved = (
        await tx.client.query<{
          capacityId: string;
          status: string;
          expiresAt: Date;
        }>(
          `SELECT capacity_id AS "capacityId",status,expires_at AS "expiresAt" FROM treido.promotion_reservations WHERE campaign_id=$1`,
          [previous.id],
        )
      ).rows[0];
      if (
        reserved &&
        (reserved.capacityId !== policy.capacityId ||
          reserved.status !== "waitlisted" ||
          reserved.expiresAt <= now)
      )
        throw new SellerError("CONFLICT");
      // Paid waitlisting requires an accepted delivery start contract. V1 never charges a waiting seller.
      attemptId = randomUUID();
      // Original server deadline covers Checkout's 30-minute minimum; retries never extend it.
      const checkoutExpiry = new Date(
        Math.floor(now.getTime() / 1000) * 1000 + 45 * 60000,
      );
      const intent: PromotionIntent = {
        purpose: "promotion",
        attemptId,
        campaignId: previous.id,
        sellerId: command.sellerId,
        productId: previous.productId,
        totalMinor: review.terms.totalMinor,
        currency: "EUR",
        ...bridge.binding,
        idempotencyKey: "treido-promotion-v1:" + attemptId,
        checkoutExpiresAt: checkoutExpiry.toISOString(),
        language: command.language,
      };
      if (reserved)
        await tx.client.query(
          `UPDATE treido.promotion_reservations SET status='reserved',expires_at=$2 WHERE campaign_id=$1`,
          [previous.id, checkoutExpiry],
        );
      else
        await tx.client.query(
          `INSERT INTO treido.promotion_reservations(campaign_id,capacity_id,status,expires_at) VALUES($1,$2,'reserved',$3)`,
          [previous.id, policy.capacityId, checkoutExpiry],
        );
      await tx.client.query(
        `INSERT INTO treido.promotion_attempts(id,seller_id,campaign_id,review_id,intent,state,platform_account,livemode) VALUES($1,$2,$3,$4,$5::jsonb,'prepared',$6,$7)`,
        [
          attemptId,
          command.sellerId,
          previous.id,
          review.id,
          JSON.stringify(intent),
          bridge.binding.platformAccount,
          bridge.binding.livemode,
        ],
      );
      await tx.client.query(
        `INSERT INTO treido.promotion_purchases(campaign_id,seller_id,attempt_id,review_id,terms) VALUES($1,$2,$3,$4,$5::jsonb)`,
        [
          previous.id,
          command.sellerId,
          attemptId,
          review.id,
          JSON.stringify(review.terms),
        ],
      );
      state = "awaiting_payment";
      reason = null;
      reviewId = review.id;
      await enqueueJob(tx, {
        kind: "promotion.reconcile",
        sellerId: command.sellerId,
        resourceId: attemptId,
        operationKey: command.requestId,
        actorId: null,
        authority: "service",
      });
    } else if (previous) {
      if (
        command.action !== "pause" &&
        command.action !== "cancel" &&
        command.action !== "recheck"
      )
        throw new SellerError("INVALID_INPUT");
      const interval = (
        await tx.client.query<{ startsAt: Date; endsAt: Date; paid: boolean }>(
          `SELECT i.starts_at AS "startsAt",i.ends_at AS "endsAt",a.state='paid' AS paid FROM treido.promotion_intervals i JOIN treido.promotion_attempts a ON a.campaign_id=i.campaign_id WHERE i.campaign_id=$1`,
          [previous.id],
        )
      ).rows[0];
      const listing = await currentEligible(
        tx,
        command.sellerId,
        previous.listingId,
      );
      const policy = listing
        ? await approvedProduct(
            tx,
            previous.productId,
            { ...listing, kind: access.seller.kind },
            bridge,
          )
        : null;
      const accepted = await latestReview(tx, command.sellerId, previous.id);
      const approved = !!policy && policy.id === accepted?.policyId;
      const samePublication =
        !!listing &&
        accepted?.listingRevision === listing.revision &&
        accepted.categoryId === listing.categoryId &&
        accepted.country === listing.country;
      if (command.action === "recheck" && previous.reason === "operator_safety")
        throw new SellerError("FORBIDDEN");
      if (
        command.action === "pause" &&
        !["active", "scheduled"].includes(previous.state)
      )
        throw new SellerError("CONFLICT");
      if (
        command.action === "cancel" &&
        ["awaiting_payment", "reconciling"].includes(previous.state)
      ) {
        const payment = (
          await tx.client.query<{ state: string }>(
            `SELECT state FROM treido.promotion_attempts WHERE campaign_id=$1 FOR UPDATE`,
            [previous.id],
          )
        ).rows[0];
        // Prepared proves no external call was claimed. All possibly emitted effects remain quarantined.
        state = payment?.state === "prepared" ? "cancelled" : "reconciling";
        reason = "seller_choice";
        if (payment?.state === "prepared")
          await tx.client.query(
            `UPDATE treido.promotion_attempts SET state='cancelled',updated_at=clock_timestamp() WHERE campaign_id=$1`,
            [previous.id],
          );
      } else {
        state = lifecycle(previous.state, command.action, {
          now: now.getTime(),
          startsAt: interval?.startsAt.getTime() ?? null,
          endsAt: interval?.endsAt.getTime() ?? null,
          eligible: samePublication,
          approved,
          paymentVerified: interval?.paid === true,
        });
        reason =
          state === "completed"
            ? "expired"
            : command.action === "pause" || command.action === "cancel"
              ? "seller_choice"
              : !samePublication
                ? await listingStopReason(
                    tx,
                    command.sellerId,
                    previous.listingId,
                  )
                : !approved
                  ? "platform_failure"
                  : null;
        if (
          command.action === "recheck" &&
          ["awaiting_payment", "reconciling"].includes(previous.state)
        )
          reason = previous.reason;
      }
      if (state === "cancelled" || state === "completed")
        await tx.client.query(
          `UPDATE treido.promotion_reservations SET status='released' WHERE campaign_id=$1`,
          [previous.id],
        );
      if (
        state === "paused" &&
        reason === "platform_failure" &&
        interval?.paid
      ) {
        const paid = (
          await tx.client.query<{ terms: import("./model").Terms }>(
            `SELECT terms FROM treido.promotion_purchases WHERE campaign_id=$1`,
            [previous.id],
          )
        ).rows[0];
        const proposed = paid
          ? deliveryRemedy(
              reason,
              interval.startsAt.getTime(),
              interval.endsAt.getTime(),
              now.getTime(),
              paid.terms.totalMinor,
            )
          : null;
        if (proposed)
          await tx.client.query(
            `INSERT INTO treido.promotion_remedy_reviews(campaign_id,kind,maximum_minor,reason) VALUES($1,$2,$3,'platform_failure') ON CONFLICT DO NOTHING`,
            [previous.id, proposed.kind, proposed.maximumMinor],
          );
      }
    }
    if (command.action !== "save")
      await tx.client.query(
        `UPDATE treido.promotion_campaigns SET state=$3,reason=$4,revision=$5,updated_at=clock_timestamp() WHERE seller_id=$1 AND id=$2`,
        [command.sellerId, command.campaignId, state, reason, nextRevision],
      );
    await tx.client.query(
      `INSERT INTO treido.promotion_events(id,campaign_id,actor_id,source,action,reason,state,revision) VALUES($1,$2,$3,'seller',$4,$5,$6,$7)`,
      [
        randomUUID(),
        command.campaignId,
        access.user.id,
        command.action,
        "reason" in command && command.reason ? command.reason : command.action,
        state,
        nextRevision,
      ],
    );
    const ack: Acknowledgment = {
      campaignId: command.campaignId,
      revision: nextRevision,
      state,
      reviewId,
      attemptId,
    };
    await tx.client.query(
      `INSERT INTO treido.promotion_receipts(actor_id,seller_id,request_id,input_hash,acknowledgment) VALUES($1,$2,$3,$4,$5::jsonb)`,
      [
        access.user.id,
        command.sellerId,
        command.requestId,
        hash,
        JSON.stringify(ack),
      ],
    );
    return ack;
  });
}

export async function recoverPromotion(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command: PromotionCommand = parseCommand(raw);
  return inTransaction(database, async (tx) => {
    const access = await authorizePromotion(tx, identity, command.sellerId);
    if (access.actorKey !== command.actorKey)
      throw new SellerError("FORBIDDEN");
    const row = (
      await tx.client.query<{ hash: string; ack: Acknowledgment }>(
        `SELECT input_hash AS hash,acknowledgment AS ack FROM treido.promotion_receipts WHERE actor_id=$1 AND seller_id=$2 AND request_id=$3`,
        [access.user.id, command.sellerId, command.requestId],
      )
    ).rows[0];
    if (row && row.hash !== inputHash(command))
      throw new SellerError("CONFLICT");
    return row?.ack ?? null;
  });
}
