import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "./persistence.server";
import { SellerError } from "./errors";
import { parseCatalogSelection } from "./catalog-navigation";
import { readListingDraft, saveListingDraft } from "../selling/drafts.server";
import { parseBulkProductEdits, type BulkProductRow, type BulkProductEditOutcome } from "./bulk-product-edit-model";

export async function readBulkProductRows(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, rawIds: unknown): Promise<BulkProductRow[]> {
  const ids = parseCatalogSelection(rawIds);
  if (!ids) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    const rows = (await tx.client.query<BulkProductRow>(
      `SELECT l.id,l.publication,l.moderation_state AS moderation,d.revision,
       coalesce(d.payload->>'title','') AS title,(d.payload->>'priceMinor')::integer AS "priceMinor"
       FROM treido.listings l JOIN treido.listing_drafts d ON d.seller_id=l.seller_id AND d.listing_id=l.id
       WHERE l.seller_id=$1 AND l.id=ANY($2::uuid[]) ORDER BY l.id`, [sellerId, ids],
    )).rows;
    if (rows.length !== ids.length) throw new SellerError("NOT_FOUND");
    return rows;
  });
}
export async function editBulkProducts(database: SellerDatabase, identity: VerifiedIdentity, raw: unknown): Promise<BulkProductEditOutcome[]> {
  const command = parseBulkProductEdits(raw);
  if (!command) throw new SellerError("INVALID_INPUT");
  await inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, command.sellerId, "listing.read");
    await authorizeSeller(tx, identity, command.sellerId, "listing.write");
  });
  const results: BulkProductEditOutcome[] = [];
  // Each row uses the existing draft-save transaction and receipt. A failed row
  // never implies that another row failed or that published terms were changed.
  for (const item of command.items) {
    try {
      const draft = await readListingDraft(database, identity, command.sellerId, item.listingId);
      const saved = await saveListingDraft(database, identity, {
        sellerId: command.sellerId, draftId: item.listingId,
        expectedRevision: item.expectedRevision, requestId: item.requestId,
        payload: { ...draft.payload, title: item.title, priceMinor: item.priceMinor },
      });
      results.push({ listingId: item.listingId, result: { ok: true, revision: saved.revision, title: item.title, priceMinor: item.priceMinor } });
    } catch (error) {
      const code = error instanceof SellerError ? error.code : "NOT_AVAILABLE";
      results.push({ listingId: item.listingId, result: { ok: false, code } });
      if (code === "UNAUTHENTICATED") break;
    }
  }
  // Unvisited rows remain explicitly unsuccessful; the client retains their
  // stable requests only when an unavailable transport made the outcome uncertain.
  for (const item of command.items) if (!results.some((row) => row.listingId === item.listingId)) results.push({ listingId: item.listingId, result: { ok: false, code: "UNAUTHENTICATED" } });
  return results;
}
