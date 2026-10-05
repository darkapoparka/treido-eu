import "server-only";
import type Stripe from "stripe";
import {
  paymentBindings,
  requireWebhookBinding,
  verifiedStripe,
  type PaymentBindings,
} from "../payments/bindings.server";
import { SellerError } from "../sellers/errors";
import type { RefundIntent } from "./refund-storage.server";
function id(value: { id: string } | string | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null);
}
export function orderRefundProviderAvailable() {
  try {
    const binding = paymentBindings();
    requireWebhookBinding(binding);
    return process.env.TREIDO_STRIPE_AFTERCARE_ENABLED === "true";
  } catch (error) {
    if (error instanceof SellerError && error.code === "NOT_AVAILABLE")
      return false;
    throw error;
  }
}
export async function orderRefundProvider(write = false) {
  const binding = paymentBindings();
  if (write && process.env.TREIDO_STRIPE_AFTERCARE_ENABLED !== "true")
    throw new SellerError("NOT_AVAILABLE");
  const stripe = await verifiedStripe(binding);
  if (write) {
    const registered = requireWebhookBinding(binding);
    const endpoint = await stripe.webhookEndpoints.retrieve(
      registered.endpoint,
    );
    const events = [
      "refund.created",
      "refund.updated",
      "refund.failed",
      "charge.updated",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.updated",
      "charge.dispute.closed",
    ];
    if (
      endpoint.livemode !== binding.livemode ||
      endpoint.status !== "enabled" ||
      endpoint.url !== new URL("/api/stripe/webhook", binding.origin).href ||
      endpoint.metadata.treido_application_id !== binding.applicationId ||
      endpoint.metadata.treido_environment !== binding.environment ||
      !events.every(
        (type) =>
          endpoint.enabled_events.includes("*") ||
          endpoint.enabled_events.includes(type),
      )
    )
      throw new SellerError("NOT_AVAILABLE");
  }
  return { binding, stripe };
}
export function assertRefundBinding(
  row: RefundIntent,
  binding: PaymentBindings,
) {
  if (
    row.platformAccount !== binding.platformAccount ||
    row.livemode !== binding.livemode ||
    row.environment !== binding.environment ||
    row.applicationId !== binding.applicationId
  )
    throw new SellerError("NOT_AVAILABLE");
}
export type RefundObservation = {
  providerId: string | null;
  providerStatus: string | null;
  state: "pending" | "reconciling" | "succeeded" | "remedy_required";
  settlementState: "verified" | "reconciling" | "remedy_required";
  fact: {
    refundId: string | null;
    status: string | null;
    amountMinor: number;
    chargeId: string;
    amountRefundedMinor: number;
    chargeDisputed: boolean;
    reversalId: string | null;
    reversalMinor: number | null;
    feeRefundedMinor: number | null;
    feeRefundIds: string[];
  };
};
export async function originalCharge(
  stripe: Stripe,
  row: RefundIntent,
  purpose: "new_refund" | "reconcile" = "new_refund",
) {
  const charge = await stripe.charges.retrieve(row.chargeId);
  if (
    charge.livemode !== row.livemode ||
    charge.currency !== "eur" ||
    charge.amount !== row.totalMinor ||
    !charge.paid ||
    !charge.captured ||
    id(charge.payment_intent) !== row.paymentIntentId ||
    (purpose === "new_refund" && charge.disputed) ||
    id(charge.transfer_data?.destination) !== row.connectedAccount
  )
    throw new SellerError("CONFLICT");
  return charge;
}
export async function findOriginalRefund(stripe: Stripe, row: RefundIntent) {
  if (row.providerId) return stripe.refunds.retrieve(row.providerId);
  let cursor: string | undefined;
  const matches: Stripe.Refund[] = [];
  for (let page = 0; page < 10; page++) {
    const list = await stripe.refunds.list({
      payment_intent: row.paymentIntentId,
      limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    });
    for (const item of list.data)
      if (item.metadata?.aftercare_intent_id === row.id) matches.push(item);
    if (matches.length > 1) throw new SellerError("CONFLICT");
    if (!list.has_more)
      return matches.length === 1
        ? stripe.refunds.retrieve(matches[0].id)
        : null;
    cursor = list.data.at(-1)?.id;
    if (!cursor) throw new SellerError("CONFLICT");
  }
  throw new SellerError("NOT_AVAILABLE");
}
export function verifyOriginalRefund(row: RefundIntent, refund: Stripe.Refund) {
  if (
    !/^re_[A-Za-z0-9]+$/.test(refund.id) ||
    (row.firstAttemptAt !== null &&
      refund.created < Math.floor(row.firstAttemptAt.getTime() / 1000) - 5) ||
    id(refund.payment_intent) !== row.paymentIntentId ||
    id(refund.charge) !== row.chargeId ||
    refund.currency !== "eur" ||
    refund.amount !== row.amountMinor ||
    refund.metadata?.aftercare_intent_id !== row.id ||
    refund.metadata?.treido_purpose !== "goods_aftercare_v2" ||
    refund.metadata?.order_id !== row.orderId ||
    refund.metadata?.attempt_id !== row.attemptId ||
    refund.metadata?.application_id !== row.applicationId ||
    refund.metadata?.environment !== row.environment
  )
    throw new SellerError("CONFLICT");
}
export async function observeOriginalRefund(
  stripe: Stripe,
  row: RefundIntent,
  refund: Stripe.Refund | null,
  expectedCumulativeFee: number,
  successfulCount: number,
): Promise<RefundObservation> {
  const charge = await originalCharge(stripe, row, "reconcile");
  if (refund) verifyOriginalRefund(row, refund);
  const fact: RefundObservation["fact"] = {
    refundId: refund?.id ?? null,
    status: refund?.status ?? null,
    amountMinor: row.amountMinor,
    chargeId: row.chargeId,
    amountRefundedMinor: charge.amount_refunded,
    chargeDisputed: charge.disputed,
    reversalId: null,
    reversalMinor: null,
    feeRefundedMinor: null,
    feeRefundIds: [],
  };
  if (refund?.status === "failed" || refund?.status === "canceled")
    return {
      providerId: refund.id,
      providerStatus: refund.status,
      state: "remedy_required",
      settlementState: "remedy_required",
      fact,
    };
  if (refund?.status !== "succeeded")
    return {
      providerId: refund?.id ?? null,
      providerStatus: refund?.status ?? null,
      state: refund ? "pending" : "reconciling",
      settlementState: "reconciling",
      fact,
    };
  let reversalVerified = false;
  const transferId = id(charge.transfer),
    reversalId = id(refund.transfer_reversal);
  if (transferId && reversalId) {
    const transfer = await stripe.transfers.retrieve(transferId);
    const reversal = await stripe.transfers.retrieveReversal(
      transferId,
      reversalId,
    );
    reversalVerified =
      transfer.livemode === row.livemode &&
      id(transfer.destination) === row.connectedAccount &&
      id(transfer.source_transaction) === row.chargeId &&
      transfer.amount === row.totalMinor &&
      transfer.currency === "eur" &&
      reversal.amount === row.amountMinor &&
      reversal.currency === "eur" &&
      id(reversal.source_refund) === refund.id;
    fact.reversalId = reversal.id;
    fact.reversalMinor = reversal.amount;
  }
  let feeVerified = row.originalFeeMinor === 0;
  const feeId = id(charge.application_fee);
  if (feeId) {
    const fee = await stripe.applicationFees.retrieve(feeId);
    const feeRefunds = await stripe.applicationFees.listRefunds(fee.id, {
      limit: 100,
    });
    fact.feeRefundedMinor = fee.amount_refunded;
    fact.feeRefundIds = feeRefunds.data.map((item) => item.id);
    feeVerified =
      fee.livemode === row.livemode &&
      id(fee.charge) === row.chargeId &&
      fee.amount === row.originalFeeMinor &&
      fee.currency === "eur" &&
      !feeRefunds.has_more &&
      fee.amount_refunded <= row.originalFeeMinor &&
      Math.abs(fee.amount_refunded - expectedCumulativeFee) <= successfulCount;
  }
  const verified = reversalVerified && feeVerified;
  return {
    providerId: refund.id,
    providerStatus: refund.status,
    state: verified ? "succeeded" : "reconciling",
    settlementState: verified ? "verified" : "reconciling",
    fact,
  };
}
