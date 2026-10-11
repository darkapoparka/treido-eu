import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "./persistence.server";
import { SellerError } from "./errors";
import { readFreeCatalogueLimits } from "./free-catalogue.server";
import { sellerCustomerReference } from "./customers.server";
import { parseCustomerQuery, CUSTOMER_PAGE_SIZE } from "./customers-model";
import { validId } from "../selling/draft-model";
import { libraryActorKey } from "../library/cursor.server";
import { orderColumns } from "../payments/orders.server";
import { quoteLines } from "../payments/quotes.server";
import type { OrderView } from "../payments/model";

/** The route uses an owned order as an anchor, never a global buyer ID. */
export async function readCustomerHistory(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, anchorOrderId: string, raw: Record<string, unknown> = {}, exportActor?: string) {
  const query = parseCustomerQuery(raw);
  if (!query || !validId(anchorOrderId)) throw new SellerError("INVALID_INPUT");
  const actorKey = libraryActorKey(identity);
  if (exportActor !== undefined && exportActor !== actorKey) throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    await tx.client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const { context } = await authorizeSeller(tx, identity, sellerId, "order.read");
    const limits = await readFreeCatalogueLimits(tx, sellerId, context.kind);
    if (exportActor !== undefined && !limits.commercialExport) throw new SellerError("FORBIDDEN");
    const anchor = (await tx.client.query<{ buyerId: string }>('SELECT buyer_id AS "buyerId" FROM treido.paid_orders WHERE seller_id=$1 AND id=$2', [sellerId, anchorOrderId])).rows[0];
    if (!anchor) throw new SellerError("NOT_FOUND");
    if (query.before && (await tx.client.query("SELECT id FROM treido.paid_orders WHERE seller_id=$1 AND buyer_id=$2 AND id=$3", [sellerId, anchor.buyerId, query.before])).rowCount !== 1) throw new SellerError("NOT_FOUND");
    const stats = (await tx.client.query<{ orderCount: number; firstAt: Date; lastAt: Date; refunded: number; followUp: number }>(
      `SELECT count(*)::integer AS "orderCount",min(created_at) AS "firstAt",max(created_at) AS "lastAt",
       count(*) FILTER(WHERE payment_state='refunded')::integer AS refunded,
       count(*) FILTER(WHERE payment_state IN ('refund_pending','disputed','reconciliation') OR settlement_state='reconciliation')::integer AS "followUp"
       FROM treido.paid_orders WHERE seller_id=$1 AND buyer_id=$2`, [sellerId, anchor.buyerId],
    )).rows[0];
    const rows = (await tx.client.query<Omit<OrderView, "lines" | "createdAt"> & { createdAt: Date }>(
      `SELECT ${orderColumns} FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id
       WHERE o.seller_id=$1 AND o.buyer_id=$2 AND ($3::uuid IS NULL OR (o.created_at,o.id)<(
         SELECT created_at,id FROM treido.paid_orders WHERE seller_id=$1 AND buyer_id=$2 AND id=$3))
       ORDER BY o.created_at DESC,o.id DESC LIMIT $4`, [sellerId, anchor.buyerId, query.before, CUSTOMER_PAGE_SIZE + 1],
    )).rows;
    const orders: OrderView[] = [];
    for (const row of rows.slice(0, CUSTOMER_PAGE_SIZE)) orders.push({ ...row, createdAt: row.createdAt.toISOString(), lines: await quoteLines(tx, row.quoteId) });
    return { sellerId, anchorOrderId, reference: sellerCustomerReference(sellerId.toLowerCase(), anchor.buyerId), actorKey,
      orderCount: stats.orderCount, firstAt: stats.firstAt.toISOString(), lastAt: stats.lastAt.toISOString(),
      refunded: stats.refunded, followUp: stats.followUp, canExport: limits.commercialExport,
      observedAt: (await tx.client.query<{ now: Date }>("SELECT transaction_timestamp() AS now")).rows[0].now.toISOString(),
      orders, before: query.before, nextBefore: rows.length > CUSTOMER_PAGE_SIZE ? orders.at(-1)!.id : null };
  });
}
