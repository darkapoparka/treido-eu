import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { readFreeCatalogueLimits } from "../sellers/free-catalogue.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { orderColumns } from "./orders.server";
import { quoteLines } from "./quotes.server";
import type { OrderView } from "./model";
import { ORDER_PAGE_SIZE, literalOrderSearch, parseOrderIndexQuery, type OrderQueue, type SellerOrderIndex } from "./order-index-model";

/** Queue names select fixed SQL; current order commands remain the only writers. */
export const orderQueuePredicates: Readonly<Record<OrderQueue, string>> = {
  all: "TRUE",
  fulfilment: `o.payment_state='paid' AND o.settlement_state='transferred' AND (
    (q.terms_snapshot->>'handover'='pickup' AND o.fulfilment_state IN ('pending','ready')) OR
    (q.terms_snapshot->>'handover'='shipping' AND coalesce((SELECT f.state FROM treido.order_fulfilments f WHERE f.order_id=o.id AND f.quote_id=q.id AND f.method='shipping'),'pending') IN ('pending','seller_reported_dispatched')))`,
  financial: "(o.payment_state IN ('refund_pending','reconciliation','disputed') OR o.settlement_state='reconciliation')",
  refunded: "o.payment_state='refunded'",
};

export async function readSellerOrderIndex(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, raw: Record<string, unknown>, exportActor?: string): Promise<SellerOrderIndex> {
  const query = parseOrderIndexQuery(raw);
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
    for (const id of new Set([query.before, query.customerOrder].filter((id): id is string => !!id))) {
      const anchor = await tx.client.query("SELECT id FROM treido.paid_orders WHERE seller_id=$1 AND id=$2", [sellerId, id]);
      if (anchor.rowCount !== 1) throw new SellerError("NOT_FOUND");
    }
    const observedAt = (await tx.client.query<{ now: Date }>("SELECT transaction_timestamp() AS now")).rows[0].now.toISOString();
    const rows = (await tx.client.query<Omit<OrderView, "lines" | "createdAt"> & { createdAt: Date }>(
      `SELECT ${orderColumns} FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id AND q.seller_id=o.seller_id
       WHERE o.seller_id=$1 AND (${orderQueuePredicates[query.queue]})
       AND ($2::uuid IS NULL OR (o.created_at,o.id)<(SELECT created_at,id FROM treido.paid_orders WHERE seller_id=$1 AND id=$2))
       AND ($3::text='' OR o.id::text ILIKE $4 OR EXISTS(SELECT 1 FROM treido.payable_quote_lines l WHERE l.quote_id=o.quote_id AND l.title ILIKE $4))
       AND ($5::uuid IS NULL OR o.buyer_id=(SELECT buyer_id FROM treido.paid_orders WHERE seller_id=$1 AND id=$5))
       ORDER BY o.created_at DESC,o.id DESC LIMIT $6`,
      [sellerId, query.before, query.q, literalOrderSearch(query.q), query.customerOrder, ORDER_PAGE_SIZE + 1],
    )).rows;
    const orders: OrderView[] = [];
    for (const row of rows.slice(0, ORDER_PAGE_SIZE))
      orders.push({ ...row, createdAt: row.createdAt.toISOString(), lines: await quoteLines(tx, row.quoteId) });
    return { sellerId, sellerName: context.name, actorKey, observedAt, query, orders, nextBefore: rows.length > ORDER_PAGE_SIZE ? orders.at(-1)!.id : null, canExport: limits.commercialExport };
  });
}
