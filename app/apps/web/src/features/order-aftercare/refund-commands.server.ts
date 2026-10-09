import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { requireJobBindings } from "../../server/jobs/config.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { lockAllocation } from "../inventory/allocations.server";
import {
  parseAftercareCommand,
  refundPortions,
  type RefundPortion,
} from "./model";
import {
  aftercareStorageAvailable,
  orderContext,
  aftercareReceipt,
  saveAftercareReceipt,
} from "./storage.server";
import { acceptedFinancialPolicy } from "./policy.server";
import {
  readRefundIntent,
  verifyRefundParameters,
  originalRefundLines,
} from "./refund-storage.server";
import {
  orderRefundProviderAvailable,
  orderRefundProvider,
  assertRefundBinding,
  originalCharge,
  verifyOriginalRefund,
} from "./refund-provider.server";
import { shippingRefundPortions } from "./shipping-refund-model";
import { originalShippingRefundBasis } from "./shipping-refund-storage.server";
import { enqueueRefundObservation } from "./jobs.server";
export async function prepareOrderRefund(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseAftercareCommand(raw);
  if (command.action !== "prepare_refund")
    throw new SellerError("INVALID_INPUT");
  if (!hasVerifiedRecentAuthentication(identity))
    throw new SellerError("FORBIDDEN");
  if (!orderRefundProviderAvailable()) throw new SellerError("NOT_AVAILABLE");
  const jobs = requireJobBindings();
  return inTransaction(database, async (tx) => {
    await authorizeHuman(tx, identity, true);
    const initial = await orderContext(tx, identity, command, "refund.request");
    await lockAllocation(tx, initial.allocationId);
    const order = await orderContext(
      tx,
      identity,
      command,
      "refund.request",
      true,
    );
    if (!(await aftercareStorageAvailable(tx)))
      throw new SellerError("NOT_AVAILABLE");
    const prior = await aftercareReceipt(tx, order, command.requestId, command);
    if (prior)
      return {
        orderId: order.orderId,
        requestId: command.requestId,
        caseId: prior.caseId,
        intentId: prior.intentId,
        revision: prior.revision,
        state: prior.state,
      };
    if (
      order.side !== "merchant" ||
      order.orderRevision !== command.expectedRevision ||
      order.paymentState !== "paid" ||
      order.settlementState !== "transferred" ||
      !order.paymentIntentId ||
      !order.chargeId
    )
      throw new SellerError("CONFLICT");
    if (jobs.applicationId !== order.applicationId)
      throw new SellerError("NOT_AVAILABLE");
    const policy = await acceptedFinancialPolicy(tx, order);
    if (!policy) throw new SellerError("NOT_AVAILABLE");
    const attempts = (
      await tx.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM treido.order_refund_intents WHERE order_id=$1",
        [order.orderId],
      )
    ).rows[0];
    if (attempts.n >= policy.refundRequestLimit)
      throw new SellerError("QUOTA_EXCEEDED");
    if (
      command.caseId &&
      (
        await tx.client.query(
          "SELECT id FROM treido.order_cases WHERE id=$1 AND order_id=$2",
          [command.caseId, order.orderId],
        )
      ).rowCount !== 1
    )
      throw new SellerError("NOT_FOUND");
    const recent = (
      await tx.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM treido.order_aftercare_receipts WHERE actor_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [order.actorId],
      )
    ).rows[0];
    if (recent.n >= 20) throw new SellerError("QUOTA_EXCEEDED");
    const originalLines = await originalRefundLines(tx, order);
    const selected =
      command.selection === "remaining" ? "remaining" : command.lines;
    let shipping: ReturnType<typeof shippingRefundPortions>["shipping"] = null;
    let shippingStage: "before_dispatch" | "after_dispatch" | null = null;
    let shippingFulfilmentRevision = 0;
    let lines: RefundPortion[], amount: number, fee: number;
    if (order.terms.handover === "shipping") {
      if (policy.method !== "shipping") throw new SellerError("NOT_AVAILABLE");
      const originalShipping = await originalShippingRefundBasis(tx, order);
      const portions = shippingRefundPortions(
        originalLines,
        originalShipping.basis,
        { merchandise: selected, shipping: command.shipping === true },
        originalShipping.stage,
        originalShipping.reservedShippingMinor,
      );
      shippingStage = originalShipping.stage;
      shippingFulfilmentRevision = originalShipping.fulfilmentRevision;
      shipping = portions.shipping;
      lines = portions.lines;
      amount = portions.amountMinor;
      fee = portions.feeMinor;
    } else {
      if (command.shipping !== undefined || policy.method !== "pickup")
        throw new SellerError("INVALID_INPUT");
      lines = refundPortions(
        originalLines,
        selected,
        order.totalMinor,
        order.feeMinor,
      );
      amount = lines.reduce((sum, line) => sum + line.amountMinor, 0);
      fee = lines.reduce((sum, line) => sum + line.feeMinor, 0);
    }
    if (!hasVerifiedRecentAuthentication(identity))
      throw new SellerError("FORBIDDEN");
    const id = randomUUID(),
      parameters = {
        payment_intent: order.paymentIntentId,
        amount,
        reverse_transfer: true,
        refund_application_fee: order.feeMinor > 0,
        metadata: {
          treido_purpose: "goods_aftercare_v2",
          aftercare_intent_id: id,
          order_id: order.orderId,
          attempt_id: order.attemptId,
          application_id: order.applicationId,
          environment: order.environment,
        },
      };
    await tx.client.query(
      "INSERT INTO treido.order_refund_intents(id,order_id,quote_id,policy_id,seller_id,buyer_id,actor_id,case_id,request_id,input_hash,reason,amount_minor,fee_minor,currency,tax_basis,platform_account,livemode,environment,application_id,payment_intent_id,charge_id,connected_account,api_version,operation_key,parameters,parameter_hash,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'EUR','inclusive_unspecified',$14,$15,$16,$17,$18,$19,$20,'2026-09-30.endive',$21,$22,$23,clock_timestamp()+make_interval(secs=>$24),'prepared')",
      [
        id,
        order.orderId,
        order.quoteId,
        policy.id,
        order.sellerId,
        order.buyerId,
        order.actorId,
        command.caseId,
        command.requestId,
        inputHash(command),
        command.reason,
        amount,
        fee,
        order.platformAccount,
        order.livemode,
        order.environment,
        order.applicationId,
        order.paymentIntentId,
        order.chargeId,
        order.connectedAccount,
        "treido:order-refund:v2:" + id,
        parameters,
        inputHash(parameters),
        policy.executionSeconds,
      ],
    );
    for (const line of lines)
      await tx.client.query(
        "INSERT INTO treido.order_refund_lines(intent_id,quote_id,sku_id,from_quantity,quantity,amount_minor,fee_minor,tax_minor,tax_basis) VALUES($1,$2,$3,$4,$5,$6,$7,NULL,'inclusive_unspecified')",
        [
          id,
          order.quoteId,
          line.skuId,
          line.fromQuantity,
          line.quantity,
          line.amountMinor,
          line.feeMinor,
        ],
      );
    if (shipping)
      await tx.client.query(
        "INSERT INTO treido.order_refund_shipping_components(intent_id,quote_id,amount_minor,fee_minor,tax_basis,fulfilment_stage,fulfilment_revision) VALUES($1,$2,$3,$4,'inclusive_unspecified',$5,$6)",
        [
          id,
          order.quoteId,
          shipping.amountMinor,
          shipping.feeMinor,
          shippingStage,
          shippingFulfilmentRevision,
        ],
      );
    return saveAftercareReceipt(tx, order, command, {
      caseId: command.caseId,
      intentId: id,
      revision: 0,
      state: "prepared",
    });
  });
}
export async function executeOrderRefund(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseAftercareCommand(raw);
  if (command.action !== "execute_refund")
    throw new SellerError("INVALID_INPUT");
  if (!hasVerifiedRecentAuthentication(identity))
    throw new SellerError("FORBIDDEN");
  const initial = await inTransaction(database, async (tx) => {
    const order = await orderContext(tx, identity, command, "refund.request");
    if (!(await aftercareStorageAvailable(tx)))
      throw new SellerError("NOT_AVAILABLE");
    const prior = await aftercareReceipt(tx, order, command.requestId, command);
    if (prior)
      return {
        prior: {
          orderId: order.orderId,
          requestId: command.requestId,
          caseId: prior.caseId,
          intentId: prior.intentId,
          revision: prior.revision,
          state: prior.state,
        },
        row: null,
      };
    const row = await readRefundIntent(tx, command.intentId);
    if (
      !row ||
      row.orderId !== order.orderId ||
      row.sellerId !== order.sellerId ||
      row.actorId !== order.actorId
    )
      throw new SellerError("NOT_FOUND");
    verifyRefundParameters(row);
    return { prior: null, row };
  });
  if (initial.prior) return initial.prior;
  if (!initial.row) throw new SellerError("NOT_FOUND");
  const original = initial.row;
  const provider = await orderRefundProvider(true);
  assertRefundBinding(initial.row, provider.binding);
  if (requireJobBindings().applicationId !== initial.row.applicationId)
    throw new SellerError("NOT_AVAILABLE");
  const charge = await originalCharge(provider.stripe, initial.row);
  const prepared = await inTransaction(database, async (tx) => {
    await authorizeHuman(tx, identity, true);
    await lockAllocation(tx, original.allocationId);
    const order = await orderContext(
      tx,
      identity,
      command,
      "refund.request",
      true,
    );
    const row = await readRefundIntent(tx, command.intentId, true);
    if (!row || row.actorId !== order.actorId || row.orderId !== order.orderId)
      throw new SellerError("NOT_FOUND");
    assertRefundBinding(row, provider.binding);
    verifyRefundParameters(row);
    const prior = await aftercareReceipt(tx, order, command.requestId, command);
    if (prior)
      return {
        create: false,
        row,
        receipt: {
          orderId: order.orderId,
          requestId: command.requestId,
          caseId: prior.caseId,
          intentId: prior.intentId,
          revision: prior.revision,
          state: prior.state,
        },
      };
    if (
      row.state !== "prepared" ||
      row.firstAttemptAt ||
      row.providerId ||
      row.revision !== command.expectedRevision ||
      order.paymentState !== "paid" ||
      order.settlementState !== "transferred"
    )
      throw new SellerError("CONFLICT");
    const policy = await acceptedFinancialPolicy(tx, order);
    if (!policy || policy.id !== row.policyId)
      throw new SellerError("NOT_AVAILABLE");
    const known = (
      await tx.client.query<{ n: number }>(
        "SELECT coalesce(sum(amount_minor),0)::int AS n FROM treido.order_refund_intents WHERE order_id=$1 AND provider_status='succeeded'",
        [order.orderId],
      )
    ).rows[0];
    if (charge.amount_refunded !== known.n) throw new SellerError("CONFLICT");
    if (!hasVerifiedRecentAuthentication(identity))
      throw new SellerError("FORBIDDEN");
    const updated = await tx.client.query<{ first_attempt_at: Date }>(
      "UPDATE treido.order_refund_intents SET state='creating',first_attempt_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 AND state='prepared' AND first_attempt_at IS NULL AND expires_at>clock_timestamp() RETURNING first_attempt_at",
      [row.id],
    );
    if (updated.rowCount !== 1) throw new SellerError("CONFLICT");
    row.firstAttemptAt = updated.rows[0].first_attempt_at;
    await tx.client.query(
      "UPDATE treido.paid_orders SET payment_state='refund_pending',fulfilment_state='blocked',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
      [order.orderId],
    );
    await enqueueRefundObservation(tx, row);
    const receipt = await saveAftercareReceipt(tx, order, command, {
      caseId: null,
      intentId: row.id,
      revision: row.revision + 1,
      state: "creating",
    });
    return { create: true, row, receipt };
  });
  if (prepared.create) {
    try {
      const refund = await provider.stripe.refunds.create(
        prepared.row.parameters,
        { idempotencyKey: prepared.row.operationKey },
      );
      verifyOriginalRefund(prepared.row, refund);
      await database.pool.query(
        "UPDATE treido.order_refund_intents SET provider_id=coalesce(provider_id,$2),provider_status=CASE WHEN provider_status IN ('succeeded','failed','canceled') THEN provider_status ELSE $3 END,state='reconciling',updated_at=clock_timestamp() WHERE id=$1 AND state IN ('creating','reconciling') AND (provider_id IS NULL OR provider_id=$2)",
        [prepared.row.id, refund.id, refund.status],
      );
    } catch {
      await database.pool.query(
        "UPDATE treido.order_refund_intents SET state='reconciling',reconcile_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() WHERE id=$1 AND state='creating'",
        [prepared.row.id],
      );
    }
  }
  return prepared.receipt;
}
