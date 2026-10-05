import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { snapshotLine } from "../purchase-reviews/persistence.server";
import type { ReviewSource } from "../purchase-reviews/model";
import { readAcceptedOfferQuoteSource } from "../offers/checkout-source.server";
import type { AllocationLine } from "../inventory/allocations.server";
import type { PaymentBindings } from "./bindings.server";
import { approvedPolicy, approvedListing } from "./registry.server";
/** Current supply qualification. Shipping-only supply never exposes pickup. */
export async function paymentSourcePickupAvailable(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  source: ReviewSource,
  policyId: string,
  binding: PaymentBindings,
) {
  try {
    const buyer = await authorizeHuman(tx, identity, false);
    await approvedPolicy(tx, policyId, binding);
    let lines: AllocationLine[], sellerId: string;
    if (source.kind === "offer") {
      const original = await readAcceptedOfferQuoteSource(tx, identity, source);
      sellerId = original.sellerId;
      lines = [original];
    } else {
      sellerId = source.sellerId;
      const cart = (
        await tx.client.query<{ revision: number }>(
          "SELECT revision FROM treido.buyer_carts WHERE user_id=$1 FOR SHARE",
          [buyer.id],
        )
      ).rows[0];
      if (!cart || cart.revision !== source.cartRevision) return false;
      lines = (
        await tx.client.query<AllocationLine>(
          'SELECT listing_id AS "listingId",sku_id AS "skuId",publication_revision AS "publicationRevision",quantity,seen_price_minor AS "unitPriceMinor" FROM treido.buyer_cart_lines WHERE user_id=$1 AND seller_id=$2 AND active ORDER BY listing_id,sku_id LIMIT 31',
          [buyer.id, sellerId],
        )
      ).rows;
    }
    if (!lines.length || lines.length > 30) return false;
    if (
      (
        await tx.client.query(
          "SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'",
          [sellerId, buyer.id],
        )
      ).rowCount
    )
      return false;
    for (const line of lines) {
      await approvedListing(tx, sellerId, line, policyId);
      await snapshotLine(tx, sellerId, line, source.kind === "offer", "pickup");
    }
    return true;
  } catch (error) {
    if (
      error instanceof SellerError &&
      ["NOT_AVAILABLE", "CONFLICT", "FORBIDDEN", "NOT_FOUND"].includes(
        error.code,
      )
    )
      return false;
    throw error;
  }
}
