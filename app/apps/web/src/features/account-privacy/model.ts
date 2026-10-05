export const PRIVACY_LIMITS = {
  rows: 50,
  history: 20,
  bytes: 262_144,
  activeExports: 5,
  commandsPerMinute: 10,
  lifetimeMinutes: 15,
  recoveryBytes: 4096,
  sectionBytes: 32_768,
} as const;
export const EXPORT_CATEGORIES = [
  "account",
  "personalProfile",
  "memberships",
  "library",
  "cart",
  "searches",
  "purchases",
] as const;
export type ExportCategory = (typeof EXPORT_CATEGORIES)[number];
export type PrivacyCode =
  | "UNAUTHENTICATED"
  | "RECENT_AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "QUOTA_EXCEEDED"
  | "NOT_AVAILABLE"
  | "EXPIRED";
export class PrivacyError extends Error {
  constructor(readonly code: PrivacyCode) {
    super(code);
    this.name = "PrivacyError";
  }
}
export type PrivacyResult<T> =
  { ok: true; data: T } | { ok: false; code: PrivacyCode };
export type PrivacyOperation =
  | { kind: "export"; categories: ExportCategory[] }
  | { kind: "review" }
  | { kind: "submit"; reviewId: string; acknowledged: true }
  | { kind: "withdraw"; closureId: string }
  | { kind: "discard"; exportId: string };
export type PrivacyCommand = {
  version: 1;
  actorKey: string;
  requestId: string;
  expectedRevision: number;
  operation: PrivacyOperation;
};
export type Acknowledgment = {
  revision: number;
  kind: PrivacyOperation["kind"];
  resourceId: string;
  acceptedState: "ready" | "review" | "requested" | "withdrawn" | "discarded";
  expiresAt: string | null;
};
export type ClosureFacts = {
  personalListings: number;
  businessMemberships: number;
  soleBusinessOwnerships: number;
  allocations: number;
  offers: number;
  paymentAttempts: number;
  orders: number;
  refunds: number;
  openReports: number;
};
export type ClosureReview = {
  id: string;
  createdAt: string;
  expiresAt: string;
  facts: ClosureFacts;
  policyVersion: "request-only-v1";
  completionAvailable: false;
};
export type ClosureRequest = {
  id: string;
  reviewId: string;
  state: "requested" | "withdrawn";
  createdAt: string;
  updatedAt: string;
};
export type ExportSummary = {
  id: string;
  createdAt: string;
  expiresAt: string;
  categories: ExportCategory[];
  bytes: number;
  downloadable: boolean;
};
export type PrivacyView = {
  actorKey: string;
  revision: number;
  checkedAt: string;
  registrationNeeded: boolean;
  facts: ClosureFacts | null;
  exports: ExportSummary[];
  reviews: ClosureReview[];
  closures: ClosureRequest[];
  historyLimited: boolean;
};
export type ExportSection = {
  category: ExportCategory;
  records: Record<string, string | number | boolean | null>[];
  limited: boolean;
};
export type PersonalSnapshot = {
  format: "treido-personal-data-v1";
  generatedAt: string;
  accountId: string;
  sections: ExportSection[];
  scope: "supported-current-snapshot";
  excluded: readonly string[];
};
export const SNAPSHOT_EXCLUSIONS = [
  "identity-provider credentials, sessions, bank and identity-document data",
  "other people's messages, addresses, contact details and restricted case evidence",
  "shared business records, legal evidence and raw provider payloads",
  "device-only preferences and data held solely by external providers",
  "unimplemented categories and historical records beyond the disclosed page bounds",
] as const;
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length === 36 &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
export function parsePrivacyCommand(raw: unknown): PrivacyCommand {
  if (
    !object(raw) ||
    !keys(raw, [
      "version",
      "actorKey",
      "requestId",
      "expectedRevision",
      "operation",
    ]) ||
    raw.version !== 1 ||
    typeof raw.actorKey !== "string" ||
    raw.actorKey.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(raw.actorKey) ||
    !uuid(raw.requestId) ||
    !Number.isSafeInteger(raw.expectedRevision) ||
    Number(raw.expectedRevision) < 0 ||
    Number(raw.expectedRevision) >= 2_147_483_647 ||
    !object(raw.operation)
  )
    throw new PrivacyError("INVALID_INPUT");
  const op = raw.operation;
  let operation: PrivacyOperation;
  if (
    op.kind === "export" &&
    keys(op, ["kind", "categories"]) &&
    Array.isArray(op.categories) &&
    op.categories.length > 0 &&
    op.categories.length <= EXPORT_CATEGORIES.length &&
    op.categories.every((item) => EXPORT_CATEGORIES.includes(item)) &&
    new Set(op.categories).size === op.categories.length
  ) {
    const categories = op.categories;
    operation = {
      kind: "export",
      categories: EXPORT_CATEGORIES.filter((category) =>
        categories.includes(category),
      ),
    };
  } else if (op.kind === "review" && keys(op, ["kind"]))
    operation = { kind: "review" };
  else if (
    op.kind === "submit" &&
    keys(op, ["kind", "reviewId", "acknowledged"]) &&
    uuid(op.reviewId) &&
    op.acknowledged === true
  )
    operation = {
      kind: "submit",
      reviewId: op.reviewId.toLowerCase(),
      acknowledged: true,
    };
  else if (
    op.kind === "withdraw" &&
    keys(op, ["kind", "closureId"]) &&
    uuid(op.closureId)
  )
    operation = { kind: "withdraw", closureId: op.closureId.toLowerCase() };
  else if (
    op.kind === "discard" &&
    keys(op, ["kind", "exportId"]) &&
    uuid(op.exportId)
  )
    operation = { kind: "discard", exportId: op.exportId.toLowerCase() };
  else throw new PrivacyError("INVALID_INPUT");
  return {
    version: 1,
    actorKey: raw.actorKey,
    requestId: raw.requestId.toLowerCase(),
    expectedRevision: Number(raw.expectedRevision),
    operation,
  };
}
export function parseDownloadQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some((key) => !["id", "actor"].includes(key)) ||
    params.getAll("id").length !== 1 ||
    params.getAll("actor").length !== 1 ||
    !uuid(params.get("id")) ||
    (params.get("actor") ?? "").length !== 64 ||
    !/^[0-9a-f]{64}$/.test(params.get("actor") ?? "")
  )
    throw new PrivacyError("INVALID_INPUT");
  return {
    id: params.get("id")!.toLowerCase(),
    actorKey: params.get("actor")!,
  };
}
export function parseDownloadInput(raw: unknown) {
  if (
    !object(raw) ||
    !keys(raw, ["id", "actorKey"]) ||
    !uuid(raw.id) ||
    typeof raw.actorKey !== "string" ||
    raw.actorKey.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(raw.actorKey)
  )
    throw new PrivacyError("INVALID_INPUT");
  return { id: raw.id.toLowerCase(), actorKey: raw.actorKey };
}
export function privacyContinuation(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 100 ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    !/^\/account\/privacy\/data(?:\?lang=(bg|en))?$/.test(value)
  )
    return null;
  return value;
}
/** Persist only an immutable, bounded command; never persist an export or private view in the browser. */
export function decodePending(value: string | null): PrivacyCommand | null {
  if (!value || value.length > PRIVACY_LIMITS.recoveryBytes) return null;
  try {
    return parsePrivacyCommand(JSON.parse(value));
  } catch {
    return null;
  }
}
