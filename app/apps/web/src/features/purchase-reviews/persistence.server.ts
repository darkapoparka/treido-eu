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
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import {
  publishedJoins,
  publishedEligibility,
} from "../catalog/publication-eligibility.server";
import { lockInventoryListings } from "../inventory/allocations.server";
import { reservedSql } from "../inventory/queries.server";
import { readAcceptedOfferQuoteSource } from "../offers/checkout-source.server";
import {
  openListingConversation,
  sendConversationMessage,
} from "../messaging/participants.server";
import {
  REVIEW_LIMITS,
  merchandiseTotal,
  parseCreateReview,
  parseReviewEdit,
  reviewMessage,
  type PurchaseReview,
  type ReviewLine,
  type ReviewIndex,
  type ReviewIndexItem,
} from "./model";

type SourceLine = {
  listingId: string;
  skuId: string;
  publicationRevision: number;
  quantity: number;
  unitPriceMinor: number;
};
export async function snapshotLine(
  tx: SellerTransaction,
  sellerId: string,
  line: SourceLine,
  offer: boolean,
  handover: string,
): Promise<ReviewLine> {
  const row = (
    await tx.client.query<{
      title: string;
      options: Record<string, string>;
      unitPriceMinor: number;
      currency: string;
      mode: string;
      available: number;
      onHand: number;
      terms: { handover: string[]; deliveryDetails: string };
    }>(
      `SELECT p.payload->>'title' AS title,ps.options,ps.price_minor AS "unitPriceMinor",ps.currency,i.mode,i.on_hand AS "onHand",i.on_hand-${reservedSql("i.id")} AS available,p.terms
     ${publishedJoins} JOIN treido.inventory_publication_skus ps ON ps.seller_id=l.seller_id AND ps.listing_id=l.id AND ps.publication_revision=p.revision
     JOIN treido.inventory_skus i ON i.seller_id=ps.seller_id AND i.listing_id=ps.listing_id AND i.id=ps.sku_id
     WHERE l.id=$1 AND l.seller_id=$2 AND ps.sku_id=$3 AND p.revision=$4 AND i.active AND ${publishedEligibility} FOR SHARE OF i`,
      [line.listingId, sellerId, line.skuId, line.publicationRevision],
    )
  ).rows[0];
  if (!row || row.currency !== "EUR" || !row.terms.handover.includes(handover))
    throw new SellerError("NOT_AVAILABLE");
  if (
    (offer ? row.onHand : row.available) < line.quantity ||
    (row.mode === "unique" && line.quantity !== 1) ||
    (!offer && row.unitPriceMinor !== line.unitPriceMinor)
  )
    throw new SellerError("CONFLICT");
  return {
    ...line,
    title: row.title,
    options: row.options,
    deliveryDetails: row.terms.deliveryDetails,
    current: true,
    available: row.available,
  };
}
/** Contact-only review. This operation NEVER reserves stock or creates a payable quote. */
export async function createPurchaseReview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseCreateReview(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, (tx) =>
    createPurchaseReviewInTransaction(tx, identity, command),
  );
}
/** Shared with explicit renewal so the new snapshot and its lineage commit together. */
export async function createPurchaseReviewInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseCreateReview(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  const user = await authorizeHuman(tx, identity, false),
    hash = inputHash(command);
  // Serialize review retries without taking the user UPDATE lock used by cart/contact creation.
  await tx.client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    ["purchase-review-v1:" + user.id],
  );
  const prior = (
    await tx.client.query<{ id: string; hash: string }>(
      "SELECT id,input_hash AS hash FROM treido.purchase_reviews WHERE buyer_id=$1 AND request_id=$2",
      [user.id, command.requestId],
    )
  ).rows[0];
  // Reload recovery keeps the original identity and deadline even after source expiry.
  if (prior) {
    if (prior.hash !== hash) throw new SellerError("CONFLICT");
    return { id: prior.id };
  }
  const count = (
    await tx.client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM treido.purchase_reviews WHERE buyer_id=$1 AND created_at>clock_timestamp()-interval '1 hour'",
      [user.id],
    )
  ).rows[0].n;
  if (count >= REVIEW_LIMITS.perHour) throw new SellerError("QUOTA_EXCEEDED");
  let sellerId: string,
    allocationId: string | null = null,
    deadline: string | null = null,
    sourceLines: SourceLine[];
  if (command.source.kind === "offer") {
    const source = await readAcceptedOfferQuoteSource(
      tx,
      identity,
      command.source,
    );
    sellerId = source.sellerId;
    allocationId = source.allocationId;
    deadline = source.expiresAt;
    sourceLines = [source];
  } else {
    sellerId = command.source.sellerId;
    const cart = (
      await tx.client.query<{ revision: number }>(
        "SELECT revision FROM treido.buyer_carts WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    if (!cart || cart.revision !== command.source.cartRevision)
      throw new SellerError("CONFLICT");
    sourceLines = (
      await tx.client.query<SourceLine>(
        'SELECT listing_id AS "listingId",sku_id AS "skuId",publication_revision AS "publicationRevision",quantity,seen_price_minor AS "unitPriceMinor" FROM treido.buyer_cart_lines WHERE user_id=$1 AND seller_id=$2 AND active ORDER BY listing_id,sku_id LIMIT $3',
        [user.id, sellerId, REVIEW_LIMITS.lines + 1],
      )
    ).rows;
  }
  if (!sourceLines.length || sourceLines.length > REVIEW_LIMITS.lines)
    throw new SellerError("INVALID_INPUT");
  const seller = (
    await tx.client.query<{ name: string }>(
      "SELECT name FROM treido.seller_accounts WHERE id=$1 AND status='active' FOR SHARE",
      [sellerId],
    )
  ).rows[0];
  if (!seller) throw new SellerError("NOT_AVAILABLE");
  const self = await tx.client.query(
    "SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'",
    [sellerId, user.id],
  );
  if (self.rowCount) throw new SellerError("FORBIDDEN");
  await lockInventoryListings(
    tx,
    sellerId,
    sourceLines.map((l) => l.listingId),
  );
  const lines: ReviewLine[] = [];
  for (const line of sourceLines)
    lines.push(
      await snapshotLine(
        tx,
        sellerId,
        line,
        command.source.kind === "offer",
        command.handover,
      ),
    );
  const total = merchandiseTotal(lines),
    id = randomUUID();
  await tx.client.query(
    `INSERT INTO treido.purchase_reviews(id,buyer_id,seller_id,request_id,input_hash,source,cart_revision,thread_id,offer_id,allocation_id,seller_name,currency,merchandise_minor,language,handover,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'EUR',$12,$13,$14,least(clock_timestamp()+make_interval(secs=>$15),coalesce($16::timestamptz,'infinity'::timestamptz)))`,
    [
      id,
      user.id,
      sellerId,
      command.requestId,
      hash,
      command.source.kind,
      command.source.kind === "cart" ? command.source.cartRevision : null,
      command.source.kind === "offer" ? command.source.threadId : null,
      command.source.kind === "offer" ? command.source.offerId : null,
      allocationId,
      seller.name,
      total,
      command.language,
      command.handover,
      REVIEW_LIMITS.seconds,
      deadline,
    ],
  );
  for (const [position, line] of lines.entries())
    await tx.client.query(
      `INSERT INTO treido.purchase_review_lines(review_id,seller_id,listing_id,sku_id,publication_revision,position,title,options,quantity,unit_price_minor,delivery_details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,
        sellerId,
        line.listingId,
        line.skuId,
        line.publicationRevision,
        position,
        line.title,
        line.options,
        line.quantity,
        line.unitPriceMinor,
        line.deliveryDetails,
      ],
    );
  await tx.client.query(
    "INSERT INTO treido.purchase_review_preferences(review_id) VALUES($1)",
    [id],
  );
  return { id };
}

type StoredReview = Omit<
  PurchaseReview,
  "lines" | "payment" | "createdAt" | "expiresAt" | "merchandiseMinor"
> & { createdAt: Date; expiresAt: Date; merchandiseMinor: string };
export async function readPurchaseReview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  id: string,
): Promise<PurchaseReview> {
  if (!validId(id)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const row = (
      await tx.client.query<StoredReview>(
        `SELECT r.id,r.seller_id AS "sellerId",r.seller_name AS "sellerName",r.source,r.language,r.currency,r.handover,r.merchandise_minor AS "merchandiseMinor",r.created_at AS "createdAt",r.expires_at AS "expiresAt",r.expires_at<=statement_timestamp() AS expired,r.allocation_id AS "allocationId",r.thread_id AS "threadId",r.offer_id AS "offerId",p.revision,p.note,p.archived,
      CASE WHEN a.state='active' AND a.expires_at<=statement_timestamp() THEN 'expired' ELSE a.state END AS "holdState",
      (SELECT m.thread_id FROM treido.messages m JOIN treido.conversation_threads t ON t.id=m.thread_id WHERE m.request_id=r.id AND m.author_id=r.buyer_id AND t.buyer_id=r.buyer_id AND t.seller_id=r.seller_id ORDER BY m.created_at LIMIT 1) AS "contactThreadId"
      FROM treido.purchase_reviews r JOIN treido.purchase_review_preferences p ON p.review_id=r.id LEFT JOIN treido.inventory_allocations a ON a.id=r.allocation_id WHERE r.id=$1 AND r.buyer_id=$2`,
        [id, user.id],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    const lines = (
      await tx.client.query<ReviewLine>(
        `SELECT rl.listing_id AS "listingId",rl.sku_id AS "skuId",rl.publication_revision AS "publicationRevision",rl.title,rl.options,rl.quantity,rl.unit_price_minor AS "unitPriceMinor",rl.delivery_details AS "deliveryDetails",coalesce(live.current,false) AS current,live.available
      FROM treido.purchase_review_lines rl LEFT JOIN LATERAL (
        SELECT true AS current,greatest(0,i.on_hand-${reservedSql("i.id")}) AS available ${publishedJoins}
        JOIN treido.inventory_skus i ON i.listing_id=l.id AND i.seller_id=l.seller_id AND i.id=rl.sku_id
        WHERE l.id=rl.listing_id AND p.revision=rl.publication_revision AND i.active AND ${publishedEligibility}
      ) live ON true WHERE rl.review_id=$1 ORDER BY rl.position`,
        [id],
      )
    ).rows;
    return {
      ...row,
      merchandiseMinor: Number(row.merchandiseMinor),
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      lines,
      payment: {
        available: false,
        buyerFeeMinor: null,
        deliveryMinor: null,
        payableMinor: null,
      },
    };
  });
}
export async function editPurchaseReview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseReviewEdit(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const state = (
      await tx.client.query<{ revision: number }>(
        "SELECT p.revision FROM treido.purchase_reviews r JOIN treido.purchase_review_preferences p ON p.review_id=r.id WHERE r.id=$1 AND r.buyer_id=$2 FOR UPDATE OF p",
        [command.reviewId, user.id],
      )
    ).rows[0];
    if (!state) throw new SellerError("NOT_FOUND");
    const hash = inputHash(command),
      prior = (
        await tx.client.query<{ hash: string; revision: number }>(
          "SELECT input_hash AS hash,accepted_revision AS revision FROM treido.purchase_review_receipts WHERE review_id=$1 AND request_id=$2",
          [command.reviewId, command.requestId],
        )
      ).rows[0];
    if (prior) {
      if (prior.hash !== hash || prior.revision !== state.revision)
        throw new SellerError("CONFLICT");
      return { revision: prior.revision };
    }
    if (state.revision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    const next = state.revision + 1;
    await tx.client.query(
      "UPDATE treido.purchase_review_preferences SET revision=$2,note=$3,archived=$4,updated_at=clock_timestamp() WHERE review_id=$1",
      [command.reviewId, next, command.note, command.archived],
    );
    await tx.client.query(
      "INSERT INTO treido.purchase_review_receipts(review_id,request_id,input_hash,accepted_revision) VALUES($1,$2,$3,$4)",
      [command.reviewId, command.requestId, hash, next],
    );
    return { revision: next };
  });
}
export async function readPurchaseReviews(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  query: { archived?: boolean; before?: string | null } = {},
): Promise<ReviewIndex> {
  if (
    (query.archived !== undefined && typeof query.archived !== "boolean") ||
    (query.before && !validId(query.before))
  )
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const empty: ReviewIndex = {
      actorKey: libraryActorKey(identity),
      items: [],
      nextBefore: null,
    };
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return empty;
      throw error;
    }
    if (
      query.before &&
      (
        await tx.client.query(
          "SELECT id FROM treido.purchase_reviews WHERE id=$1 AND buyer_id=$2",
          [query.before, user.id],
        )
      ).rowCount !== 1
    )
      throw new SellerError("INVALID_INPUT");
    const rows = (
      await tx.client.query<
        Omit<
          ReviewIndexItem,
          "createdAt" | "expiresAt" | "merchandiseMinor"
        > & { createdAt: Date; expiresAt: Date; merchandiseMinor: string }
      >(
        `SELECT r.id,r.seller_name AS "sellerName",r.source,r.merchandise_minor AS "merchandiseMinor",r.created_at AS "createdAt",r.expires_at AS "expiresAt",r.expires_at<=statement_timestamp() AS expired,p.archived,(SELECT count(*)::int FROM treido.purchase_review_lines l WHERE l.review_id=r.id) AS "lineCount"
      FROM treido.purchase_reviews r JOIN treido.purchase_review_preferences p ON p.review_id=r.id WHERE r.buyer_id=$1 AND p.archived=$2 AND ($3::uuid IS NULL OR (r.created_at,r.id)<(SELECT created_at,id FROM treido.purchase_reviews WHERE id=$3 AND buyer_id=$1)) ORDER BY r.created_at DESC,r.id DESC LIMIT $4`,
        [
          user.id,
          query.archived ?? false,
          query.before ?? null,
          REVIEW_LIMITS.page + 1,
        ],
      )
    ).rows;
    const selected = rows.slice(0, REVIEW_LIMITS.page);
    return {
      ...empty,
      items: selected.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        merchandiseMinor: Number(r.merchandiseMinor),
      })),
      nextBefore: rows.length > REVIEW_LIMITS.page ? selected.at(-1)!.id : null,
    };
  });
}
/** Explicit buyer command. Uses the existing in-app conversation and its durable
 * message receipt. No external email transport is used. Private notes are not sent. */
export async function sendPurchaseReview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  reviewId: string,
  actorKey: string,
) {
  if (actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  const review = await readPurchaseReview(database, identity, reviewId);
  if (review.contactThreadId) return { threadId: review.contactThreadId };
  if (
    review.archived ||
    review.expired ||
    review.lines.some((l) => !l.current) ||
    (review.source === "cart" &&
      review.lines.some(
        (l) => l.available === null || l.available < l.quantity,
      )) ||
    (review.source === "offer" && review.holdState !== "active")
  )
    throw new SellerError("CONFLICT");
  const thread = await openListingConversation(
    database,
    identity,
    review.lines[0].listingId,
  );
  await sendConversationMessage(
    database,
    identity,
    {
      threadId: thread.id,
      requestId: review.id,
      body: reviewMessage(review),
      attachmentIds: [],
    },
    { sellerId: null },
  );
  return { threadId: thread.id };
}
