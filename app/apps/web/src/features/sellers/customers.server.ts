import "server-only";
import { createHash } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { authorizeSeller } from "./persistence.server";
import { readFreeCatalogueLimits } from "./free-catalogue.server";
import { SellerError } from "./errors";
import { CUSTOMER_PAGE_SIZE, parseCustomerQuery, type SellerCustomersView } from "./customers-model";

/** A seller-local reference, not a person name, contact address or cross-seller ID. */
export function sellerCustomerReference(sellerId: string, buyerId: string) {
  return "C-" + createHash("sha256").update(`treido-customer-v1:${sellerId}:${buyerId}`).digest("hex").slice(0, 12).toUpperCase();
}

export async function readSellerCustomers(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, raw: Record<string, unknown>, exportActor?: string): Promise<SellerCustomersView> {
  const query = parseCustomerQuery(raw);
  if (!query) throw new SellerError("INVALID_INPUT");
  const actorKey = libraryActorKey(identity);
  if (exportActor !== undefined && exportActor !== actorKey) throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    await tx.client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await tx.client.query("SET LOCAL statement_timeout = '2500ms'");
    await tx.client.query("SET LOCAL lock_timeout = '1500ms'");
    const { context } = await authorizeSeller(tx, identity, sellerId, "order.read");
    const limits = await readFreeCatalogueLimits(tx, sellerId, context.kind);
    if (exportActor !== undefined && !limits.commercialExport) throw new SellerError("FORBIDDEN");
    if (query.before) {
      const anchor = await tx.client.query("SELECT id FROM treido.paid_orders WHERE seller_id=$1 AND id=$2", [sellerId, query.before]);
      if (anchor.rowCount !== 1) throw new SellerError("NOT_FOUND");
    }
    const observedAt = (await tx.client.query<{ now: Date }>("SELECT transaction_timestamp() AS now")).rows[0].now.toISOString();
    const rows = (await tx.client.query<{
      buyerId: string; lastOrderId: string; lastOrderAt: Date; firstOrderAt: Date;
      orderCount: number; refundedOrders: number; financialFollowUp: number;
    }>(
      `WITH latest AS (
        SELECT DISTINCT ON (o.buyer_id) o.buyer_id,o.id,o.created_at
        FROM treido.paid_orders o WHERE o.seller_id=$1
        ORDER BY o.buyer_id,o.created_at DESC,o.id DESC
      ), selected AS (
        SELECT * FROM latest WHERE ($2::uuid IS NULL OR (created_at,id)<(
          SELECT created_at,id FROM treido.paid_orders WHERE seller_id=$1 AND id=$2))
        ORDER BY created_at DESC,id DESC LIMIT $3
      )
      SELECT c.buyer_id AS "buyerId",c.id AS "lastOrderId",c.created_at AS "lastOrderAt",
        stats."firstOrderAt",stats."orderCount",stats."refundedOrders",stats."financialFollowUp"
      FROM selected c CROSS JOIN LATERAL (
        SELECT min(o.created_at) AS "firstOrderAt",count(*)::int AS "orderCount",
          count(*) FILTER(WHERE o.payment_state='refunded')::int AS "refundedOrders",
          count(*) FILTER(WHERE o.payment_state IN ('refund_pending','disputed','reconciliation') OR o.settlement_state='reconciliation')::int AS "financialFollowUp"
        FROM treido.paid_orders o WHERE o.seller_id=$1 AND o.buyer_id=c.buyer_id
      ) stats ORDER BY c.created_at DESC,c.id DESC`,
      [sellerId, query.before, CUSTOMER_PAGE_SIZE + 1],
    )).rows;
    const selected = rows.slice(0, CUSTOMER_PAGE_SIZE);
    return {
      sellerId, sellerName: context.name, actorKey, observedAt, query, canExport: limits.commercialExport,
      nextBefore: rows.length > CUSTOMER_PAGE_SIZE ? selected.at(-1)!.lastOrderId : null,
      customers: selected.map((row) => ({
        reference: sellerCustomerReference(sellerId, row.buyerId),
        lastOrderId: row.lastOrderId, lastOrderAt: row.lastOrderAt.toISOString(), firstOrderAt: row.firstOrderAt.toISOString(),
        orderCount: row.orderCount, refundedOrders: row.refundedOrders, financialFollowUp: row.financialFollowUp,
      })),
    };
  });
}
