import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { createDraftInTransaction } from "../selling/drafts.server";
import {
  parseDraftPayload,
  type DraftAcknowledgement,
} from "../selling/draft-model";
import { withdrawListing } from "../selling/publication.server";
import { authorizeSeller, inputHash } from "./persistence.server";
import { SellerError } from "./errors";
import {
  parseDuplicateProduct,
  parseBulkWithdrawal,
  type ProductWithdrawalResult,
} from "./admin-product-management-model";

/** Copy saved content, never media identities, publication, moderation or paid rights. */
export async function duplicateSellerProduct(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
): Promise<DraftAcknowledgement> {
  const data = parseDuplicateProduct(input);
  if (!data) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, data.sellerId, "listing.read");
    const { user } = await authorizeSeller(
      tx,
      identity,
      data.sellerId,
      "listing.write",
    );
    // Serialize the receipt and normal draft quota on the same seller usage row.
    await tx.client.query(
      "SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR UPDATE",
      [data.sellerId],
    );
    const source = (
      await tx.client.query<{
        revision: number;
        moderation: string;
        payload: unknown;
      }>(
        `SELECT l.revision,l.moderation_state AS moderation,d.payload
       FROM treido.listings l JOIN treido.listing_drafts d ON d.seller_id=l.seller_id AND d.listing_id=l.id
       WHERE l.seller_id=$1 AND l.id=$2 FOR SHARE OF l,d`,
        [data.sellerId, data.listingId],
      )
    ).rows[0];
    // Treat foreign and missing resources identically. Do not clone around a restriction.
    if (!source || source.moderation !== "clear")
      throw new SellerError("FORBIDDEN");
    const hash = inputHash(data);
    const previous = (
      await tx.client.query<{ hash: string; id: string }>(
        `SELECT input_hash AS hash,new_listing_id AS id FROM treido.listing_duplicate_receipts
       WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3`,
        [data.sellerId, user.id, data.requestId],
      )
    ).rows[0];
    if (previous) {
      if (previous.hash !== hash) throw new SellerError("CONFLICT");
      const existing = (
        await tx.client.query<{
          revision: number;
          updatedAt: Date;
          moderation: string;
        }>(
          `SELECT d.revision,d.updated_at AS "updatedAt",l.moderation_state AS moderation
         FROM treido.listing_drafts d JOIN treido.listings l ON l.seller_id=d.seller_id AND l.id=d.listing_id
         WHERE d.seller_id=$1 AND d.listing_id=$2 FOR SHARE OF l,d`,
          [data.sellerId, previous.id],
        )
      ).rows[0];
      if (!existing || existing.moderation !== "clear")
        throw new SellerError("FORBIDDEN");
      return {
        id: previous.id,
        sellerId: data.sellerId,
        revision: existing.revision,
        updatedAt: existing.updatedAt.toISOString(),
      };
    }
    if (source.revision !== data.expectedRevision)
      throw new SellerError("CONFLICT");
    const payload = parseDraftPayload(source.payload);
    if (!payload) throw new SellerError("NOT_AVAILABLE");
    // The next item can have a different condition. Explicit review is required.
    const created = await createDraftInTransaction(
      tx,
      identity,
      data.sellerId,
      randomUUID(),
      { ...payload, condition: "" },
    );
    await tx.client.query(
      `INSERT INTO treido.listing_duplicate_receipts(seller_id,source_listing_id,actor_id,request_id,input_hash,new_listing_id)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [
        data.sellerId,
        data.listingId,
        user.id,
        data.requestId,
        hash,
        created.id,
      ],
    );
    return created;
  });
}

/** Each row is its own authorized, retryable operation; report partial completion. */
export async function withdrawSellerProducts(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
): Promise<ProductWithdrawalResult[]> {
  const data = parseBulkWithdrawal(input);
  if (!data) throw new SellerError("INVALID_INPUT");
  const results: ProductWithdrawalResult[] = [];
  for (const item of data.items) {
    try {
      const result = await withdrawListing(database, identity, {
        ...item,
        sellerId: data.sellerId,
      });
      results.push({
        listingId: item.listingId,
        result: { ok: true, revision: result.revision },
      });
    } catch (error) {
      if (!(error instanceof SellerError))
        console.error("Treido product withdrawal unavailable.");
      // Do not disclose whether an unowned ID exists in another seller account.
      const code =
        error instanceof SellerError
          ? error.code === "NOT_FOUND"
            ? "FORBIDDEN"
            : error.code
          : "NOT_AVAILABLE";
      results.push({ listingId: item.listingId, result: { ok: false, code } });
    }
  }
  return results;
}
