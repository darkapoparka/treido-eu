import "server-only";
import { createHash } from "node:crypto";
import type { SellerDatabase } from "../../server/db/database";
import type { MediaStorage } from "../../server/media/storage.server";
import { SellerError } from "../sellers/errors";
import { parseDraftPayload, validId } from "../selling/draft-model";
import { parsePublicationTerms } from "../selling/publish-model";
import { MEDIA_LIMITS } from "../selling/media-model";
import {
  publishedJoins,
  publishedEligibility,
} from "./publication-eligibility.server";
import type { PublishedListing } from "./published-model";
export async function readPublishedListing(
  database: SellerDatabase,
  listingId: string,
): Promise<PublishedListing | null> {
  if (!validId(listingId)) return null;
  const row = (
    await database.pool.query<{
      id: string;
      sellerId: string;
      sellerName: string;
      sellerKind: "personal" | "business";
      revision: number;
      publishedAt: Date;
      payload: unknown;
      terms: unknown;
      photos: { id: string; width: number; height: number }[];
    }>(
      `SELECT l.id,s.id AS "sellerId",s.name AS "sellerName",s.kind AS "sellerKind",p.revision,p.created_at AS "publishedAt",p.payload,p.terms,
    (SELECT jsonb_agg(jsonb_build_object('id',pm.asset_id,'width',pm.width,'height',pm.height) ORDER BY pm.position)
      FROM treido.listing_publication_media pm WHERE pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision) AS photos
    ${publishedJoins} WHERE l.id=$1 AND ${publishedEligibility}`,
      [listingId],
    )
  ).rows[0];
  if (!row) return null;
  const payload = parseDraftPayload(row.payload),
    terms = parsePublicationTerms(row.terms);
  if (
    !payload ||
    !payload.categoryId ||
    payload.priceMinor === null ||
    !terms ||
    !row.photos?.length ||
    row.photos.length > 12
  )
    return null;
  return {
    id: row.id,
    revision: row.revision,
    publishedAt: row.publishedAt.toISOString(),
    seller: { id: row.sellerId, name: row.sellerName, kind: row.sellerKind },
    title: payload.title,
    description: payload.description,
    categoryId: payload.categoryId,
    condition: payload.condition,
    fields: payload.fields,
    price: { amount: payload.priceMinor, currency: payload.currency },
    locality: payload.locality,
    country: terms.country,
    handover: terms.handover,
    deliveryDetails: terms.deliveryDetails,
    defects: terms.defects,
    purchaseMode: "contact",
    photos: row.photos.map((photo) => ({
      ...photo,
      url:
        "/api/listing-media/" + row.id + "/" + photo.id + "?v=" + row.revision,
    })),
  };
}
export async function readPublicMedia(
  database: SellerDatabase,
  listingId: string,
  assetId: string,
  revision: number,
) {
  if (
    !validId(listingId) ||
    !validId(assetId) ||
    !Number.isSafeInteger(revision) ||
    revision < 2
  )
    throw new SellerError("NOT_FOUND");
  const row = (
    await database.pool.query<{
      key: string;
      checksum: string;
      revision: number;
    }>(
      `SELECT a.derivative_key AS key,pm.checksum,pm.asset_revision AS revision ${publishedJoins}
      JOIN treido.listing_publication_media pm ON pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision
      JOIN treido.media_assets a ON a.id=pm.asset_id
      WHERE l.id=$1 AND pm.asset_id=$2 AND p.revision=$3 AND ${publishedEligibility}`,
      [listingId, assetId, revision],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  return row;
}
/** Permission is evaluated both before and after storage; stale URLs cannot disclose replacement photos. */
export async function readPublishedPhoto(
  database: SellerDatabase,
  storage: Pick<MediaStorage, "read">,
  listingId: string,
  assetId: string,
  revision: number,
) {
  const first = await readPublicMedia(database, listingId, assetId, revision);
  const bytes = await storage.read(first.key, MEDIA_LIMITS.bytes);
  if (
    bytes.byteLength > MEDIA_LIMITS.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== first.checksum
  )
    throw new SellerError("NOT_AVAILABLE");
  const current = await readPublicMedia(database, listingId, assetId, revision);
  if (
    current.key !== first.key ||
    current.checksum !== first.checksum ||
    current.revision !== first.revision
  )
    throw new SellerError("NOT_FOUND");
  return bytes;
}
