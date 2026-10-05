import {
  caseStorageReady,
  messageHiddenSql,
} from "../trust/case-storage.server";
import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, authorizeSeller } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import {
  parseNotificationQuery,
  NOTIFICATION_LIMIT,
  type NotificationFeed,
  type NotificationItem,
} from "./model";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from "./cursor.server";
import { readSearchMatchFeed } from "../saved-searches/feed.server";
import {
  searchActorKey,
  searchStorageReady,
} from "../saved-searches/storage.server";

// All rows originate in the existing transaction's content-free intent. This is
// an in-app read projection, not an email/push-delivery consumer or new queue.
const from = `FROM treido.message_notification_intents n
 JOIN treido.messages m ON m.thread_id=n.thread_id AND m.id=n.message_id
 JOIN treido.conversation_threads c ON c.id=m.thread_id
 JOIN treido.seller_accounts s ON s.id=c.seller_id
 JOIN treido.listings l ON l.id=c.listing_id AND l.seller_id=c.seller_id
 LEFT JOIN treido.listing_publications p ON p.listing_id=l.id AND p.seller_id=l.seller_id AND p.revision=l.current_publication_revision
 LEFT JOIN treido.conversation_read_cursors r ON r.thread_id=c.id AND r.user_id=$1`;
const scope = `CASE WHEN $2::uuid IS NULL THEN c.buyer_id=$1 AND n.recipient_side='buyer' AND m.author_id<>c.buyer_id
 AND NOT EXISTS(SELECT 1 FROM treido.personal_seller_owners own WHERE own.seller_id=c.seller_id AND own.user_id=$1)
 AND NOT EXISTS(SELECT 1 FROM treido.seller_memberships sm WHERE sm.seller_id=c.seller_id AND sm.user_id=$1 AND sm.status='active')
 ELSE c.seller_id=$2 AND c.buyer_id<>$1 AND n.recipient_side='seller' AND m.author_id=c.buyer_id END`;
async function feedUser(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string | null,
) {
  if (sellerId)
    return (await authorizeSeller(tx, identity, sellerId, "inbox.read")).user;
  try {
    return await authorizeHuman(tx, identity, false);
  } catch (error) {
    if (error instanceof SellerError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}
export async function readNotificationFeed(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<NotificationFeed> {
  const query = parseNotificationQuery(raw),
    actorKey = libraryActorKey(identity),
    position = decodeNotificationCursor(actorKey, query);
  return inTransaction(database, async (tx) => {
    const user = await feedUser(tx, identity, query.sellerId);
    const empty: NotificationFeed = {
      actorKey,
      sellerId: query.sellerId,
      query,
      items: [],
      nextBefore: null,
      unreadCount: 0,
    };
    if (!user) {
      if (
        query.sellerId === null &&
        (query.kind === "all" || query.kind === "search")
      )
        empty.matches = {
          items: [],
          nextCursor: null,
          unreadCount: 0,
          available: await searchStorageReady(tx),
        };
      return empty;
    }
    const matches =
      query.sellerId === null &&
      (query.kind === "all" || query.kind === "search")
        ? await readSearchMatchFeed(tx, user.id, searchActorKey(identity), {
            filter: query.filter,
            q: query.q,
            cursor: null,
          })
        : undefined;
    const hidden = messageHiddenSql(await caseStorageReady(tx));
    const ceiling =
      position?.ceiling ??
      (
        await tx.client.query<{ at: string }>(
          `SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at`,
        )
      ).rows[0].at;
    // Message identity/timestamp is immutable. A signed ceiling excludes newly
    // arriving updates from older pages without trusting a browser timestamp.
    const rows = (
      await tx.client.query<NotificationItem>(
        `SELECT m.id,c.id AS "threadId",m.sequence,
       CASE WHEN l.moderation_state='clear' THEN p.payload->>'title' ELSE NULL END AS title,
       s.name AS "sellerName",CASE WHEN l.moderation_state='clear' AND NOT (${hidden}) THEN left(m.body,240) ELSE '' END AS body,
       to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
       m.sequence>coalesce(r.last_sequence,0) AS unread,
       (SELECT e.kind FROM treido.offer_events e WHERE e.id=m.offer_event_id AND e.thread_id=c.id) AS "offerKind"
       ${from} WHERE ${scope}
       AND ($3='all' OR m.sequence>coalesce(r.last_sequence,0))
       AND ($4='all' OR ($4='offer')=(m.offer_event_id IS NOT NULL))
       AND $4<>'search'
       AND ($5='' OR strpos(lower(translate(CASE WHEN l.moderation_state='clear' THEN coalesce(p.payload->>'title','') ELSE '' END || ' ' || s.name,'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')),lower(translate($5,'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')))>0)
       AND m.created_at<=$6::timestamptz AND ($7::timestamptz IS NULL OR (m.created_at,m.id)<($7::timestamptz,$8::uuid))
       ORDER BY m.created_at DESC,m.id DESC LIMIT $9`,
        [
          user.id,
          query.sellerId,
          query.filter,
          query.kind,
          query.q,
          ceiling,
          position?.at ?? null,
          position?.id ?? null,
          NOTIFICATION_LIMIT + 1,
        ],
      )
    ).rows;
    const count = (
      await tx.client.query<{ count: number }>(
        `SELECT count(*)::int AS count ${from} WHERE ${scope} AND m.sequence>coalesce(r.last_sequence,0)`,
        [user.id, query.sellerId],
      )
    ).rows[0].count;
    const items = rows.slice(0, NOTIFICATION_LIMIT),
      last = items.at(-1);
    return {
      ...empty,
      items,
      unreadCount: count,
      ...(matches ? { matches } : {}),
      nextBefore:
        rows.length > NOTIFICATION_LIMIT && last
          ? encodeNotificationCursor(
              { id: last.id, at: last.at, ceiling },
              actorKey,
              query,
            )
          : null,
    };
  });
}
