import "server-only";
import type { PoolClient } from "pg";
import { PRIVACY_LIMITS, PrivacyError } from "./model";
/** Explicit own-authored metadata only: text/content is outside the currently
 * reviewed supported snapshot. A prior business membership grants no export. */
export async function ownCommunicationMetadata(
  client: Pick<PoolClient, "query">,
  userId: string,
) {
  const transport = (
    await client.query<{ ready: boolean; transport: boolean; columns: number }>(
      `SELECT to_regclass('treido.message_image_tombstones') IS NOT NULL AS ready,
       to_regclass('treido.message_attachment_objects') IS NOT NULL AS transport,
       (SELECT count(*)::integer FROM information_schema.columns WHERE table_schema='treido' AND table_name='message_attachments' AND column_name IN('width','height','operating_seller_id')) AS columns`,
    )
  ).rows[0];
  // Historical fixtures retain their original supported subset. A partial new
  // installation is unavailable, not an empty successful communication export.
  if (!transport?.transport) return [];
  if (transport.columns !== 3) throw new PrivacyError("NOT_AVAILABLE");
  const ready = transport.ready;
  const state = ready
    ? "CASE WHEN EXISTS(SELECT 1 FROM treido.message_image_tombstones x WHERE x.attachment_id=a.id) THEN 'unavailable' ELSE a.state END"
    : "a.state";
  return (
    await client.query<Record<string, unknown>>(
      `SELECT * FROM (
      SELECT 'ownCommunicationMetadataV1'::text AS kind,m.id,m.thread_id AS "threadId",m.sequence,m.created_at AS "createdAt",NULL::text AS state,
        (SELECT count(*)::integer FROM treido.message_attachment_links l WHERE l.message_id=m.id) AS "imageCount",NULL::integer AS width,NULL::integer AS height
      FROM treido.messages m JOIN treido.conversation_threads t ON t.id=m.thread_id JOIN treido.seller_accounts s ON s.id=t.seller_id
      WHERE m.author_id=$1 AND (t.buyer_id=$1 OR (s.kind='personal' AND EXISTS(SELECT 1 FROM treido.personal_seller_owners p WHERE p.seller_id=s.id AND p.user_id=$1)))
      UNION ALL
      SELECT 'ownMessageImageMetadataV1',a.id,a.thread_id,NULL,a.created_at,${state},NULL,a.width,a.height
      FROM treido.message_attachments a JOIN treido.conversation_threads t ON t.id=a.thread_id
      WHERE a.created_by=$1 AND ((a.operating_seller_id IS NULL AND t.buyer_id=$1) OR EXISTS(SELECT 1 FROM treido.personal_seller_owners p JOIN treido.seller_accounts s ON s.id=p.seller_id AND s.kind='personal' WHERE p.user_id=$1 AND p.seller_id=a.operating_seller_id))
    ) owned ORDER BY "createdAt" DESC,kind,id LIMIT $2`,
      [userId, PRIVACY_LIMITS.rows + 1],
    )
  ).rows;
}
