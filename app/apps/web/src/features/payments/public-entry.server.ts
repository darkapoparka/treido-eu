import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { PublishedListing } from "../catalog/published-model";
import { readPublicInventoryInTransaction } from "../inventory/queries.server";
import { requireCollection } from "./bindings.server";
import {
  approvedListing,
  approvedPolicy,
  sellerBinding,
} from "./registry.server";

/** A public invitation to attempt checkout, never provider readiness or payment authority.
 * Quote creation and payment begin still verify the current account with Stripe. */
export async function readPublicPaymentEntry(
  database: SellerDatabase,
  listing: Pick<PublishedListing, "id" | "revision" | "seller" | "handover">,
): Promise<boolean> {
  try {
    const binding = requireCollection();
    if (!listing.handover.includes("pickup")) return false;
    return await inTransaction(database, async (tx) => {
      const inventory = await readPublicInventoryInTransaction(
        tx,
        listing.id,
        listing.revision,
      );
      if (
        !inventory ||
        inventory.publicationRevision !== listing.revision ||
        inventory.mode === "unknown" ||
        !inventory.skus.some((sku) => sku.available > 0)
      )
        return false;
      const candidates = await tx.client.query<{ policyId: string }>(
        `SELECT t.policy_id AS "policyId" FROM treido.payable_listing_terms t
         JOIN treido.listings l ON l.id=t.listing_id AND l.seller_id=t.seller_id AND l.current_publication_revision=t.publication_revision
         JOIN treido.payment_policies p ON p.id=t.policy_id
         WHERE t.seller_id=$1 AND t.listing_id=$2 AND t.publication_revision=$3
           AND t.approved_at<=clock_timestamp() AND t.revoked_at IS NULL
           AND p.platform_account=$4 AND p.livemode=$5 AND p.environment=$6 AND p.application_id=$7
           AND p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL
         ORDER BY t.policy_id LIMIT 30`,
        [
          listing.seller.id,
          listing.id,
          listing.revision,
          binding.platformAccount,
          binding.livemode,
          binding.environment,
          binding.applicationId,
        ],
      );
      for (const candidate of candidates.rows) {
        // Reuse checkout's current registry gates and its lock order; no registry writes.
        await approvedPolicy(tx, candidate.policyId, binding);
        await sellerBinding(tx, listing.seller.id, binding);
        await approvedListing(
          tx,
          listing.seller.id,
          { listingId: listing.id, publicationRevision: listing.revision },
          candidate.policyId,
        );
        return true;
      }
      return false;
    });
  } catch {
    // Missing config, registry, visibility, stock or database never implies payment support.
    return false;
  }
}
