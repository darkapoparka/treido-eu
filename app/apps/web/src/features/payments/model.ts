import { validId } from "../selling/draft-model";
import {
  object,
  parseCreateReview,
  type CreateReview,
  type ReviewLine,
} from "../purchase-reviews/model";
import {
  parseAftercareChoice,
  type AftercareChoice,
} from "../order-aftercare/model";
import {
  parseChoice,
  type ShippingChoice,
  type ShippingCosts,
} from "../order-shipping/model";
import { SellerError } from "../sellers/errors";

export type QuoteCommand = CreateReview & {
  policyId: string;
  aftercare?: AftercareChoice;
  shipping?: ShippingChoice;
};
export function parseQuoteCommand(raw: unknown): QuoteCommand {
  if (!object(raw) || !validId(raw.policyId))
    throw new SellerError("INVALID_INPUT");
  const { policyId, aftercare, shipping, ...review } = raw;
  const command = parseCreateReview(review);
  if (
    (command.handover === "shipping") !== (shipping !== undefined) ||
    (command.handover === "shipping" && aftercare === undefined)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    ...command,
    policyId,
    ...(shipping === undefined ? {} : { shipping: parseChoice(shipping) }),
    ...(aftercare === undefined
      ? {}
      : { aftercare: parseAftercareChoice(aftercare) }),
  };
}
export type AttemptState =
  | "prepared"
  | "creating"
  | "reconciling"
  | "requires_payment_method"
  | "requires_action"
  | "processing"
  | "paid"
  | "cancelling"
  | "cancelled"
  | "quarantined";
export type PublicShippingTerms = {
  format: "goods-shipping-v1";
  country: string;
  costs: ShippingCosts;
  terms: string;
  rights: string;
  refundTerms: string;
  taxDescription: string;
  recipientPurpose: string;
  retentionDescription: string;
};
export type QuoteView = {
  id: string;
  sellerId: string;
  sellerName: string;
  language: "bg" | "en";
  totalMinor: number;
  merchandiseMinor: number;
  shippingMinor: number;
  buyerFeeMinor: number;
  currency: "EUR";
  applicationFeeMinor: number;
  expiresAt: string;
  expired: boolean;
  lines: ReviewLine[];
  terms: {
    handover: "pickup" | "shipping";
    shipping?: PublicShippingTerms | null;
    taxPolicy: "inclusive";
    refundPolicy: "full_fee_and_transfer_reversal";
    buyerTerms: string;
    aftercare?: {
      format: "goods-aftercare-acceptance-v2";
      policyId: string;
      version: number;
      termsHash: string;
      choiceHash: string;
      method: "pickup" | "shipping";
      buyerTerms: string;
    };
  };
  attempt: { id: string; state: AttemptState } | null;
  orderId: string | null;
};
export type OrderView = {
  id: string;
  quoteId: string;
  sellerId: string;
  sellerName: string;
  totalMinor: number;
  merchandiseMinor: number;
  shippingMinor: number;
  buyerFeeMinor: number;
  currency: "EUR";
  handover: "pickup" | "shipping";
  shipping: PublicShippingTerms | null;
  shippingFulfilmentState:
    | "pending"
    | "seller_reported_dispatched"
    | "buyer_confirmed_delivery"
    | "blocked"
    | null;
  paymentState:
    "paid" | "refund_pending" | "refunded" | "disputed" | "reconciliation";
  fulfilmentState: "pending" | "ready" | "collected" | "blocked";
  settlementState: "transferred" | "reconciliation" | "reversed";
  refundState: string | null;
  revision: number;
  createdAt: string;
  lines: ReviewLine[];
};
export type ResourceCommand = {
  actorKey: string;
  requestId: string;
  id: string;
};
export function parseResource(raw: unknown): ResourceCommand {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (k) => !["actorKey", "requestId", "id"].includes(k),
    ) ||
    !validId(raw.id) ||
    !validId(raw.requestId) ||
    typeof raw.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey)
  )
    throw new SellerError("INVALID_INPUT");
  return raw as ResourceCommand;
}
export type OrderCommand = ResourceCommand & {
  expectedRevision: number;
  action: "ready" | "collected" | "refund";
  reason: string;
  sellerId: string | null;
};
export function parseOrderCommand(raw: unknown): OrderCommand {
  if (!object(raw)) throw new SellerError("INVALID_INPUT");
  const { expectedRevision, action, reason, sellerId, ...resource } = raw;
  const command = parseResource(resource);
  if (
    !Number.isSafeInteger(expectedRevision) ||
    Number(expectedRevision) < 0 ||
    !["ready", "collected", "refund"].includes(String(action)) ||
    typeof reason !== "string" ||
    reason.length > 500 ||
    /[\u0000-\u001f\u007f]/.test(reason) ||
    (action === "refund" && reason.trim().length === 0) ||
    (sellerId !== null && !validId(sellerId)) ||
    (action === "collected") !== (sellerId === null)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    ...command,
    expectedRevision: Number(expectedRevision),
    action,
    reason: reason.trim(),
    sellerId,
  } as OrderCommand;
}
export function feeMinor(total: number, bps: number, fixed: number) {
  const value =
    Number((BigInt(total) * BigInt(bps) + BigInt(5000)) / BigInt(10000)) +
    fixed;
  if (!Number.isSafeInteger(value) || value < 0 || value > total)
    throw new SellerError("NOT_AVAILABLE");
  return value;
}
