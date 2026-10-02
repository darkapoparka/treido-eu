import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  parseWithdrawalInput,
  type PublicationReview,
} from "./publication-model";
import { inspectPublication } from "./publication-facts.server";
export function readPublicationReview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  listingId: string,
): Promise<PublicationReview> {
  return inTransaction(
    database,
    async (tx) =>
      (await inspectPublication(tx, identity, sellerId, listingId)).review,
  );
}

export async function withdrawListing(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
) {
  const data = parseWithdrawalInput(input);
  if (!data) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const { user } = await authorizeSeller(
      tx,
      identity,
      data.sellerId,
      "listing.publish",
    );
    // Match publication's future quota lock order before the resource lock.
    await tx.client.query(
      "SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR UPDATE",
      [data.sellerId],
    );
    const row = (
      await tx.client.query<{ publication: string; revision: number }>(
        "SELECT publication,revision FROM treido.listings WHERE seller_id=$1 AND id=$2 FOR UPDATE",
        [data.sellerId, data.listingId],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    const hash = inputHash(data);
    const previous = (
      await tx.client.query<{ revision: number; hash: string }>(
        "SELECT accepted_revision AS revision,input_hash AS hash FROM treido.listing_withdrawal_receipts WHERE seller_id=$1 AND listing_id=$2 AND actor_id=$3 AND request_id=$4",
        [data.sellerId, data.listingId, user.id, data.requestId],
      )
    ).rows[0];
    if (previous) {
      if (previous.hash !== hash) throw new SellerError("CONFLICT");
      return { revision: previous.revision };
    }
    if (row.revision !== data.expectedRevision)
      throw new SellerError("CONFLICT");
    if (!["published", "withdrawn"].includes(row.publication))
      throw new SellerError("CONFLICT");
    const revision = row.revision + (row.publication === "published" ? 1 : 0);
    if (row.publication === "published") {
      await tx.client.query(
        "UPDATE treido.listings SET publication='withdrawn',revision=$3 WHERE seller_id=$1 AND id=$2",
        [data.sellerId, data.listingId, revision],
      );
      await tx.client.query(
        "UPDATE treido.listing_drafts SET revision=$3,updated_at=clock_timestamp() WHERE seller_id=$1 AND listing_id=$2",
        [data.sellerId, data.listingId, revision],
      );
    }
    await tx.client.query(
      "INSERT INTO treido.listing_withdrawal_receipts(seller_id,listing_id,actor_id,request_id,input_hash,accepted_revision) VALUES($1,$2,$3,$4,$5,$6)",
      [data.sellerId, data.listingId, user.id, data.requestId, hash, revision],
    );
    return { revision };
  });
}
