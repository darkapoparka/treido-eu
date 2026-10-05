import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import { readAcceptedOfferQuoteSource } from "../offers/checkout-source.server";
import { lockInventoryListings } from "../inventory/allocations.server";
import {
  createPurchaseReviewInTransaction,
  snapshotLine,
} from "./persistence.server";
import { REVIEW_LIMITS, merchandiseTotal, type ReviewLine } from "./model";
import { parseRenewReview, type ReviewRenewalContext } from "./renewal-model";

type Original = {
  id: string;
  sellerId: string;
  source: "cart" | "offer";
  threadId: string | null;
  offerId: string | null;
  allocationId: string | null;
  handover: "pickup" | "shipping";
  expired: boolean;
  previousId: string | null;
  nextId: string | null;
};
async function ownedOriginal(
  tx: SellerTransaction,
  buyerId: string,
  reviewId: string,
): Promise<Original> {
  if (!validId(reviewId)) throw new SellerError("INVALID_INPUT");
  const row = (
    await tx.client.query<Original>(
      `SELECT r.id,r.seller_id AS "sellerId",r.source,r.thread_id AS "threadId",r.offer_id AS "offerId",r.allocation_id AS "allocationId",r.handover,r.expires_at<=clock_timestamp() AS expired,
    (SELECT previous_review_id FROM treido.purchase_review_renewals WHERE next_review_id=r.id AND buyer_id=$2) AS "previousId",
    (SELECT next_review_id FROM treido.purchase_review_renewals WHERE previous_review_id=r.id AND buyer_id=$2) AS "nextId"
    FROM treido.purchase_reviews r WHERE r.id=$1 AND r.buyer_id=$2`,
      [reviewId, buyerId],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  return row;
}
/** Read-only preview. Uses the same live source checks as creation; no review,
 * cart line or inventory hold is created or extended by rendering this context. */
export async function readReviewRenewalContext(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  reviewId: string,
  handover?: "pickup" | "shipping",
): Promise<ReviewRenewalContext> {
  if (
    handover !== undefined &&
    handover !== "pickup" &&
    handover !== "shipping"
  )
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false),
      old = await ownedOriginal(tx, user.id, reviewId);
    const method = handover ?? old.handover;
    const context: ReviewRenewalContext = {
      previousId: old.previousId,
      nextId: old.nextId,
      expired: old.expired,
      source: old.source,
      handover: method,
      cartRevision: null,
      lines: [],
      merchandiseMinor: null,
      available: false,
      reason: null,
    };
    if (!old.expired || old.nextId) return context;
    try {
      let sources: Pick<
        ReviewLine,
        | "listingId"
        | "skuId"
        | "publicationRevision"
        | "quantity"
        | "unitPriceMinor"
      >[];
      if (old.source === "cart") {
        const cart = (
          await tx.client.query<{ revision: number }>(
            "SELECT revision FROM treido.buyer_carts WHERE user_id=$1 FOR SHARE",
            [user.id],
          )
        ).rows[0];
        context.cartRevision = cart?.revision ?? null;
        sources = (
          await tx.client.query<ReviewLine>(
            'SELECT listing_id AS "listingId",sku_id AS "skuId",publication_revision AS "publicationRevision",quantity,seen_price_minor AS "unitPriceMinor" FROM treido.buyer_cart_lines WHERE user_id=$1 AND seller_id=$2 AND active ORDER BY listing_id,sku_id LIMIT $3',
            [user.id, old.sellerId, REVIEW_LIMITS.lines + 1],
          )
        ).rows;
        if (!cart || !sources.length)
          return { ...context, reason: "cart_empty" };
      } else {
        const offer = await readAcceptedOfferQuoteSource(tx, identity, {
          threadId: old.threadId!,
          offerId: old.offerId!,
        });
        if (
          offer.allocationId !== old.allocationId ||
          offer.sellerId !== old.sellerId
        )
          throw new SellerError("CONFLICT");
        sources = [offer];
      }
      if (sources.length > REVIEW_LIMITS.lines)
        throw new SellerError("CONFLICT");
      const seller = await tx.client.query(
        "SELECT id FROM treido.seller_accounts WHERE id=$1 AND status='active' FOR SHARE",
        [old.sellerId],
      );
      if (seller.rowCount !== 1) throw new SellerError("NOT_AVAILABLE");
      const self = await tx.client.query(
        "SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'",
        [old.sellerId, user.id],
      );
      if (self.rowCount) throw new SellerError("FORBIDDEN");
      await lockInventoryListings(
        tx,
        old.sellerId,
        sources.map((line) => line.listingId),
      );
      const lines: ReviewLine[] = [];
      for (const source of sources)
        lines.push(
          await snapshotLine(
            tx,
            old.sellerId,
            source,
            old.source === "offer",
            method,
          ),
        );
      return {
        ...context,
        lines,
        merchandiseMinor: merchandiseTotal(lines),
        available: true,
      };
    } catch (error) {
      if (
        error instanceof SellerError &&
        ["CONFLICT", "NOT_AVAILABLE", "NOT_FOUND"].includes(error.code)
      )
        return {
          ...context,
          reason: old.source === "offer" ? "offer_expired" : "source_changed",
        };
      throw error;
    }
  });
}
/** A new immutable review and its lineage commit together. The old snapshot,
 * private notes and original accepted-offer deadline are never updated. */
export async function renewPurchaseReview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<{ id: string }> {
  const command = parseRenewReview(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    await tx.client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      ["purchase-review-v1:" + user.id],
    );
    const old = await ownedOriginal(tx, user.id, command.reviewId),
      hash = inputHash(command);
    const prior = (
      await tx.client.query<{ hash: string; id: string }>(
        "SELECT input_hash AS hash,next_review_id AS id FROM treido.purchase_review_renewals WHERE buyer_id=$1 AND request_id=$2",
        [user.id, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.hash !== hash) throw new SellerError("CONFLICT");
      return { id: prior.id };
    }
    if (!old.expired || old.nextId) throw new SellerError("CONFLICT");
    if ((old.source === "cart") !== (command.cartRevision !== null))
      throw new SellerError("INVALID_INPUT");
    // A creation request already used outside renewal cannot acquire new lineage.
    if (
      (
        await tx.client.query(
          "SELECT id FROM treido.purchase_reviews WHERE buyer_id=$1 AND request_id=$2",
          [user.id, command.requestId],
        )
      ).rowCount
    )
      throw new SellerError("CONFLICT");
    const result = await createPurchaseReviewInTransaction(tx, identity, {
      actorKey: command.actorKey,
      requestId: command.requestId,
      language: command.language,
      handover: command.handover,
      source:
        old.source === "cart"
          ? {
              kind: "cart",
              sellerId: old.sellerId,
              cartRevision: command.cartRevision,
            }
          : { kind: "offer", threadId: old.threadId, offerId: old.offerId },
    });
    if (old.source === "offer") {
      const exact = await tx.client.query(
        "SELECT id FROM treido.purchase_reviews WHERE id=$1 AND buyer_id=$2 AND seller_id=$3 AND allocation_id=$4",
        [result.id, user.id, old.sellerId, old.allocationId],
      );
      if (exact.rowCount !== 1) throw new SellerError("CONFLICT");
    }
    await tx.client.query(
      "INSERT INTO treido.purchase_review_renewals(previous_review_id,next_review_id,buyer_id,seller_id,request_id,input_hash) VALUES($1,$2,$3,$4,$5,$6)",
      [old.id, result.id, user.id, old.sellerId, command.requestId, hash],
    );
    return result;
  });
}
