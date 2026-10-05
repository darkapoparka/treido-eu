import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { requireCollection } from "./bindings.server";
import { SellerError } from "../sellers/errors";
import type { ReviewSource } from "../purchase-reviews/model";
import { paymentSourcePickupAvailable } from "./pickup-availability.server";
import type { AttemptState } from "./model";

export async function readPaymentOverview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
) {
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const quotes = (
      await tx.client.query<{
        id: string;
        sellerName: string;
        totalMinor: number;
        expiresAt: Date;
        state: AttemptState | null;
        orderId: string | null;
      }>(
        `SELECT q.id,q.seller_name AS "sellerName",q.total_minor AS "totalMinor",q.expires_at AS "expiresAt",a.state,o.id AS "orderId"
      FROM treido.payable_quotes q LEFT JOIN treido.payment_attempts a ON a.quote_id=q.id LEFT JOIN treido.paid_orders o ON o.quote_id=q.id WHERE q.buyer_id=$1 ORDER BY q.created_at DESC,q.id DESC LIMIT 30`,
        [user.id],
      )
    ).rows.map((row) => ({ ...row, expiresAt: row.expiresAt.toISOString() }));
    let binding;
    try {
      binding = requireCollection();
    } catch (error) {
      if (!(error instanceof SellerError)) throw error;
      return { quotes, starts: [], available: false };
    }
    const candidates = (
      await tx.client.query<{
        policyId: string;
        sellerName: string;
        source: ReviewSource;
      }>(
        `
      SELECT p.id AS "policyId",s.name AS "sellerName",jsonb_build_object('kind','cart','sellerId',s.id,'cartRevision',c.revision) AS source
      FROM treido.buyer_carts c JOIN treido.seller_payment_bindings b ON b.platform_account=$2 AND b.livemode=$3 AND b.revoked_at IS NULL
      JOIN treido.seller_accounts s ON s.id=b.seller_id AND s.status='active'
      JOIN treido.payment_policies p ON p.platform_account=b.platform_account AND p.livemode=b.livemode AND p.environment=$4 AND p.application_id=$5 AND p.revoked_at IS NULL
      WHERE c.user_id=$1 AND EXISTS(SELECT 1 FROM treido.buyer_cart_lines l WHERE l.user_id=$1 AND l.seller_id=s.id AND l.active)
        AND NOT EXISTS(SELECT 1 FROM treido.buyer_cart_lines l WHERE l.user_id=$1 AND l.seller_id=s.id AND l.active AND NOT EXISTS(SELECT 1 FROM treido.payable_listing_terms pt WHERE pt.seller_id=l.seller_id AND pt.listing_id=l.listing_id AND pt.publication_revision=l.publication_revision AND pt.policy_id=p.id AND pt.revoked_at IS NULL))
      UNION ALL
      SELECT p.id AS "policyId",s.name AS "sellerName",jsonb_build_object('kind','offer','threadId',o.thread_id,'offerId',o.id) AS source
      FROM treido.listing_offers o JOIN treido.seller_accounts s ON s.id=o.seller_id AND s.status='active'
      JOIN treido.inventory_allocations a ON a.id=o.allocation_id AND a.state='active' AND a.expires_at>clock_timestamp()
      JOIN treido.seller_payment_bindings b ON b.seller_id=o.seller_id AND b.platform_account=$2 AND b.livemode=$3 AND b.revoked_at IS NULL
      JOIN treido.payable_listing_terms pt ON pt.seller_id=o.seller_id AND pt.listing_id=o.listing_id AND pt.publication_revision=o.publication_revision AND pt.revoked_at IS NULL
      JOIN treido.payment_policies p ON p.id=pt.policy_id AND p.platform_account=$2 AND p.livemode=$3 AND p.environment=$4 AND p.application_id=$5 AND p.revoked_at IS NULL
      WHERE o.buyer_id=$1 AND o.state='accepted'
      LIMIT 30`,
        [
          user.id,
          binding.platformAccount,
          binding.livemode,
          binding.environment,
          binding.applicationId,
        ],
      )
    ).rows;
    const starts = [];
    for (const row of candidates)
      starts.push({
        ...row,
        pickupAvailable: await paymentSourcePickupAvailable(
          tx,
          identity,
          row.source,
          row.policyId,
          binding,
        ),
      });
    return { quotes, starts, available: true };
  });
}
