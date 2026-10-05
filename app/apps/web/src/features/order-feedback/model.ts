import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { SellerError } from "../sellers/errors";
import {
  boundedText,
  exact,
  parseScope,
  revision,
  type Scope,
} from "../order-aftercare/model";
export type FeedbackCommand = Scope & {
  requestId: string;
  expectedRevision: number;
  rating: number;
  body: string;
  language: "bg" | "en";
  policyId: string;
  version: number;
  termsHash: string;
  acknowledged: true;
};
export function parseFeedbackCommand(raw: unknown): FeedbackCommand {
  if (
    !object(raw) ||
    !validId(raw.requestId) ||
    !validId(raw.policyId) ||
    typeof raw.rating !== "number" ||
    !Number.isInteger(raw.rating) ||
    raw.rating < 1 ||
    raw.rating > 5 ||
    typeof raw.version !== "number" ||
    !Number.isSafeInteger(raw.version) ||
    raw.version < 1 ||
    typeof raw.termsHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.termsHash) ||
    raw.acknowledged !== true ||
    (raw.language !== "bg" && raw.language !== "en")
  )
    throw new SellerError("INVALID_INPUT");
  exact(raw, [
    "actorKey",
    "orderId",
    "sellerId",
    "requestId",
    "expectedRevision",
    "rating",
    "body",
    "language",
    "policyId",
    "version",
    "termsHash",
    "acknowledged",
  ]);
  const scope = parseScope(raw);
  if (scope.sellerId !== null) throw new SellerError("FORBIDDEN");
  return {
    ...scope,
    requestId: raw.requestId,
    expectedRevision: revision(raw.expectedRevision),
    rating: raw.rating,
    body: boundedText(raw.body, 2000),
    language: raw.language,
    policyId: raw.policyId,
    version: raw.version,
    termsHash: raw.termsHash,
    acknowledged: true,
  };
}
export type FeedbackEligibility = {
  paymentState: string;
  settlementState: string;
  fulfilmentState: string;
  shippingCompleted: boolean;
  aftercareRefundedMinor: number;
  hasUnresolvedRefund: boolean;
  legacyRefundState: string | null;
  hasOpenCase: boolean;
  paymentEvidence: boolean;
};
export function completedPurchaseEligible(
  facts: FeedbackEligibility,
  policy: { allowRefundedFeedback: boolean; allowOpenCaseFeedback: boolean },
) {
  return (
    facts.paymentEvidence &&
    facts.paymentState === "paid" &&
    facts.settlementState === "transferred" &&
    (facts.fulfilmentState === "collected" || facts.shippingCompleted) &&
    !facts.hasUnresolvedRefund &&
    facts.legacyRefundState === null &&
    (policy.allowRefundedFeedback || facts.aftercareRefundedMinor === 0) &&
    (policy.allowOpenCaseFeedback || !facts.hasOpenCase)
  );
}
