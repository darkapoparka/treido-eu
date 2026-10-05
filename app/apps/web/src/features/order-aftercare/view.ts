import type { readOrderShippingRecipient } from "../order-shipping/recipient.server";
import type {
  CaseReason,
  CaseState,
  Language,
  RefundPortion,
  RefundState,
} from "./model";
export type CaseView = {
  id: string;
  reason: CaseReason;
  state: CaseState;
  revision: number;
  policyVersion: number;
  createdAt: string;
  events: {
    id: string;
    kind: string;
    side: "buyer" | "merchant" | "operator";
    body: string;
    evidence: string[];
    createdAt: string;
  }[];
  moreEvents: boolean;
};
export type RefundIntentView = {
  id: string;
  state: RefundState;
  revision: number;
  requestId: string;
  ownedByCurrentActor: boolean;
  reason: string;
  amountMinor: number;
  feeMinor: number;
  taxBasis: "inclusive_unspecified";
  lines: RefundPortion[];
  shippingComponent: { amountMinor: number; feeMinor: number } | null;
  expiresAt: string;
  firstAttemptAt: string | null;
  providerStatus: string | null;
  settlementState:
    "unobserved" | "verified" | "reconciling" | "remedy_required";
  createdAt: string;
};
export type FulfilmentView = {
  method: "pickup" | "shipping";
  state:
    | "pending"
    | "seller_reported_dispatched"
    | "buyer_confirmed_delivery"
    | "blocked";
  revision: number;
  carrier: string | null;
  trackingReference: string | null;
  description: string | null;
  events: {
    id: string;
    kind: string;
    description: string;
    createdAt: string;
  }[];
};
export type AftercareView = {
  actorKey: string;
  actorSubject: string;
  orderId: string;
  sellerId: string | null;
  sellerName: string;
  side: "buyer" | "merchant";
  orderRevision: number;
  paymentState: string;
  originalFulfilmentState: string;
  originalSettlementState: string;
  currency: "EUR";
  totalMinor: number;
  refundedMinor: number | null;
  unresolvedMinor: number | null;
  available: boolean;
  availability: "ready" | "policy_unavailable";
  policy: {
    id: string;
    version: number;
    termsHash: string;
    terms: string;
    retentionDescription: string;
  } | null;
  cases: CaseView[];
  refunds: RefundIntentView[];
  fulfilment: FulfilmentView;
  canReply: boolean;
  canRefund: boolean;
  canPrepareRefund: boolean;
  canTrack: boolean;
  shippingContractAvailable: boolean;
  shippingRecipient: Awaited<
    ReturnType<typeof readOrderShippingRecipient>
  > | null;
  acceptedCarrier: { code: string; label: string } | null;
  shippingRefund: {
    remainingMinor: number;
    eligible: boolean;
    terms: string;
  } | null;
  partialContract: {
    policyId: string;
    version: number;
    terms: string;
    termsHash: string;
  } | null;
  lines: {
    skuId: string;
    title: string;
    quantity: number;
    unitPriceMinor: number;
    remainingQuantity: number;
  }[];
  moreCases: boolean;
  moreRefunds: boolean;
  language: Language;
};
export type AftercareResult = {
  orderId: string;
  requestId: string;
  caseId: string | null;
  intentId: string | null;
  revision: number;
  state: string;
};
export type AftercareOwnExport = {
  cases: {
    id: string;
    orderId: string;
    state: string;
    revision: number;
    createdAt: string;
  }[];
  refundRequests: {
    id: string;
    orderId: string;
    amountMinor: number;
    currency: "EUR";
    state: string;
    createdAt: string;
  }[];
  more: boolean;
};
