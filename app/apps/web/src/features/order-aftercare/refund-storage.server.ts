import "server-only";
import type Stripe from "stripe";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import type { OrderContext } from "./storage.server";
import type { RefundState, FrozenRefundLine } from "./model";
export type RefundIntent = {
  id: string;
  orderId: string;
  quoteId: string;
  policyId: string;
  sellerId: string;
  buyerId: string;
  actorId: string;
  requestId: string;
  amountMinor: number;
  feeMinor: number;
  currency: "EUR";
  platformAccount: string;
  livemode: boolean;
  environment: string;
  applicationId: string;
  paymentIntentId: string;
  chargeId: string;
  connectedAccount: string;
  operationKey: string;
  parameters: Stripe.RefundCreateParams;
  parameterHash: string;
  expiresAt: Date;
  firstAttemptAt: Date | null;
  state: RefundState;
  revision: number;
  providerId: string | null;
  providerStatus: string | null;
  settlementState: string;
  generation: number;
  allocationId: string;
  attemptId: string;
  totalMinor: number;
  originalFeeMinor: number;
};
export const refundColumns =
  'r.id,r.order_id AS "orderId",r.quote_id AS "quoteId",r.policy_id AS "policyId",r.seller_id AS "sellerId",r.buyer_id AS "buyerId",r.actor_id AS "actorId",r.request_id AS "requestId",r.amount_minor AS "amountMinor",r.fee_minor AS "feeMinor",r.currency,r.platform_account AS "platformAccount",r.livemode,r.environment,r.application_id AS "applicationId",r.payment_intent_id AS "paymentIntentId",r.charge_id AS "chargeId",r.connected_account AS "connectedAccount",r.operation_key AS "operationKey",r.parameters,r.parameter_hash AS "parameterHash",r.expires_at AS "expiresAt",r.first_attempt_at AS "firstAttemptAt",r.state,r.revision,r.provider_id AS "providerId",r.provider_status AS "providerStatus",r.settlement_state AS "settlementState",r.generation,q.allocation_id AS "allocationId",o.attempt_id AS "attemptId",q.total_minor AS "totalMinor",q.application_fee_minor AS "originalFeeMinor"';
export async function readRefundIntent(
  tx: SellerTransaction,
  id: string,
  lock = false,
) {
  return (
    await tx.client.query<RefundIntent>(
      "SELECT " +
        refundColumns +
        " FROM treido.order_refund_intents r JOIN treido.payable_quotes q ON q.id=r.quote_id JOIN treido.paid_orders o ON o.id=r.order_id WHERE r.id=$1" +
        (lock ? " FOR UPDATE OF r" : ""),
      [id],
    )
  ).rows[0];
}
export function verifyRefundParameters(row: RefundIntent) {
  const expected = {
    payment_intent: row.paymentIntentId,
    amount: row.amountMinor,
    reverse_transfer: true,
    refund_application_fee: row.originalFeeMinor > 0,
    metadata: {
      treido_purpose: "goods_aftercare_v2",
      aftercare_intent_id: row.id,
      order_id: row.orderId,
      attempt_id: row.attemptId,
      application_id: row.applicationId,
      environment: row.environment,
    },
  };
  if (
    row.operationKey !== "treido:order-refund:v2:" + row.id ||
    inputHash(expected) !== row.parameterHash ||
    inputHash(row.parameters) !== row.parameterHash
  )
    throw new SellerError("CONFLICT");
}
export async function originalRefundLines(
  tx: SellerTransaction,
  order: OrderContext,
): Promise<FrozenRefundLine[]> {
  if (
    (
      await tx.client.query(
        "SELECT id FROM treido.payment_refunds WHERE order_id=$1",
        [order.orderId],
      )
    ).rowCount
  )
    throw new SellerError("CONFLICT");
  if (
    (
      await tx.client.query(
        "SELECT id FROM treido.order_refund_intents WHERE order_id=$1 AND state<>'expired' AND (state<>'succeeded' OR settlement_state<>'verified') LIMIT 1",
        [order.orderId],
      )
    ).rowCount
  )
    throw new SellerError("CONFLICT");
  const rows = (
    await tx.client.query<Omit<FrozenRefundLine, "originalPrefixMinor">>(
      'SELECT l.sku_id AS "skuId",l.position,l.quantity,l.unit_price_minor AS "unitPriceMinor",coalesce((SELECT sum(f.quantity) FROM treido.order_refund_lines f JOIN treido.order_refund_intents r ON r.id=f.intent_id WHERE f.quote_id=l.quote_id AND f.sku_id=l.sku_id AND r.state<>$2),0)::int AS "reservedQuantity" FROM treido.payable_quote_lines l WHERE l.quote_id=$1 ORDER BY l.position',
      [order.quoteId, "expired"],
    )
  ).rows;
  let prefix = 0;
  return rows.map((row) => {
    const line = { ...row, originalPrefixMinor: prefix };
    prefix += row.quantity * row.unitPriceMinor;
    if (!Number.isSafeInteger(prefix)) throw new SellerError("CONFLICT");
    return line;
  });
}
