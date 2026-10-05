import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  authorizeHuman,
  authorizeSeller,
  inputHash,
} from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import type { Scope } from "./model";
export type OrderContext = {
  orderId: string;
  quoteId: string;
  attemptId: string;
  allocationId: string;
  buyerId: string;
  sellerId: string;
  sellerName: string;
  policyId: string;
  platformAccount: string;
  livemode: boolean;
  environment: string;
  applicationId: string;
  connectedAccount: string;
  paymentIntentId: string | null;
  chargeId: string | null;
  totalMinor: number;
  feeMinor: number;
  paymentState: string;
  fulfilmentState: string;
  settlementState: string;
  orderRevision: number;
  terms: Record<string, unknown>;
  actorId: string;
  side: "buyer" | "merchant";
};
export async function aftercareStorageAvailable(tx: SellerTransaction) {
  const result = await tx.client.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM unnest(ARRAY['order_cases','order_refund_intents','order_service_policies','order_financial_policies','quote_aftercare_acceptances','order_case_events','order_aftercare_receipts','order_fulfilments','order_fulfilment_events','order_refund_lines','order_refund_observations','order_aftercare_operator_grants']) name WHERE to_regclass('treido.'||name) IS NOT NULL",
  );
  const count = result.rows[0]?.n;
  if (count === 0) return false;
  if (count !== 12) throw new SellerError("NOT_AVAILABLE");
  return true;
}
export async function orderContext(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  scope: Scope,
  capability: "order.read" | "order.fulfil" | "refund.request" = "order.read",
  lock = false,
): Promise<OrderContext> {
  if (
    !validId(scope.orderId) ||
    (scope.sellerId !== null && !validId(scope.sellerId))
  )
    throw new SellerError("INVALID_INPUT");
  if (scope.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  const user = scope.sellerId
    ? (await authorizeSeller(tx, identity, scope.sellerId, capability)).user
    : await authorizeHuman(tx, identity, false);
  const row = (
    await tx.client.query<Omit<OrderContext, "actorId" | "side">>(
      'SELECT o.id AS "orderId",o.quote_id AS "quoteId",o.attempt_id AS "attemptId",q.allocation_id AS "allocationId",o.buyer_id AS "buyerId",o.seller_id AS "sellerId",q.seller_name AS "sellerName",q.policy_id AS "policyId",q.platform_account AS "platformAccount",q.livemode,p.environment,p.application_id AS "applicationId",q.connected_account AS "connectedAccount",a.provider_id AS "paymentIntentId",(SELECT f.object_id FROM treido.payment_facts f WHERE f.attempt_id=a.id AND f.kind=\'charge\' LIMIT 1) AS "chargeId",q.total_minor AS "totalMinor",q.application_fee_minor AS "feeMinor",o.payment_state AS "paymentState",o.fulfilment_state AS "fulfilmentState",o.settlement_state AS "settlementState",o.revision AS "orderRevision",q.terms_snapshot AS terms FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id JOIN treido.payment_attempts a ON a.id=o.attempt_id JOIN treido.payment_policies p ON p.id=q.policy_id WHERE o.id=$1 AND ' +
        (scope.sellerId ? "o.seller_id=$2" : "o.buyer_id=$2") +
        (lock ? " FOR UPDATE OF o" : ""),
      [scope.orderId, scope.sellerId ?? user.id],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  return {
    ...row,
    actorId: user.id,
    side: scope.sellerId ? "merchant" : "buyer",
  };
}
export async function legacyFullRefundMustOwnEntireBalance(
  tx: SellerTransaction,
  orderId: string,
) {
  const available = await aftercareStorageAvailable(tx);
  if (!available) return;
  const reserved = (
    await tx.client.query<{ reserved: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM treido.order_refund_intents WHERE order_id=$1 AND state<>'expired') AS reserved",
      [orderId],
    )
  ).rows[0];
  if (reserved?.reserved) throw new SellerError("CONFLICT");
}
export async function aftercareReceipt(
  tx: SellerTransaction,
  order: OrderContext,
  requestId: string,
  command?: unknown,
) {
  const row = (
    await tx.client.query<{
      hash: string;
      caseId: string | null;
      intentId: string | null;
      revision: number;
      state: string;
    }>(
      'SELECT input_hash AS hash,case_id AS "caseId",intent_id AS "intentId",accepted_revision AS revision,accepted_state AS state FROM treido.order_aftercare_receipts WHERE order_id=$1 AND actor_id=$2 AND request_id=$3',
      [order.orderId, order.actorId, requestId],
    )
  ).rows[0];
  if (row && command !== undefined && row.hash !== inputHash(command))
    throw new SellerError("CONFLICT");
  return row;
}
export async function saveAftercareReceipt(
  tx: SellerTransaction,
  order: OrderContext,
  command: { requestId: string; action: string },
  result: {
    caseId: string | null;
    intentId: string | null;
    revision: number;
    state: string;
  },
) {
  await tx.client.query(
    "INSERT INTO treido.order_aftercare_receipts(order_id,actor_id,request_id,input_hash,action,case_id,intent_id,accepted_revision,accepted_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      order.orderId,
      order.actorId,
      command.requestId,
      inputHash(command),
      command.action,
      result.caseId,
      result.intentId,
      result.revision,
      result.state,
    ],
  );
  return { orderId: order.orderId, requestId: command.requestId, ...result };
}
