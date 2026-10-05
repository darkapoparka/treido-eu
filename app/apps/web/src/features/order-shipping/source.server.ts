import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { lockInventoryListings } from "../inventory/allocations.server";
import { readAcceptedOfferQuoteSource } from "../offers/checkout-source.server";
import { snapshotLine } from "../purchase-reviews/persistence.server";
import {
  merchandiseTotal,
  type ReviewSource,
  type ReviewLine,
} from "../purchase-reviews/model";

/** Read the existing source authorities, never create a cart, review or allocation. */
export async function shippingSource(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  source: ReviewSource,
  ownCheckoutAllocation?: string,
) {
  const buyer = await authorizeHuman(tx, identity, false);
  let sellerId: string,
    allocationId: string | null = null,
    originalSourceExpiresAt: string | null = null;
  let sources: Pick<
    ReviewLine,
    | "listingId"
    | "skuId"
    | "publicationRevision"
    | "quantity"
    | "unitPriceMinor"
  >[];
  if (source.kind === "offer") {
    const accepted = await readAcceptedOfferQuoteSource(tx, identity, source);
    sellerId = accepted.sellerId;
    allocationId = accepted.allocationId;
    originalSourceExpiresAt = accepted.expiresAt;
    sources = [accepted];
  } else {
    sellerId = source.sellerId;
    const cart = (
      await tx.client.query<{ revision: number }>(
        "SELECT revision FROM treido.buyer_carts WHERE user_id=$1 FOR SHARE",
        [buyer.id],
      )
    ).rows[0];
    if (!cart || cart.revision !== source.cartRevision)
      throw new SellerError("CONFLICT");
    sources = (
      await tx.client.query<ReviewLine>(
        'SELECT listing_id AS "listingId",sku_id AS "skuId",publication_revision AS "publicationRevision",quantity,seen_price_minor AS "unitPriceMinor" FROM treido.buyer_cart_lines WHERE user_id=$1 AND seller_id=$2 AND active ORDER BY listing_id,sku_id LIMIT 31',
        [buyer.id, sellerId],
      )
    ).rows;
  }
  if (!sources.length || sources.length > 30)
    throw new SellerError("NOT_AVAILABLE");
  const seller = (
    await tx.client.query<{ name: string }>(
      "SELECT name FROM treido.seller_accounts WHERE id=$1 AND status='active' FOR SHARE",
      [sellerId],
    )
  ).rows[0];
  if (!seller) throw new SellerError("NOT_AVAILABLE");
  if (
    (
      await tx.client.query(
        "SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'",
        [sellerId, buyer.id],
      )
    ).rowCount
  )
    throw new SellerError("FORBIDDEN");
  await lockInventoryListings(
    tx,
    sellerId,
    sources.map((line) => line.listingId),
  );
  if (ownCheckoutAllocation && source.kind === "cart") {
    const hold = (
      await tx.client.query<{ valid: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM treido.inventory_allocations WHERE id=$1 AND buyer_id=$2 AND seller_id=$3 AND purpose='checkout' AND state='active' AND expires_at>clock_timestamp()) AS valid",
        [ownCheckoutAllocation, buyer.id, sellerId],
      )
    ).rows[0];
    const held = (
      await tx.client.query<{
        skuId: string;
        listingId: string;
        publicationRevision: number;
        quantity: number;
        unitPriceMinor: number;
      }>(
        'SELECT sku_id AS "skuId",listing_id AS "listingId",publication_revision AS "publicationRevision",quantity,unit_price_minor AS "unitPriceMinor" FROM treido.inventory_allocation_lines WHERE allocation_id=$1 ORDER BY listing_id,sku_id LIMIT 31',
        [ownCheckoutAllocation],
      )
    ).rows;
    if (
      !hold?.valid ||
      held.length !== sources.length ||
      held.some(
        (line, i) =>
          inputHash(line) !==
          inputHash({
            skuId: sources[i].skuId,
            listingId: sources[i].listingId,
            publicationRevision: sources[i].publicationRevision,
            quantity: sources[i].quantity,
            unitPriceMinor: sources[i].unitPriceMinor,
          }),
      )
    )
      throw new SellerError("CONFLICT");
    for (const line of sources) {
      if (
        !(
          await tx.client.query(
            "SELECT sku_id FROM treido.inventory_publication_skus WHERE seller_id=$1 AND listing_id=$2 AND sku_id=$3 AND publication_revision=$4 AND price_minor=$5 AND currency='EUR'",
            [
              sellerId,
              line.listingId,
              line.skuId,
              line.publicationRevision,
              line.unitPriceMinor,
            ],
          )
        ).rowCount
      )
        throw new SellerError("CONFLICT");
    }
  }
  const lines: ReviewLine[] = [];
  for (const line of sources)
    lines.push(
      await snapshotLine(
        tx,
        sellerId,
        line,
        source.kind === "offer" || Boolean(ownCheckoutAllocation),
        "shipping",
      ),
    );
  const merchandiseMinor = merchandiseTotal(lines);
  // Availability and presentation can move without changing accepted supply meaning.
  const sourceHash = inputHash({
    format: "shipping-supply-v1",
    source,
    sellerId,
    allocationId,
    originalSourceExpiresAt,
    lines: lines.map(
      ({
        listingId,
        skuId,
        publicationRevision,
        quantity,
        unitPriceMinor,
      }) => ({
        listingId,
        skuId,
        publicationRevision,
        quantity,
        unitPriceMinor,
      }),
    ),
  });
  return {
    buyerId: buyer.id,
    sellerId,
    sellerName: seller.name,
    allocationId,
    originalSourceExpiresAt,
    lines,
    merchandiseMinor,
    sourceHash,
  };
}
