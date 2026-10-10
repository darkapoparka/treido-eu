import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { SupportUpdate, SupportUpdateFeed } from "./updates-model";

const limit = 20;
const source = `FROM treido.support_notifications n
 JOIN treido.support_tickets t ON t.id=n.ticket_id AND t.requester_id=n.user_id
 JOIN treido.support_entries e ON e.ticket_id=n.ticket_id AND e.sequence=n.sequence
 LEFT JOIN treido.support_read_cursors c ON c.ticket_id=n.ticket_id AND c.user_id=n.user_id
 WHERE n.user_id=$1 AND t.requester_id=$1 AND e.audience='requester' AND e.author_side='operator'`;

/** Called within the current human's notification transaction. An internal
 * operator note cannot supply a title, unread update, timestamp or deep link. */
export async function readSupportUpdates(
  tx: SellerTransaction,
  userId: string | null,
  query: { filter: "all" | "unread"; q: string },
): Promise<SupportUpdateFeed> {
  const ready = (
    await tx.client.query<{ ready: boolean }>(
      `SELECT count(*)=4 AS ready FROM unnest(ARRAY['support_tickets','support_entries','support_notifications','support_read_cursors']) name WHERE to_regclass('treido.'||name) IS NOT NULL`,
    )
  ).rows[0]?.ready === true;
  const empty: SupportUpdateFeed = {
    available: ready,
    items: [],
    unreadCount: 0,
    hasMore: false,
  };
  if (!ready || userId === null) return empty;
  const rows = (
    await tx.client.query<SupportUpdate>(
      `SELECT * FROM (
       SELECT DISTINCT ON(n.ticket_id) n.ticket_id AS "ticketId",n.sequence,t.title,t.state,
        to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
        n.sequence>coalesce(c.sequence,0) AS unread
       ${source}
       AND ($2='all' OR n.sequence>coalesce(c.sequence,0))
       AND ($3='' OR strpos(lower(translate(t.title,'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')),lower(translate($3,'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')))>0)
       ORDER BY n.ticket_id,n.sequence DESC
      ) latest ORDER BY at DESC,"ticketId" DESC LIMIT $4`,
      [userId, query.filter, query.q, limit + 1],
    )
  ).rows;
  const unreadCount = (
    await tx.client.query<{ count: number }>(
      `SELECT count(DISTINCT n.ticket_id)::int AS count ${source} AND n.sequence>coalesce(c.sequence,0)`,
      [userId],
    )
  ).rows[0].count;
  return {
    available: true,
    items: rows.slice(0, limit),
    unreadCount,
    hasMore: rows.length > limit,
  };
}
