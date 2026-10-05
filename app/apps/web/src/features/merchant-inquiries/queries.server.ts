import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { libraryActorKey } from "../library/cursor.server";
import { authorizeConversation } from "../messaging/conversation-access.server";
import { reviewMessage } from "../purchase-reviews/model";
import {
  isInquiryStatus,
  type InquiryItem,
  type InquiryQueue,
  type InquiryDetail,
} from "./model";

// Only immutable review fields plus the explicitly sent message are selected.
// Never join purchase_review_preferences: its note/archive fields belong to the buyer.
const sentFrom = `FROM treido.purchase_reviews r
 JOIN treido.messages m ON m.request_id=r.id AND m.author_id=r.buyer_id AND m.offer_event_id IS NULL
 JOIN treido.conversation_threads t ON t.id=m.thread_id AND t.buyer_id=r.buyer_id AND t.seller_id=r.seller_id
   AND t.listing_id=(SELECT listing_id FROM treido.purchase_review_lines WHERE review_id=r.id AND position=0)
 LEFT JOIN treido.merchant_inquiry_state state ON state.review_id=r.id AND state.seller_id=r.seller_id`;
const columns = `r.id,r.seller_id AS "sellerId",m.thread_id AS "threadId",m.id AS "messageId",m.input_hash AS "messageHash",r.language,r.source,r.currency,r.handover,r.merchandise_minor AS "merchandiseMinor",m.created_at AS "sentAt",r.expires_at AS "expiresAt",r.expires_at<=statement_timestamp() AS expired,coalesce(state.status,'new') AS status,coalesce(state.revision,0) AS revision,
 (SELECT jsonb_agg(jsonb_build_object('listingId',l.listing_id,'skuId',l.sku_id,'publicationRevision',l.publication_revision,'title',l.title,'options',l.options,'quantity',l.quantity,'unitPriceMinor',l.unit_price_minor,'deliveryDetails',l.delivery_details,'current',false,'available',NULL) ORDER BY l.position) FROM treido.purchase_review_lines l WHERE l.review_id=r.id) AS lines`;
