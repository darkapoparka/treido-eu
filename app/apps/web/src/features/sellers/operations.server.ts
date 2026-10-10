import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { publishedEligibility, publishedJoins } from "../catalog/publication-eligibility.server";
import { reservedSql } from "../inventory/queries.server";
import { authorizeSeller } from "./persistence.server";
import { orderQueuePredicates } from "../payments/order-index.server";
import {
  OPERATION_COUNT_LIMIT,
  operationCount,
  permittedOperations,
  type OperationKind,
  type SellerOperationsView,
} from "./operations-model";

/** Fixed, seller-scoped sources. Counts are bounded and never stand for revenue,
 * delivery evidence, actual emails, or externally approved trading readiness. */
export const operationSources: Readonly<Record<OperationKind, string>> = {
  // Use the same moderation projection as the destination product index.
  drafts: "SELECT l.id FROM treido.listings l WHERE l.seller_id=$1 AND l.publication='draft' AND l.moderation_state='clear'",
  withdrawn: "SELECT l.id FROM treido.listings l WHERE l.seller_id=$1 AND l.publication='withdrawn' AND l.moderation_state='clear'",
  restricted: "SELECT l.id FROM treido.listings l WHERE l.seller_id=$1 AND l.moderation_state<>'clear'",
  published: `SELECT l.id ${publishedJoins} WHERE l.seller_id=$1 AND ${publishedEligibility}`,
  photos: "SELECT DISTINCT m.listing_id AS id FROM treido.media_assets m JOIN treido.listings l ON l.seller_id=m.seller_id AND l.id=m.listing_id WHERE m.seller_id=$1 AND m.state='failed' AND l.publication IN ('draft','withdrawn')",
  stock: `SELECT i.id FROM treido.inventory_skus i WHERE i.seller_id=$1 AND i.active AND i.on_hand-${reservedSql("i.id")}<=0`,
  offers: "SELECT o.id FROM treido.listing_offers o WHERE o.seller_id=$1 AND o.state='pending' AND o.proposer_side='buyer' AND o.expires_at>transaction_timestamp()",
  imports: "SELECT i.id FROM treido.catalogue_imports i LEFT JOIN treido.outbox_jobs j ON j.id=i.job_id AND j.seller_id=i.seller_id WHERE i.seller_id=$1 AND (i.state IN ('uploading','review','paused') OR (i.state IN ('queued','processing') AND j.state IN ('dead','cancelled')))",
  orders: "SELECT o.id FROM treido.paid_orders o WHERE o.seller_id=$1",
  fulfilment: `SELECT o.id FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id AND q.seller_id=o.seller_id WHERE o.seller_id=$1 AND (${orderQueuePredicates.fulfilment})`,
  payments: `SELECT o.id FROM treido.paid_orders o WHERE o.seller_id=$1 AND (${orderQueuePredicates.financial})`,
};

export async function readSellerOperations(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
): Promise<SellerOperationsView> {
  return inTransaction(database, async (tx) => {
    await tx.client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await tx.client.query("SET LOCAL statement_timeout = '2500ms'");
    await tx.client.query("SET LOCAL lock_timeout = '1500ms'");
    const { context } = await authorizeSeller(tx, identity, sellerId, "seller.read");
    const observedAt = (await tx.client.query<{ now: Date }>(
      "SELECT transaction_timestamp() AS now",
    )).rows[0].now.toISOString();
    const counts: SellerOperationsView["counts"] = [];
    for (const kind of permittedOperations(context)) {
      // No request value becomes SQL. The limit applies before aggregation.
      const result = await tx.client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM (${operationSources[kind]} LIMIT $2) bounded`,
        [sellerId, OPERATION_COUNT_LIMIT + 1],
      );
      counts.push(operationCount(kind, result.rows[0].count));
    }
    const milestones: SellerOperationsView["milestones"] = [];
    if (context.capabilities.includes("listing.read")) {
      const facts = (await tx.client.query<{ product: boolean; photo: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM treido.listings WHERE seller_id=$1) AS product,
          EXISTS(SELECT 1 FROM treido.media_assets m JOIN treido.listings l ON l.seller_id=m.seller_id AND l.id=m.listing_id WHERE m.seller_id=$1 AND m.state='ready') AS photo`,
        [sellerId],
      )).rows[0];
      milestones.push(
        { kind: "product", complete: facts.product },
        { kind: "photo", complete: facts.photo },
        { kind: "publication", complete: counts.some((item) => item.kind === "published" && item.count > 0) },
      );
    }
    if (context.capabilities.includes("order.read"))
      milestones.push({ kind: "order", complete: counts.some((item) => item.kind === "orders" && item.count > 0) });
    return { sellerId, observedAt, counts, milestones };
  });
}
