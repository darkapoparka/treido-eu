import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { moderationSearch } from "./operations-context.server";
import {
  parseSellerModerationQuery,
  type SellerModerationItem,
} from "./operations-model";
/** Seller-visible communicated decisions only. No reporter identity, report text,
 * operator identity or another person's appeal is selected into this projection. */
export async function readSellerModerationQueue(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const query = parseSellerModerationQuery(raw);
  return inTransaction(database, async (tx) => {
    const access = await authorizeSeller(
      tx,
      identity,
      query.sellerId,
      "listing.read",
    );
    if (
      query.before &&
      !(
        await tx.client.query(
          "SELECT a.id FROM treido.moderation_actions a JOIN treido.listings l ON l.id=a.listing_id WHERE a.id=$1 AND l.seller_id=$2",
          [query.before, query.sellerId],
        )
      ).rowCount
    )
      throw new SellerError("INVALID_INPUT");
    const rows = (
      await tx.client.query<SellerModerationItem>(
        `SELECT l.id,p.payload->>'title' AS title,l.moderation_state AS state,l.moderation_revision AS revision,a.id AS "actionId",a.reason,
       to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
       (SELECT count(*)::int FROM treido.moderation_appeals x WHERE x.action_id=a.id AND x.actor_id=$2) AS "ownAppeals"
       FROM treido.listings l JOIN LATERAL (SELECT id,reason,created_at FROM treido.moderation_actions WHERE listing_id=l.id ORDER BY accepted_revision DESC LIMIT 1) a ON true
       LEFT JOIN treido.listing_publications p ON p.seller_id=l.seller_id AND p.listing_id=l.id AND p.revision=l.current_publication_revision
       WHERE l.seller_id=$1 AND ($3='all' OR l.moderation_state=$3)
       AND ($4='' OR ${moderationSearch("coalesce(p.payload->>'title','') || ' ' || a.reason", "$4")})
       AND ($5::uuid IS NULL OR (a.created_at,a.id)<(SELECT created_at,id FROM treido.moderation_actions WHERE id=$5))
       ORDER BY a.created_at DESC,a.id DESC LIMIT 21`,
        [query.sellerId, access.user.id, query.state, query.q, query.before],
      )
    ).rows;
    const counts = (
      await tx.client.query<{ restricted: number; removed: number }>(
        "SELECT count(*) FILTER(WHERE moderation_state='restricted')::int AS restricted,count(*) FILTER(WHERE moderation_state='removed')::int AS removed FROM treido.listings WHERE seller_id=$1",
        [query.sellerId],
      )
    ).rows[0];
    return {
      actorKey: libraryActorKey(identity),
      sellerName: access.seller.name,
      query,
      items: rows.slice(0, 20),
      nextBefore: rows.length > 20 ? rows[19].actionId : null,
      counts,
    };
  });
}
