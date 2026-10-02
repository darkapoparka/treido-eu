import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { inspectPublication } from "./publication-facts.server";
import {
  parsePublishInput,
  policyAllowsContact,
  type PublishAcknowledgement,
} from "./publish-model";
export async function publishListing(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
): Promise<PublishAcknowledgement> {
  const data = parsePublishInput(input);
  if (!data) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const facts = await inspectPublication(
      tx,
      identity,
      data.sellerId,
      data.listingId,
      true,
    );
    const { access, row, payload, policy, declaration, assets, review } = facts;
    const hash = inputHash(data);
    const previous = (
      await tx.client.query<{
        revision: number;
        hash: string;
        publishedAt: Date;
      }>(
        'SELECT revision,input_hash AS hash,created_at AS "publishedAt" FROM treido.listing_publications WHERE seller_id=$1 AND listing_id=$2 AND actor_id=$3 AND request_id=$4',
        [data.sellerId, data.listingId, access.user.id, data.requestId],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.hash !== hash ||
        row.publication !== "published" ||
        row.currentRevision !== previous.revision
      )
        throw new SellerError("CONFLICT");
      if (review.readiness.status !== "allowed")
        throw new SellerError("NOT_AVAILABLE");
      return {
        listingId: data.listingId,
        revision: previous.revision,
        publishedAt: previous.publishedAt.toISOString(),
      };
    }
    if (
      row.revision !== data.expectedRevision ||
      row.publication === "published"
    )
      throw new SellerError("CONFLICT");
    if (review.readiness.reasonCodes.includes("PUBLICATION_QUOTA_EXCEEDED"))
      throw new SellerError("QUOTA_EXCEEDED");
    if (
      review.readiness.status !== "allowed" ||
      !policy ||
      !policyAllowsContact(
        policy.rules,
        access.seller.kind,
        payload.condition,
        data.terms,
      )
    )
      throw new SellerError("NOT_AVAILABLE");
    if (
      assets.length !== data.media.length ||
      assets.some(
        (a, i) =>
          a.id !== data.media[i].id || a.revision !== data.media[i].revision,
      )
    )
      throw new SellerError("CONFLICT");
    const revision = row.revision + 1;
    const inserted = await tx.client.query<{ createdAt: Date }>(
      'INSERT INTO treido.listing_publications(seller_id,listing_id,revision,draft_revision,actor_id,request_id,input_hash,payload,terms,seller_kind,registry_version,category_id,category_policy_version,country,declaration_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING created_at AS "createdAt"',
      [
        data.sellerId,
        data.listingId,
        revision,
        row.revision,
        access.user.id,
        data.requestId,
        hash,
        JSON.stringify(payload),
        JSON.stringify(data.terms),
        access.seller.kind,
        policy.registryVersion,
        payload.categoryId,
        policy.policyVersion,
        data.terms.country,
        access.seller.kind === "business" ? declaration!.revision : null,
      ],
    );
    for (const [position, asset] of assets.entries())
      await tx.client.query(
        "INSERT INTO treido.listing_publication_media(seller_id,listing_id,publication_revision,asset_id,asset_revision,position,checksum,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          data.sellerId,
          data.listingId,
          revision,
          asset.id,
          asset.revision,
          position,
          asset.checksum,
          asset.width,
          asset.height,
        ],
      );
    await tx.client.query(
      "UPDATE treido.listings SET publication='published',revision=$3,current_publication_revision=$3 WHERE seller_id=$1 AND id=$2",
      [data.sellerId, data.listingId, revision],
    );
    await tx.client.query(
      "UPDATE treido.listing_drafts SET revision=$3,updated_at=clock_timestamp() WHERE seller_id=$1 AND listing_id=$2",
      [data.sellerId, data.listingId, revision],
    );
    return {
      listingId: data.listingId,
      revision,
      publishedAt: inserted.rows[0].createdAt.toISOString(),
    };
  });
}