type Stored = Omit<InquiryItem, "sentAt" | "expiresAt" | "merchandiseMinor"> & {
  sentAt: Date;
  expiresAt: Date;
  merchandiseMinor: string;
  messageHash: string;
};
function project(row: Stored): InquiryItem | null {
  const { messageHash, sentAt, expiresAt, merchandiseMinor, ...publicFields } =
    row;
  const item: InquiryItem = {
    ...publicFields,
    merchandiseMinor: Number(merchandiseMinor),
    sentAt: sentAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  // T45 already used the review ID as message retry identity. Matching the exact
  // generated body hash excludes arbitrary messages reusing that ID and supports
  // existing sent reviews without manufacturing sends or backfilling private data.
  if (
    messageHash !== inputHash({ body: reviewMessage(item), attachmentIds: [] })
  )
    return null;
  return item;
}
export async function readSentInquiryInTransaction(
  tx: SellerTransaction,
  sellerId: string,
  reviewId: string,
): Promise<InquiryItem> {
  if (!validId(sellerId) || !validId(reviewId))
    throw new SellerError("INVALID_INPUT");
  const row = (
    await tx.client.query<Stored>(
      `SELECT ${columns} ${sentFrom} WHERE r.seller_id=$1 AND r.id=$2`,
      [sellerId, reviewId],
    )
  ).rows[0];
  const item = row ? project(row) : null;
  if (!item) throw new SellerError("NOT_FOUND");
  return item;
}
export async function readInquiryQueue(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  query: { sellerId: string; status?: string; before?: string; q?: string },
): Promise<InquiryQueue> {
  if (query.q !== undefined && typeof query.q !== "string")
    throw new SellerError("INVALID_INPUT");
  const status = query.status ?? "open",
    q = (query.q ?? "").trim();
  if (
    !validId(query.sellerId) ||
    (!["open", "all"].includes(status) && !isInquiryStatus(status)) ||
    (query.before !== undefined && !validId(query.before)) ||
    (typeof query.q !== "undefined" && typeof query.q !== "string") ||
    q.length > 80
  )
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const access = await authorizeSeller(
      tx,
      identity,
      query.sellerId,
      "inbox.read",
    );
    if (
      query.before &&
      (
        await tx.client.query(
          `SELECT r.id ${sentFrom} WHERE r.seller_id=$1 AND r.id=$2`,
          [query.sellerId, query.before],
        )
      ).rowCount !== 1
    )
      throw new SellerError("INVALID_INPUT");
    const rows = (
      await tx.client.query<Stored>(
        `SELECT ${columns} ${sentFrom}
      WHERE r.seller_id=$1 AND ($2='all' OR ($2='open' AND coalesce(state.status,'new') NOT IN ('resolved','closed')) OR coalesce(state.status,'new')=$2)
      AND ($3::uuid IS NULL OR (m.created_at,r.id)<(SELECT am.created_at,ar.id FROM treido.purchase_reviews ar JOIN treido.messages am ON am.request_id=ar.id AND am.author_id=ar.buyer_id JOIN treido.conversation_threads at ON at.id=am.thread_id AND at.seller_id=ar.seller_id AND at.buyer_id=ar.buyer_id AND at.listing_id=(SELECT listing_id FROM treido.purchase_review_lines WHERE review_id=ar.id AND position=0) WHERE ar.id=$3 AND ar.seller_id=$1))
      AND ($4='' OR EXISTS(SELECT 1 FROM treido.purchase_review_lines l WHERE l.review_id=r.id AND strpos(lower(translate(l.title,'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')),lower(translate($4,'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')))>0))
      ORDER BY m.created_at DESC,r.id DESC LIMIT 21`,
        [query.sellerId, status, query.before ?? null, q],
      )
    ).rows;
    const page = rows.slice(0, 20);
    return {
      actorKey: libraryActorKey(identity),
      sellerId: query.sellerId,
      canManage: access.context.capabilities.includes("inbox.reply"),
      items: page
        .map(project)
        .filter((item): item is InquiryItem => item !== null),
      nextBefore: rows.length > 20 ? page.at(-1)!.id : null,
    };
  });
}
export async function readInquiryDetail(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  reviewId: string,
): Promise<InquiryDetail> {
  return inTransaction(database, async (tx) => {
    const seller = await authorizeSeller(tx, identity, sellerId, "inbox.read");
    const item = await readSentInquiryInTransaction(tx, sellerId, reviewId);
    const access = await authorizeConversation(
      tx,
      identity,
      item.threadId,
      false,
      { sellerId },
    );
    const history = (
      await tx.client.query<{
        revision: number;
        kind: "status" | "reply";
        from: InquiryItem["status"];
        to: InquiryItem["status"];
        at: Date;
        own: boolean;
      }>(
        `SELECT accepted_revision AS revision,kind,from_status AS "from",to_status AS "to",created_at AS at,actor_id=$3 AS own FROM treido.merchant_inquiry_receipts WHERE seller_id=$1 AND review_id=$2 ORDER BY accepted_revision DESC LIMIT 50`,
        [sellerId, reviewId, seller.user.id],
      )
    ).rows;
    return {
      actorKey: libraryActorKey(identity),
      item,
      canManage: seller.context.capabilities.includes("inbox.reply"),
      canReply: access.canReply,
      history: history.map((event) => ({
        ...event,
        at: event.at.toISOString(),
      })),
    };
  });
}

/** Bounded analytics projection; caller holds current analytics.read and
 * inbox.read authority on this transaction. Reuses the exact sent-message hash
 * check above rather than counting unsent reviews or arbitrary retry IDs. */
export async function readInquiryInsightRows(
  tx: SellerTransaction,
  sellerId: string,
  query: {
    from: string;
    until: string;
    status: string;
    q: string;
    limit: number;
  },
) {
  if (
    !validId(sellerId) ||
    !Number.isInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 2000 ||
    (query.status !== "all" && !isInquiryStatus(query.status)) ||
    query.q.length > 80 ||
    !Number.isFinite(Date.parse(query.from)) ||
    !Number.isFinite(Date.parse(query.until))
  )
    throw new SellerError("INVALID_INPUT");
  const rows = (
    await tx.client.query<Stored>(
      `SELECT ${columns} ${sentFrom}
     WHERE r.seller_id=$1 AND m.created_at >= $2::timestamptz AND m.created_at < $3::timestamptz
       AND ($4='all' OR coalesce(state.status,'new')=$4)
       AND ($5='' OR strpos(r.id::text,$5)>0 OR EXISTS(
         SELECT 1 FROM treido.purchase_review_lines line WHERE line.review_id=r.id AND
         strpos(lower(translate(line.title,'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')),
         lower(translate($5,'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')))>0))
     ORDER BY m.created_at DESC,r.id DESC LIMIT $6`,
      [
        sellerId,
        query.from,
        query.until,
        query.status,
        query.q,
        query.limit + 1,
      ],
    )
  ).rows;
  // Refuse an over-limit candidate set even if invalid message hashes would
  // reduce the displayed subset. A partial scan is never an exact total/export.
  return {
    overflow: rows.length > query.limit,
    items: rows
      .slice(0, query.limit)
      .map(project)
      .filter((item): item is InquiryItem => item !== null)
      .map((item) => ({
        id: item.id,
        title: (item.lines[0]?.title ?? "").slice(0, 180),
        at: item.sentAt,
        status: item.status,
      })),
  };
}
