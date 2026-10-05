import type { CaseContext } from "./case-model";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import type { ModerationState } from "./moderation-model";
export const REPORT_REASONS = [
  "unsafe",
  "counterfeit",
  "misleading",
  "abuse",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportQuery = {
  state: "all" | "open" | "reviewed" | "resolved";
  kind: "all" | "listing" | "message";
  reason: "all" | ReportReason;
  q: string;
  before: string | null;
};
export type AppealQuery = {
  state: "all" | "open" | "resolved" | "current" | "superseded";
  q: string;
  before: string | null;
};
export type SellerModerationQuery = {
  sellerId: string;
  state: "all" | ModerationState;
  q: string;
  before: string | null;
};
export type ReportItem = {
  id: string;
  resourceKind: "listing" | "message";
  resourceId: string;
  listingId: string;
  title: string | null;
  reason: ReportReason;
  state: "open" | "reviewed";
  revision: number;
  createdAt: string;
  summary: string;
};
export type ModerationContext = {
  actorKey: string;
  listingId: string;
  reportId: string | null;
  revision: number;
  state: ModerationState;
  canModerate: boolean;
  reportState: "open" | "reviewed" | null;
};
export type OperationDecision = {
  id: string;
  reportId: string | null;
  from: ModerationState;
  to: ModerationState;
  revision: number;
  reason: string;
  at: string;
  own: boolean;
};
export type OperationListing = {
  id: string;
  title: string | null;
  sellerName: string;
  publication: string;
  state: ModerationState;
  revision: number;
};
export type ReportDetail = {
  caseContext: CaseContext | null;
  actorKey: string;
  report: ReportItem & { details: string };
  listing: OperationListing;
  context: ModerationContext;
  reportedMessage: null | {
    id: string;
    body: string;
    at: string;
    attachments: number;
  };
  decisions: OperationDecision[];
};
export type AppealItem = {
  resolution: "open" | "resolved";
  id: string;
  actionId: string;
  listingId: string;
  title: string | null;
  details: string;
  at: string;
  appealedRevision: number;
  currentRevision: number;
  appealedState: ModerationState;
  currentState: ModerationState;
};
export type ListingOperation = {
  actorKey: string;
  listing: OperationListing;
  context: ModerationContext;
  decisions: OperationDecision[];
  appeals: AppealItem[];
  nextAppeal: string | null;
};
export type SellerModerationItem = {
  id: string;
  title: string | null;
  state: ModerationState;
  revision: number;
  actionId: string;
  reason: string;
  at: string;
  ownAppeals: number;
};
function text(value: unknown) {
  if (value === undefined) return "";
  if (
    typeof value !== "string" ||
    value.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new SellerError("INVALID_INPUT");
  return value.trim();
}
function before(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!validId(value)) throw new SellerError("INVALID_INPUT");
  return value;
}
export function parseReportQuery(raw: unknown): ReportQuery {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (k) => !["state", "kind", "reason", "q", "before"].includes(k),
    )
  )
    throw new SellerError("INVALID_INPUT");
  const state = raw.state ?? "open",
    kind = raw.kind ?? "all",
    reason = raw.reason ?? "all";
  if (
    typeof state !== "string" ||
    !["all", "open", "reviewed", "resolved"].includes(state) ||
    typeof kind !== "string" ||
    !["all", "listing", "message"].includes(kind) ||
    typeof reason !== "string" ||
    !["all", ...REPORT_REASONS].includes(reason)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    state: state as ReportQuery["state"],
    kind: kind as ReportQuery["kind"],
    reason: reason as ReportQuery["reason"],
    q: text(raw.q),
    before: before(raw.before),
  };
}
export function parseAppealQuery(raw: unknown): AppealQuery {
  if (
    !object(raw) ||
    Object.keys(raw).some((k) => !["state", "q", "before"].includes(k))
  )
    throw new SellerError("INVALID_INPUT");
  const state = raw.state ?? "open";
  if (
    typeof state !== "string" ||
    !["all", "open", "resolved", "current", "superseded"].includes(state)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    state: state as AppealQuery["state"],
    q: text(raw.q),
    before: before(raw.before),
  };
}
export function parseSellerModerationQuery(
  raw: unknown,
): SellerModerationQuery {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (k) => !["sellerId", "state", "q", "before"].includes(k),
    ) ||
    !validId(raw.sellerId)
  )
    throw new SellerError("INVALID_INPUT");
  const state = raw.state ?? "all";
  if (
    typeof state !== "string" ||
    !["all", "clear", "restricted", "removed"].includes(state)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    sellerId: raw.sellerId,
    state: state as SellerModerationQuery["state"],
    q: text(raw.q),
    before: before(raw.before),
  };
}
