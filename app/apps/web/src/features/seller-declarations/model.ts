import { validId } from "../selling/draft-model";
import {
  BUSINESS_SETUP_VERSION,
  type DeclarationStatus,
  type TraderDeclaration,
} from "../sellers/setup-model";

export type DeclarationDecision = "accepted" | "rejected";
export type OwnDeclarationDecision = {
  decision: DeclarationDecision;
  reason: string;
  revision: number;
  reviewedAt: string;
};
export type ReviewDeclarationInput = {
  sellerId: string;
  declarationId: string;
  expectedDeclarationRevision: number;
  expectedSetupRevision: number;
  expectedRequirementVersion: number;
  decision: DeclarationDecision;
  reason: string;
  requestId: string;
};
export type DeclarationReviewAcknowledgement = {
  id: string;
  sourceDeclarationId: string;
  reviewedDeclarationId: string;
  revision: number;
  decision: DeclarationDecision;
  reviewedAt: string;
};
export type DeclarationReviewView = {
  id: string;
  sellerId: string;
  sellerName: string;
  revision: number;
  setupRevision: number;
  requirementVersion: number;
  status: DeclarationStatus;
  facts: TraderDeclaration;
  submittedAt: string | null;
  currentDeclarationId: string;
  isCurrent: boolean;
  canReview: boolean;
  history: (DeclarationReviewAcknowledgement & { reason: string })[];
};
export type DeclarationQueueQuery = {
  state: "review_required" | "accepted" | "rejected" | "all";
  q: string;
  before: string | null;
};
export type DeclarationQueue = {
  query: DeclarationQueueQuery;
  items: Pick<
    DeclarationReviewView,
    | "id"
    | "sellerId"
    | "sellerName"
    | "revision"
    | "requirementVersion"
    | "status"
    | "submittedAt"
  >[];
  nextCursor: string | null;
};
export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function revision(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 1 &&
    Number(value) < 2147483646
  );
}
export function reviewReason(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    return null;
  const reason = value.trim();
  return reason.length >= 2 ? reason : null;
}
export function parseReviewDeclarationInput(
  value: unknown,
): ReviewDeclarationInput | null {
  if (
    !record(value) ||
    Object.keys(value).length !== 8 ||
    Object.keys(value).some(
      (key) =>
        ![
          "sellerId",
          "declarationId",
          "expectedDeclarationRevision",
          "expectedSetupRevision",
          "expectedRequirementVersion",
          "decision",
          "reason",
          "requestId",
        ].includes(key),
    ) ||
    !validId(value.sellerId) ||
    !validId(value.declarationId) ||
    !validId(value.requestId) ||
    !revision(value.expectedDeclarationRevision) ||
    !revision(value.expectedSetupRevision) ||
    value.expectedDeclarationRevision > value.expectedSetupRevision ||
    value.expectedRequirementVersion !== BUSINESS_SETUP_VERSION ||
    (value.decision !== "accepted" && value.decision !== "rejected")
  )
    return null;
  const reason = reviewReason(value.reason);
  if (!reason) return null;
  return {
    sellerId: value.sellerId.toLowerCase(),
    declarationId: value.declarationId.toLowerCase(),
    expectedDeclarationRevision: value.expectedDeclarationRevision,
    expectedSetupRevision: value.expectedSetupRevision,
    expectedRequirementVersion: BUSINESS_SETUP_VERSION,
    decision: value.decision as DeclarationDecision,
    reason,
    requestId: value.requestId.toLowerCase(),
  };
}
export function parseDeclarationQueueQuery(
  value: unknown,
): DeclarationQueueQuery | null {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !["state", "q", "before"].includes(key))
  )
    return null;
  const state = value.state ?? "review_required",
    q = value.q ?? "",
    before = value.before ?? null;
  if (
    (state !== "review_required" &&
      state !== "accepted" &&
      state !== "rejected" &&
      state !== "all") ||
    typeof q !== "string" ||
    q.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(q) ||
    (before !== null && !validId(before))
  )
    return null;
  return {
    state: state as DeclarationQueueQuery["state"],
    q: q.trim(),
    before: typeof before === "string" ? before.toLowerCase() : null,
  };
}
