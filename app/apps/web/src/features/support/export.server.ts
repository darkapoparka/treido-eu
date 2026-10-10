import "server-only";
import type { PoolClient } from "pg";
import { PRIVACY_LIMITS } from "../account-privacy/model";
/** Own requests and addressed replies only; never operator notes or another person's case. */
export async function ownSupportExport(
  client: Pick<PoolClient, "query">,
  userId: string,
) {
  const ready = (
    await client.query<{ ready: boolean }>(
      "SELECT to_regclass('treido.support_tickets') IS NOT NULL AS ready",
    )
  ).rows[0]?.ready;
  if (!ready) return [];
  return (
    await client.query<Record<string, unknown>>(
      `SELECT 'ownSupportEntryV1' AS kind,t.id AS "supportTicketId",t.title AS "supportTitle",t.topic AS "supportTopic",t.state,e.sequence,e.author_side AS "supportAuthorSide",e.kind AS "supportEntryKind",e.body AS "supportBody",e.created_at AS "createdAt"
      FROM treido.support_tickets t JOIN treido.support_entries e ON e.ticket_id=t.id
      WHERE t.requester_id=$1 AND e.audience='requester' ORDER BY e.created_at DESC,t.id,e.sequence LIMIT $2`,
      [userId, PRIVACY_LIMITS.rows + 1],
    )
  ).rows;
}
