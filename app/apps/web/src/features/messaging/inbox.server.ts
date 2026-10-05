import {
  caseStorageReady,
  messageHiddenSql,
  messageReasonSql,
} from "../trust/case-storage.server";
import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  authorizeHuman,
  authorizeSeller,
  inputHash,
} from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { authorizeConversation } from "./conversation-access.server";
import {
  inboxLimits,
  parseInboxQuery,
  parseConversationQuery,
  parseContactCommand,
  type InboxView,
  type InboxItem,
  type ConversationView,
  type ConversationMessage,
} from "./inbox-model";

function cursorPosition(cursor: string | null, scope: string) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      value.scope !== scope ||
      !validId(value.id) ||
      typeof value.at !== "string" ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$/.test(
        value.at,
      ) ||
      !Number.isFinite(Date.parse(value.at))
    )
      throw Error();
    return { id: value.id as string, at: value.at as string };
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
}
export async function readInbox(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
): Promise<InboxView> {
  const query = parseInboxQuery(input);
  if (!query) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      // A verified new buyer has no messages; a GET must not create a user/seller.
      if (
        query.sellerId === null &&
        error instanceof SellerError &&
        error.code === "NOT_FOUND"
      )
        return { items: [], nextCursor: null, query };
      throw error;
    }
    if (query.sellerId)
      await authorizeSeller(tx, identity, query.sellerId, "inbox.read");
    const scope = inputHash({
      userId: user.id,
      sellerId: query.sellerId,
      q: query.q,
      filter: query.filter,
    });
    const position = cursorPosition(query.cursor, scope);
    const moderationReady = await caseStorageReady(tx);
    const rows = (
      await tx.client.query<InboxItem>(
        `SELECT c.id,c.listing_id AS "listingId",CASE WHEN l.moderation_state='clear' THEN coalesce(d.payload->>'title','') ELSE NULL END AS title,
        s.name AS "sellerName",s.kind AS "sellerKind",coalesce(last.body,'') AS "lastBody",last.offer_event_id IS NOT NULL AS "lastOffer",
        to_char(c.last_message_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "lastAt",
        unread.count AS unread,(contact.buyer_blocked OR contact.seller_blocked) AS blocked
       FROM treido.conversation_threads c JOIN treido.seller_accounts s ON s.id=c.seller_id
       JOIN treido.listings l ON l.seller_id=c.seller_id AND l.id=c.listing_id
       LEFT JOIN treido.listing_publications d ON d.seller_id=c.seller_id AND d.listing_id=c.listing_id AND d.revision=l.current_publication_revision
       JOIN treido.contact_preferences contact ON contact.seller_id=c.seller_id AND contact.buyer_id=c.buyer_id
       LEFT JOIN treido.conversation_read_cursors r ON r.thread_id=c.id AND r.user_id=$1
       LEFT JOIN LATERAL (SELECT CASE WHEN ${messageHiddenSql(moderationReady, "last_message")} THEN '' ELSE last_message.body END AS body,offer_event_id FROM treido.messages last_message WHERE thread_id=c.id ORDER BY sequence DESC LIMIT 1) last ON true
       CROSS JOIN LATERAL (SELECT count(*)::int AS count FROM treido.messages m WHERE m.thread_id=c.id
         AND m.sequence>coalesce(r.last_sequence,0) AND CASE WHEN $2::uuid IS NULL THEN m.author_id<>c.buyer_id ELSE m.author_id=c.buyer_id END) unread
       WHERE CASE WHEN $2::uuid IS NULL THEN c.buyer_id=$1 ELSE c.seller_id=$2 AND c.buyer_id<>$1 END
         AND ($3='' OR position(lower($3) in lower(CASE WHEN l.moderation_state='clear' THEN coalesce(d.payload->>'title','') ELSE '' END || ' ' || s.name))>0)
         AND ($4='all' OR unread.count>0)
         AND ($5::timestamptz IS NULL OR (c.last_message_at,c.id)<($5::timestamptz,$6::uuid))
       ORDER BY c.last_message_at DESC,c.id DESC LIMIT 31`,
        [
          user.id,
          query.sellerId,
          query.q,
          query.filter,
          position?.at ?? null,
          position?.id ?? null,
        ],
      )
    ).rows;
    const items = rows.slice(0, inboxLimits.page),
      last = items.at(-1);
    return {
      items,
      query,
      nextCursor:
        rows.length > inboxLimits.page && last
          ? Buffer.from(
              JSON.stringify({ scope, at: last.lastAt, id: last.id }),
            ).toString("base64url")
          : null,
    };
  });
}
export async function readConversation(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
): Promise<ConversationView> {
  const query = parseConversationQuery(input);
  if (!query) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const access = await authorizeConversation(
      tx,
      identity,
      query.threadId,
      false,
      { sellerId: query.sellerId },
    );
    const { thread, user, contact, side } = access;
    const moderationReady = await caseStorageReady(tx);
    const hidden = messageHiddenSql(moderationReady);
    const listing = (
      await tx.client.query<{ title: string; sellerName: string }>(
        `SELECT coalesce(d.payload->>'title','') AS title,s.name AS "sellerName" FROM treido.listings l JOIN treido.seller_accounts s ON s.id=l.seller_id LEFT JOIN treido.listing_publications d ON d.seller_id=l.seller_id AND d.listing_id=l.id AND d.revision=l.current_publication_revision WHERE l.id=$1 AND l.seller_id=$2`,
        [thread.listingId, thread.sellerId],
      )
    ).rows[0];
    const rows = (
      await tx.client.query<ConversationMessage>(
        `SELECT m.id,m.sequence,CASE WHEN ${hidden} THEN '' ELSE m.body END AS body,${hidden} AS "moderationHidden",${messageReasonSql(moderationReady)} AS "moderationReason",CASE WHEN m.author_id=$2 THEN 'buyer' ELSE 'seller' END AS "from",m.author_id=$3 AS mine,
        to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
        CASE WHEN ${hidden} THEN 0 ELSE (SELECT count(*)::int FROM treido.message_attachment_links a WHERE a.message_id=m.id) END AS attachments,
        (SELECT jsonb_build_object('kind',e.kind,'unitPriceMinor',o.unit_price_minor,'quantity',o.quantity,'currency',o.currency) FROM treido.offer_events e JOIN treido.listing_offers o ON o.thread_id=e.thread_id AND o.id=e.offer_id WHERE e.thread_id=m.thread_id AND e.id=m.offer_event_id) AS offer
       FROM treido.messages m WHERE m.thread_id=$1 AND ($4::int IS NULL OR m.sequence<$4) ORDER BY m.sequence DESC LIMIT 51`,
        [thread.id, thread.buyerId, user.id, query.before],
      )
    ).rows;
    const messages = rows.slice(0, inboxLimits.messages).reverse();
    const read = (
      await tx.client.query<{ sequence: number }>(
        "SELECT last_sequence AS sequence FROM treido.conversation_read_cursors WHERE thread_id=$1 AND user_id=$2",
        [thread.id, user.id],
      )
    ).rows[0];
    return {
      id: thread.id,
      listingId: thread.listingId,
      sellerId: thread.sellerId,
      title: access.titleVisible ? (listing?.title ?? "") : null,
      sellerName: listing?.sellerName ?? "",
      side,
      canReply: access.canReply,
      canBlock: access.canBlock,
      blockedByYou:
        side === "buyer" ? contact.buyerBlocked : contact.sellerBlocked,
      blockedByOther:
        side === "buyer" ? contact.sellerBlocked : contact.buyerBlocked,
      contactRevision: contact.revision,
      lastSequence: thread.nextSequence - 1,
      readSequence: read?.sequence ?? 0,
      messages,
      olderBefore:
        rows.length > inboxLimits.messages ? messages[0].sequence : null,
    };
  });
}
export async function markConversationRead(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
) {
  return inTransaction(database, (tx) =>
    markConversationReadInTransaction(tx, identity, input),
  );
}
/** Shared by notification acknowledgments; caller owns the same transaction. */
export async function markConversationReadInTransaction(
  tx: import("../../server/db/database").SellerTransaction,
  identity: VerifiedIdentity,
  input: unknown,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new SellerError("INVALID_INPUT");
  const value = input as Record<string, unknown>;
  const query = parseConversationQuery({
    sellerId: value.sellerId,
    threadId: value.threadId,
  });
  if (
    !query ||
    Object.keys(value).some(
      (k) => !["sellerId", "threadId", "sequence"].includes(k),
    ) ||
    !Number.isSafeInteger(value.sequence) ||
    Number(value.sequence) < 0
  )
    throw new SellerError("INVALID_INPUT");
  const { thread, user } = await authorizeConversation(
    tx,
    identity,
    query.threadId,
    false,
    { sellerId: query.sellerId },
  );
  if (Number(value.sequence) >= thread.nextSequence)
    throw new SellerError("INVALID_INPUT");
  const row = (
    await tx.client.query<{ sequence: number }>(
      `INSERT INTO treido.conversation_read_cursors(thread_id,user_id,last_sequence) VALUES($1,$2,$3)
       ON CONFLICT(thread_id,user_id) DO UPDATE SET last_sequence=greatest(treido.conversation_read_cursors.last_sequence,excluded.last_sequence),updated_at=clock_timestamp() RETURNING last_sequence AS sequence`,
      [thread.id, user.id, value.sequence],
    )
  ).rows[0];
  return row;
}
export async function setContactBlocked(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
) {
  const data = parseContactCommand(input);
  if (!data) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const { thread, user, side, contact } = await authorizeConversation(
      tx,
      identity,
      data.threadId,
      "contact",
      { sellerId: data.sellerId },
    );
    const hash = inputHash(data);
    const previous = (
      await tx.client.query<{ hash: string; revision: number }>(
        "SELECT input_hash AS hash,accepted_revision AS revision FROM treido.contact_preference_receipts WHERE seller_id=$1 AND buyer_id=$2 AND actor_id=$3 AND request_id=$4",
        [thread.sellerId, thread.buyerId, user.id, data.requestId],
      )
    ).rows[0];
    if (previous) {
      if (previous.hash !== hash || previous.revision !== contact.revision)
        throw new SellerError("CONFLICT");
      return { revision: previous.revision };
    }
    if (contact.revision !== data.expectedRevision)
      throw new SellerError("CONFLICT");
    const column = side === "buyer" ? "buyer_blocked" : "seller_blocked";
    const existing =
      side === "buyer" ? contact.buyerBlocked : contact.sellerBlocked;
    const revision = contact.revision + (existing === data.blocked ? 0 : 1);
    await tx.client.query(
      "UPDATE treido.contact_preferences SET " +
        column +
        "=$3,revision=$4,updated_at=clock_timestamp() WHERE seller_id=$1 AND buyer_id=$2",
      [thread.sellerId, thread.buyerId, data.blocked, revision],
    );
    await tx.client.query(
      "INSERT INTO treido.contact_preference_receipts(seller_id,buyer_id,actor_id,request_id,input_hash,accepted_revision) VALUES($1,$2,$3,$4,$5,$6)",
      [
        thread.sellerId,
        thread.buyerId,
        user.id,
        data.requestId,
        hash,
        revision,
      ],
    );
    return { revision };
  });
}
