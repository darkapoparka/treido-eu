export type Locale = "bg" | "en";
export type BrowseScope = "all" | "personal" | "business";
export const CLOSURE_LIMITS = {
  history: 20,
  sessions: 20,
  objects: 100,
  effects: 125,
  commandsPerMinute: 10,
  reviewMinutes: 15,
  recoveryBytes: 4096,
} as const;
export type ClosureCode =
  | "UNAUTHENTICATED"
  | "RECENT_AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "QUOTA_EXCEEDED"
  | "NOT_AVAILABLE"
  | "EXPIRED"
  | "POLICY_REQUIRED"
  | "BINDING_REQUIRED"
  | "OBLIGATIONS_HELD"
  | "IRREVERSIBLE"
  | "UNKNOWN_OUTCOME";
export class ClosureError extends Error {
  constructor(readonly code: ClosureCode) {
    super(code);
    this.name = "ClosureError";
  }
}
export const categories = [
  "profile",
  "library",
  "cart",
  "searches",
  "assistantMedia",
  "personalMedia",
  "identity",
  "commerceEvidence",
  "businessEvidence",
  "caseEvidence",
] as const;
export type Category = (typeof categories)[number];
export type PolicyRule = {
  category: Category;
  handling: "retain" | "remove";
  purpose: { bg: string; en: string };
  trigger: "closure" | "obligationsResolved";
  delaySeconds: number | null;
  explanation: { bg: string; en: string };
};
export type ClosurePolicy = {
  version: string;
  approvalReference: string;
  summary: { bg: string; en: string };
  rules: PolicyRule[];
  identity: "revoke" | "delete";
  personalBilling: "stop-renewal";
  preservesAcceptedEvidence: true;
  reversibleBeforeEffects: true;
};
export type Obligations = {
  soleBusinessOwners: number;
  allocations: number;
  offers: number;
  payments: number;
  orders: number;
  refunds: number;
  cases: number;
  billingIntents: number;
  billingInvoices: number;
  promotionAttempts: number;
  promotionReservations: number;
  promotionRemedies: number;
  mediaWriters: number;
  assistantRuns: number;
  sessionEffects: number;
  legalHolds: number;
};
export const obligationNames = [
  "soleBusinessOwners",
  "allocations",
  "offers",
  "payments",
  "orders",
  "refunds",
  "cases",
  "billingIntents",
  "billingInvoices",
  "promotionAttempts",
  "promotionReservations",
  "promotionRemedies",
  "mediaWriters",
  "assistantRuns",
  "sessionEffects",
  "legalHolds",
] as const satisfies readonly (keyof Obligations)[];
export function assertNoObligations(facts: Obligations) {
  if (
    obligationNames.some(
      (key) => !Number.isSafeInteger(facts[key]) || facts[key] < 0,
    )
  )
    throw new ClosureError("NOT_AVAILABLE");
  if (obligationNames.some((key) => facts[key] !== 0))
    throw new ClosureError("OBLIGATIONS_HELD");
}
export type PlanState =
  | "reviewed"
  | "accepted"
  | "processing"
  | "blocked"
  | "reconciling"
  | "cancelled"
  | "completed";
export type EffectKind =
  | "session.revoke"
  | "identity.delete"
  | "media.delete"
  | "billing.stop-renewal"
  | "data.remove";
export type EffectState =
  "prepared" | "attempting" | "unknown" | "confirmed" | "blocked";
export type ClosureOperation =
  | { kind: "review"; closureRequestId: string; policyId: string }
  | { kind: "confirm"; planId: string; planHash: string; acknowledged: true }
  | { kind: "cancel"; planId: string }
  | { kind: "recheck"; planId: string }
  | { kind: "preferences"; locale: Locale; browseScope: BrowseScope }
  | { kind: "revokeSession"; sessionRef: string; acknowledged: true };
