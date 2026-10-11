import "server-only";
import { inTransaction, type SellerDatabase, type SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "./persistence.server";
import { SellerError } from "./errors";
import { validId } from "../selling/draft-model";
import { publishedJoins, publishedEligibility } from "../catalog/publication-eligibility.server";
import { publicInventoryJoin, publicInventoryPrice } from "../inventory/public-sql";
import { publicListingCard, type CardRow } from "../catalog/public-discovery.server";

export type CatalogPublicGroup = { id: string; title: string; description: string; sellerId: string; sellerName: string; visible: boolean; publicAvailable: boolean };
const pageSize = 30;
async function projectCollection(client: SellerTransaction["client"] | SellerDatabase["pool"], sellerId: string, collectionId: string, after: string | undefined, preview: boolean) {
  if (!validId(sellerId) || !validId(collectionId) || (after !== undefined && !validId(after))) throw new SellerError("INVALID_INPUT");
  const result = (await client.query<{ collection: CatalogPublicGroup | null; total: number; items: CardRow[] }>(
    `WITH eligible_store AS (
       SELECT EXISTS(SELECT 1 ${publishedJoins} WHERE s.id=$1 AND ${publishedEligibility}) AS available
     ), grouping AS MATERIALIZED (
       SELECT g.id,g.title,g.description,g.seller_id AS "sellerId",sa.name AS "sellerName",g.visible,
         (g.visible AND available) AS "publicAvailable"
       FROM treido.seller_catalog_collections g JOIN treido.seller_accounts sa ON sa.id=g.seller_id
       CROSS JOIN eligible_store
       WHERE g.seller_id=$1 AND g.id=$2 AND NOT g.archived AND sa.status='active'
         AND ($4::boolean OR (g.visible AND available))
     ), matched AS MATERIALIZED (
       SELECT l.id,s.id AS "sellerId",s.name AS "sellerName",s.kind AS "sellerKind",p.revision,
         p.payload->>'title' AS title,(${publicInventoryPrice})::integer AS "priceMinor",
         p.category_id AS "categoryId",p.payload->>'condition' AS condition,coalesce(p.payload->>'locality','') AS locality,
         p.created_at::text AS "createdAt",0 AS rank,
         (SELECT pm.asset_id FROM treido.listing_publication_media pm WHERE pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision ORDER BY pm.position,pm.asset_id LIMIT 1) AS "photoId",
         coalesce(stock.price_from,false) AS "priceFrom",coalesce(stock.state,'unknown') AS "stockState"
       ${publishedJoins} ${publicInventoryJoin}
       JOIN grouping g ON g."sellerId"=l.seller_id
       JOIN treido.seller_catalog_collection_items ci ON ci.seller_id=l.seller_id AND ci.listing_id=l.id AND ci.collection_id=g.id
       WHERE ${publishedEligibility} AND p.payload->>'currency'='EUR'
     ), selected AS (SELECT * FROM matched WHERE $3::uuid IS NULL OR id>$3::uuid ORDER BY id LIMIT 31)
     SELECT (SELECT to_jsonb(g) FROM grouping g) AS collection,(SELECT count(*)::integer FROM matched) AS total,
       coalesce((SELECT jsonb_agg(to_jsonb(selected) ORDER BY id) FROM selected),'[]'::jsonb) AS items`,
    [sellerId, collectionId, after ?? null, preview],
  )).rows[0];
  if (!result?.collection) return null;
  if (!Array.isArray(result.items) || !Number.isSafeInteger(result.total)) throw new SellerError("NOT_AVAILABLE");
  return { collection: result.collection, total: result.total, items: result.items.slice(0, pageSize).map(publicListingCard),
    nextAfter: result.items.length > pageSize ? result.items[pageSize - 1].id : null };
}
/** No preview flag is accepted from a public request. Only opted-in groups and accepted eligible publications are projected. */
export function readPublicCatalogCollection(database: SellerDatabase, sellerId: string, collectionId: string, after?: string) {
  return projectCollection(database.pool, sellerId, collectionId, after, false);
}
export function readPrivateCatalogPreview(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, collectionId: string, after?: string) {
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    // Preview may show the seller's hidden group, never its drafts or restricted products.
    return projectCollection(tx.client, sellerId, collectionId, after, true);
  });
}
