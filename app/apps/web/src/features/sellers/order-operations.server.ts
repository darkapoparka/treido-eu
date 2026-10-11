import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "./persistence.server";
import { SellerError } from "./errors";
import { sellerCustomerReference } from "./customers.server";
import { validId } from "../selling/draft-model";
export async function readOrderOperationalContext(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, orderId: string) {
  if (!validId(orderId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "order.read");
    const row = (await tx.client.query<{ buyerId: string; buyerTerms: string; orderCount: number }>(
      `SELECT o.buyer_id AS "buyerId",q.terms_snapshot->>'buyerTerms' AS "buyerTerms",
       (SELECT count(*)::integer FROM treido.paid_orders related WHERE related.seller_id=o.seller_id AND related.buyer_id=o.buyer_id) AS "orderCount"
       FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id WHERE o.seller_id=$1 AND o.id=$2`, [sellerId, orderId],
    )).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    const events = (await tx.client.query<{ id: string; kind: "ready" | "collected" | "refund"; createdAt: string }>(
      'SELECT request_id AS id,command AS kind,created_at::text AS "createdAt" FROM treido.paid_order_receipts WHERE order_id=$1 ORDER BY created_at DESC,request_id DESC LIMIT 51', [orderId],
    )).rows;
    return { reference: sellerCustomerReference(sellerId.toLowerCase(), row.buyerId), buyerTerms: row.buyerTerms,
      orderCount: row.orderCount, events: events.slice(0, 50), moreEvents: events.length > 50 };
  });
}
