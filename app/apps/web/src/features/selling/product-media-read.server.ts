import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "./draft-model";

/** Merchant thumbnails remain readable after publication; editing remains draft-only. */
export async function readOwnedProductMedia(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  assetId: string,
) {
  if (!validId(assetId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    const asset = (await tx.client.query<{ key: string; checksum: string; storageScope: string | null }>(
      `SELECT m.derivative_key AS key,m.derivative_checksum AS checksum,m.storage_scope AS "storageScope"
       FROM treido.media_assets m JOIN treido.listings l ON l.seller_id=m.seller_id AND l.id=m.listing_id
       WHERE m.seller_id=$1 AND m.id=$2 AND m.state='ready'
         AND m.derivative_key IS NOT NULL AND m.derivative_checksum IS NOT NULL
         AND l.moderation_state='clear' AND l.publication IN ('draft','published','withdrawn')`,
      [sellerId, assetId],
    )).rows[0];
    if (!asset) throw new SellerError("NOT_FOUND");
    return asset;
  });
}
