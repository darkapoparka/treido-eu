import "server-only";
import { inTransaction, type SellerDatabase, type SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "./persistence.server";
import { SellerError } from "./errors";
import { validId } from "../selling/draft-model";
import { CATALOG_BATCH_SIZE, type CatalogCollection, type CatalogProduct, type ProductOrganization } from "./catalog-organization-model";

export type CatalogBrowse = { q?: string; after?: string; collectionId?: string; membersOnly?: boolean };
function browse(input: CatalogBrowse) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SellerError("INVALID_INPUT");
  if (input.q !== undefined && (typeof input.q !== "string" || input.q.length > 160)) throw new SellerError("INVALID_INPUT");
  for (const id of [input.after, input.collectionId]) if (id !== undefined && id !== "" && (typeof id !== "string" || !validId(id))) throw new SellerError("INVALID_INPUT");
  if (input.membersOnly !== undefined && typeof input.membersOnly !== "boolean") throw new SellerError("INVALID_INPUT");
  return { q: input.q?.trim() ?? "", after: input.after?.toLowerCase() || null, collectionId: input.collectionId?.toLowerCase() || null, membersOnly: input.membersOnly ?? false };
}
const collectionColumns = `c.id,c.title,c.description,c.visible,c.archived,c.revision,
  c.updated_at::text AS "updatedAt",
  (SELECT count(*)::int FROM treido.seller_catalog_collection_items ci WHERE ci.seller_id=c.seller_id AND ci.collection_id=c.id) AS "productCount"`;
export async function catalogCollectionInTransaction(tx: SellerTransaction, sellerId: string, collectionId: string): Promise<CatalogCollection> {
  if (!validId(collectionId)) throw new SellerError("INVALID_INPUT");
  const collection = (await tx.client.query<CatalogCollection>(
    `SELECT ${collectionColumns} FROM treido.seller_catalog_collections c WHERE c.seller_id=$1 AND c.id=$2 AND NOT c.archived`, [sellerId, collectionId],
  )).rows[0];
  if (!collection) throw new SellerError("NOT_FOUND");
  return collection;
}
export async function readCatalogCollections(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, input: CatalogBrowse = {}) {
  const query = browse(input);
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    // Keep PostgreSQL microseconds; a JavaScript Date would truncate the anchor
    // and skip same-millisecond collections on the next page.
    const anchor = query.after ? (await tx.client.query<{ at: string }>(
      "SELECT updated_at::text AS at FROM treido.seller_catalog_collections WHERE seller_id=$1 AND id=$2 AND NOT archived", [sellerId, query.after],
    )).rows[0] : null;
    if (query.after && !anchor) throw new SellerError("INVALID_INPUT");
    const items = (await tx.client.query<CatalogCollection>(
      `SELECT ${collectionColumns} FROM treido.seller_catalog_collections c
       WHERE c.seller_id=$1 AND NOT c.archived AND ($2='' OR strpos(lower(c.title),lower($2))>0)
       AND ($3::timestamptz IS NULL OR (c.updated_at,c.id)<($3::timestamptz,$4::uuid))
       ORDER BY c.updated_at DESC,c.id DESC LIMIT 31`, [sellerId, query.q, anchor?.at ?? null, query.after],
    )).rows;
    return { items: items.slice(0, CATALOG_BATCH_SIZE), nextCursor: items.length > CATALOG_BATCH_SIZE ? items[CATALOG_BATCH_SIZE - 1].id : null };
  });
}
export async function readCatalogCollection(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, collectionId: string) {
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    return catalogCollectionInTransaction(tx, sellerId, collectionId);
  });
}
export async function readCatalogProducts(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, input: CatalogBrowse = {}) {
  const query = browse(input);
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    if (query.collectionId) await catalogCollectionInTransaction(tx, sellerId, query.collectionId);
    const result = (await tx.client.query<{ total: number; items: CatalogProduct[] }>(
      `WITH matched AS MATERIALIZED (
        SELECT l.id,coalesce(d.payload->>'title','') AS title,
          CASE WHEN l.moderation_state<>'clear' THEN 'restricted' ELSE l.publication END AS publication,
          d.revision,coalesce(o.revision,0) AS "organizationRevision",
          (d.payload->>'priceMinor')::integer AS "priceMinor",coalesce(o.tags,'{}'::text[]) AS tags,
          (SELECT m.id FROM treido.media_assets m WHERE m.seller_id=l.seller_id AND m.listing_id=l.id AND m.state='ready' ORDER BY m.position,m.id LIMIT 1) AS "mediaId",
          EXISTS(SELECT 1 FROM treido.seller_catalog_collection_items ci WHERE ci.seller_id=l.seller_id AND ci.listing_id=l.id AND ci.collection_id=$4::uuid) AS member
        FROM treido.listings l JOIN treido.listing_drafts d ON d.seller_id=l.seller_id AND d.listing_id=l.id
        LEFT JOIN treido.seller_catalog_product_organization o ON o.seller_id=l.seller_id AND o.listing_id=l.id
        WHERE l.seller_id=$1 AND ($2='' OR strpos(lower(coalesce(d.payload->>'title','')),lower($2))>0
          OR EXISTS(SELECT 1 FROM treido.inventory_skus sku WHERE sku.seller_id=l.seller_id AND sku.listing_id=l.id AND sku.active AND strpos(lower(coalesce(sku.seller_sku,'')),lower($2))>0)
          OR EXISTS(SELECT 1 FROM unnest(coalesce(o.tags,'{}'::text[])) tag WHERE strpos(lower(tag),lower($2))>0))
      ), filtered AS MATERIALIZED (SELECT * FROM matched WHERE NOT $5::boolean OR member),
      page AS (SELECT * FROM filtered WHERE $3::uuid IS NULL OR id>$3::uuid ORDER BY id LIMIT 31)
      SELECT (SELECT count(*)::integer FROM filtered) AS total,
        coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY id) FROM page),'[]'::jsonb) AS items`,
      [sellerId, query.q, query.after, query.collectionId, query.membersOnly],
    )).rows[0];
    return { total: result.total, items: result.items.slice(0, CATALOG_BATCH_SIZE), nextCursor: result.items.length > CATALOG_BATCH_SIZE ? result.items[CATALOG_BATCH_SIZE - 1].id : null };
  });
}
export async function readProductOrganization(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, listingId: string): Promise<ProductOrganization> {
  if (!validId(listingId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    const row = (await tx.client.query<ProductOrganization>(
      `SELECT l.id AS "listingId",coalesce(o.revision,0) AS revision,coalesce(o.tags,'{}'::text[]) AS tags,
        coalesce((SELECT array_agg(ci.collection_id ORDER BY ci.collection_id) FROM treido.seller_catalog_collection_items ci
          JOIN treido.seller_catalog_collections c ON c.seller_id=ci.seller_id AND c.id=ci.collection_id AND NOT c.archived
          WHERE ci.seller_id=l.seller_id AND ci.listing_id=l.id),'{}'::uuid[]) AS "collectionIds"
       FROM treido.listings l LEFT JOIN treido.seller_catalog_product_organization o ON o.seller_id=l.seller_id AND o.listing_id=l.id
       WHERE l.seller_id=$1 AND l.id=$2`, [sellerId, listingId],
    )).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    return row;
  });
}
