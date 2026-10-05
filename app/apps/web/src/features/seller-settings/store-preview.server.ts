import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import {
  publishedEligibility,
  publishedJoins,
} from "../catalog/publication-eligibility.server";
import {
  projectSavedStorePreview,
  type SavedStorePreview,
  type SavedStorePreviewFields,
} from "./store-preview-model";

/** Uncached, read-only profile projection. Current membership stays locked
 * through the profile/eligibility query in this same read transaction. */
export async function readSavedBusinessStorePreview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
): Promise<SavedStorePreview> {
  if (!validId(sellerId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const { seller } = await authorizeSeller(
      tx,
      identity,
      sellerId,
      "profile.manage",
    );
    if (seller.kind !== "business") throw new SellerError("FORBIDDEN");
    const row = (
      await tx.client.query<Omit<SavedStorePreviewFields, "name">>(
        `SELECT coalesce(profile.description,'') AS description,
          coalesce(profile.locality,'') AS locality,
          (SELECT payload FROM treido.seller_service_settings
            WHERE seller_id=sa.id AND section='contact' AND payload->'published'='true'::jsonb) AS "rawContact",
          (SELECT payload FROM treido.seller_service_settings
            WHERE seller_id=sa.id AND section='delivery' AND payload->'published'='true'::jsonb) AS "rawDelivery",
          EXISTS(SELECT 1 ${publishedJoins}
            WHERE s.id=sa.id AND ${publishedEligibility}) AS "publicStoreAvailable"
         FROM treido.seller_accounts sa
         LEFT JOIN treido.seller_profiles profile ON profile.seller_id=sa.id
         WHERE sa.id=$1 LIMIT 1`,
        [seller.id],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_AVAILABLE");
    return projectSavedStorePreview(seller.id, { ...row, name: seller.name });
  });
}
