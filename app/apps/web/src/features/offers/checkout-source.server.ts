import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeConversation } from "../messaging/conversation-access.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { readPublicInventoryInTransaction } from "../inventory/queries.server";
export type AcceptedOfferQuoteSource = {
  allocationId: string;
  sellerId: string;
  listingId: string;
  skuId: string;
  publicationRevision: number;
  quantity: number;
  unitPriceMinor: number;
  currency: "EUR";
  expiresAt: string;
};
/** Internal quote handoff, not checkout availability or a new reservation.
 * A future qualified payment-attempt command must call this inside its own
 * transaction and retain these authority/listing/allocation locks until commit.
 * It must reuse this allocation, never allocate the accepted offer a second time. */
export async function readAcceptedOfferQuoteSource(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  input: { threadId: string; offerId: string },
): Promise<AcceptedOfferQuoteSource> {
  if (!validId(input.threadId) || !validId(input.offerId))
    throw new SellerError("INVALID_INPUT");
  const access = await authorizeConversation(
    tx,
    identity,
    input.threadId,
    true,
    { sellerId: null },
    true,
  );
  if (access.side !== "buyer" || !access.canReply)
    throw new SellerError("NOT_AVAILABLE");
  const row = (
    await tx.client.query<
      Omit<AcceptedOfferQuoteSource, "expiresAt"> & { expiresAt: Date }
    >(
      `SELECT a.id AS "allocationId",o.seller_id AS "sellerId",o.listing_id AS "listingId",o.sku_id AS "skuId",o.publication_revision AS "publicationRevision",o.quantity,o.unit_price_minor AS "unitPriceMinor",o.currency,a.expires_at AS "expiresAt"
     FROM treido.listing_offers o JOIN treido.inventory_allocations a ON a.id=o.allocation_id
     JOIN treido.inventory_allocation_lines al ON al.allocation_id=a.id AND al.sku_id=o.sku_id
     WHERE o.thread_id=$1 AND o.id=$2 AND o.buyer_id=$3 AND o.state='accepted'
       AND a.buyer_id=o.buyer_id AND a.seller_id=o.seller_id AND a.source_id=o.id AND a.purpose='offer'
       AND a.state='active' AND a.expires_at>clock_timestamp()
       AND al.publication_revision=o.publication_revision AND al.quantity=o.quantity
       AND al.unit_price_minor=o.unit_price_minor AND al.currency=o.currency
     FOR UPDATE OF o,a`,
      [input.threadId, input.offerId, access.user.id],
    )
  ).rows[0];
  if (!row) throw new SellerError("CONFLICT");
  const inventory = await readPublicInventoryInTransaction(
    tx,
    row.listingId,
    row.publicationRevision,
  );
  const sku = inventory?.skus.find((item) => item.id === row.skuId);
  // Available excludes this buyer's own hold. Compare physical stock here;
  // the existing active allocation already owns the reserved quantity.
  if (!sku || sku.onHand < row.quantity) throw new SellerError("NOT_AVAILABLE");
  return { ...row, expiresAt: row.expiresAt.toISOString() };
}