export type ClosureCommand = {
  version: 1;
  actorKey: string;
  requestId: string;
  expectedRevision: number;
  operation: ClosureOperation;
};
export type Acknowledgment = {
  revision: number;
  resourceId: string;
  kind: ClosureOperation["kind"];
  state: string;
};
export type SessionSummary = {
  ref: string;
  current: boolean;
  lastActiveAt: string;
  device: string;
};
export type PlanSummary = {
  messageImages?: import("./message-image-summary").MessageImageSummary | null;
  id: string;
  hash: string;
  state: PlanState;
  createdAt: string;
  expiresAt: string;
  reviewExpired: boolean;
  policy: ClosurePolicy;
  obligations: Obligations;
  effects: { kind: EffectKind; state: EffectState; count: number }[];
  cancellable: boolean;
};
export type ClosureView = {
  actorKey: string;
  revision: number;
  lifecycle: "active" | "restricted" | "closed";
  preferences: { locale: Locale; browseScope: BrowseScope } | null;
  policy: { id: string; value: ClosurePolicy } | null;
  requestedClosures: string[];
  obligations: Obligations | null;
  plans: PlanSummary[];
  sessions: SessionSummary[];
  securityEffects: { id: string; state: EffectState }[];
  sessionsLimited: boolean;
  sessionReadUnavailable: boolean;
  securityAvailable: boolean;
  executionAvailable: boolean;
  historyLimited: boolean;
};
export function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const digest = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
export function parseCommand(raw: unknown): ClosureCommand {
  if (
    !object(raw) ||
    !exact(raw, [
      "version",
      "actorKey",
      "requestId",
      "expectedRevision",
      "operation",
    ]) ||
    raw.version !== 1 ||
    !digest(raw.actorKey) ||
    !uuid(raw.requestId) ||
    !Number.isSafeInteger(raw.expectedRevision) ||
    Number(raw.expectedRevision) < 0 ||
    Number(raw.expectedRevision) >= 2147483647 ||
    !object(raw.operation)
  )
    throw new ClosureError("INVALID_INPUT");
  const op = raw.operation;
  let operation: ClosureOperation;
  if (
    op.kind === "review" &&
    exact(op, ["kind", "closureRequestId", "policyId"]) &&
    uuid(op.closureRequestId) &&
    uuid(op.policyId)
  )
    operation = {
      kind: op.kind,
      closureRequestId: op.closureRequestId,
      policyId: op.policyId,
    };
  else if (
    op.kind === "confirm" &&
    exact(op, ["kind", "planId", "planHash", "acknowledged"]) &&
    uuid(op.planId) &&
    digest(op.planHash) &&
    op.acknowledged === true
  )
    operation = {
      kind: op.kind,
      planId: op.planId,
      planHash: op.planHash,
      acknowledged: true,
    };
  else if (
    (op.kind === "cancel" || op.kind === "recheck") &&
    exact(op, ["kind", "planId"]) &&
    uuid(op.planId)
  )
    operation = { kind: op.kind, planId: op.planId };
  else if (
    op.kind === "preferences" &&
    exact(op, ["kind", "locale", "browseScope"]) &&
    (op.locale === "bg" || op.locale === "en") &&
    (op.browseScope === "all" ||
      op.browseScope === "personal" ||
      op.browseScope === "business")
  )
    operation = {
      kind: op.kind,
      locale: op.locale,
      browseScope: op.browseScope,
    };
  else if (
    op.kind === "revokeSession" &&
    exact(op, ["kind", "sessionRef", "acknowledged"]) &&
    digest(op.sessionRef) &&
    op.acknowledged === true
  )
    operation = {
      kind: op.kind,
      sessionRef: op.sessionRef,
      acknowledged: true,
    };
  else throw new ClosureError("INVALID_INPUT");
  return {
    version: 1,
    actorKey: raw.actorKey,
    requestId: raw.requestId,
    expectedRevision: Number(raw.expectedRevision),
    operation,
  };
}
export function canCancel(state: PlanState, attempted: boolean) {
  return (
    !attempted &&
    (state === "reviewed" || state === "accepted" || state === "blocked")
  );
}
