import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import type { ShippingBridge } from "../order-shipping/view";
import type { OrderContext } from "./storage.server";
import type {
  ShippingRefundBasis,
  ShippingRefundStage,
} from "./shipping-refund-model";
/** Original immutable quote component and authoritative fulfilment stage. Caller holds owner/allocation/order locks. */
export async function originalShippingRefundBasis(
  tx: SellerTransaction,
  order: OrderContext,
) {
  const row = (
    await tx.client.query<{
      shipping: ShippingBridge;
      snapshotHash: string;
      choiceId: string;
      revision: number;
      merchandiseMinor: number;
      shippingMinor: number;
      buyerFeeMinor: number;
      bound: boolean;
    }>(
      'SELECT q.terms_snapshot->\'shipping\' AS shipping,c.snapshot_hash AS "snapshotHash",c.id AS "choiceId",c.revision,q.total_minor-q.delivery_minor-q.buyer_fee_minor AS "merchandiseMinor",q.delivery_minor AS "shippingMinor",q.buyer_fee_minor AS "buyerFeeMinor",c.state=\'bound\' AS bound FROM treido.payable_quotes q JOIN treido.order_shipping_choices c ON c.quote_id=q.id AND c.buyer_id=q.buyer_id AND c.seller_id=q.seller_id WHERE q.id=$1 AND q.buyer_id=$2 AND q.seller_id=$3 AND q.terms_snapshot->>\'handover\'=\'shipping\' FOR SHARE OF c',
      [order.quoteId, order.buyerId, order.sellerId],
    )
  ).rows[0];
  if (
    !row ||
    !row.bound ||
    row.shipping?.format !== "goods-shipping-v1" ||
    inputHash(row.shipping.choice) !==
      inputHash({
        id: row.choiceId,
        revision: row.revision - 1,
        snapshotHash: row.snapshotHash,
        acknowledged: true,
      }) ||
    row.shipping.recipientRef !== row.choiceId
  )
    throw new SellerError("NOT_AVAILABLE");
  const cost = row.shipping.costs;
  if (
    !cost ||
    cost.merchandiseMinor !== row.merchandiseMinor ||
    cost.shippingMinor !== row.shippingMinor ||
    cost.buyerFeeMinor !== row.buyerFeeMinor ||
    cost.totalMinor !== order.totalMinor ||
    cost.applicationFeeMinor !== order.feeMinor
  )
    throw new SellerError("CONFLICT");
  const current = (
    await tx.client.query<{ state: string; method: string; revision: number }>(
      "SELECT state,method,revision FROM treido.order_fulfilments WHERE order_id=$1 FOR UPDATE",
      [order.orderId],
    )
  ).rows[0];
  let stage: ShippingRefundStage = "before_dispatch";
  if (current) {
    if (
      current.method !== "shipping" ||
      ![
        "pending",
        "seller_reported_dispatched",
        "buyer_confirmed_delivery",
      ].includes(current.state)
    )
      throw new SellerError("NOT_AVAILABLE");
    if (current.state !== "pending") stage = "after_dispatch";
  }
  const reserved = (
    await tx.client.query<{ amount: number }>(
      "SELECT coalesce(sum(c.amount_minor),0)::int AS amount FROM treido.order_refund_shipping_components c JOIN treido.order_refund_intents r ON r.id=c.intent_id WHERE r.order_id=$1 AND r.state<>\'expired\'",
      [order.orderId],
    )
  ).rows[0];
  const basis: ShippingRefundBasis = {
    ...cost,
    shippingRefund: row.shipping.shippingRefund,
  };
  return {
    basis,
    stage,
    fulfilmentRevision: current?.revision ?? 0,
    reservedShippingMinor: reserved.amount,
  };
}
