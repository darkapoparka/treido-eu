import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { boundedReason, type ModerationState } from "./moderation-model";

export type TrustCaseKind = "message_report" | "appeal";
export const reportOutcomes = [
  "no_violation",
  "violation_recorded",
  "message_hidden",
] as const;
export const appealOutcomes = ["upheld", "revised", "dismissed"] as const;
export type CaseOutcome =
  (typeof reportOutcomes)[number] | (typeof appealOutcomes)[number];
export type CaseCommand = {
  kind: TrustCaseKind;
  caseId: string;
  resourceId: string;
  originalActionId: string | null;
  requestId: string;
  expectedRevision: number;
  expectedResourceRevision: number;
  outcome: CaseOutcome;
  nextState: ModerationState | null;
  reason: string;
};
/** Safe communicated projection. No operator/reporter identity, evidence or other appeals. */
export type CaseDecision = {
  id: string;
  kind: TrustCaseKind;
  caseId: string;
  resourceId: string;
  revision: number;
  resourceRevision: number;
  outcome: CaseOutcome;
  reason: string;
  actionId: string | null;
  state: ModerationState | "visible" | "hidden";
  at: string;
};
export type CaseReceipt = { command: CaseCommand; decision: CaseDecision };
export type CaseContext = {
  actorKey: string;
  kind: TrustCaseKind;
  caseId: string;
  resourceId: string;
  originalActionId: string | null;
  revision: number;
  resourceRevision: number;
  state: ModerationState | "visible" | "hidden";
  status: "open" | "resolved";
  available: boolean;
  canDecide: boolean;
  decision: CaseDecision | null;
};
export function revision(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 1 &&
    Number(value) <= 2147483647
  );
}
export function parseCaseCommand(raw: unknown): CaseCommand | null {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (key) =>
        ![
          "kind",
          "caseId",
          "resourceId",
          "originalActionId",
          "requestId",
          "expectedRevision",
          "expectedResourceRevision",
          "outcome",
          "nextState",
          "reason",
        ].includes(key),
    ) ||
    !["message_report", "appeal"].includes(String(raw.kind)) ||
    !validId(raw.caseId) ||
    !validId(raw.resourceId) ||
    !validId(raw.requestId) ||
    !revision(raw.expectedRevision) ||
    !revision(raw.expectedResourceRevision) ||
    raw.expectedRevision >= 2147483647 ||
    ((raw.outcome === "message_hidden" || raw.outcome === "revised") &&
      raw.expectedResourceRevision >= 2147483647)
  )
    return null;
  const reason = boundedReason(raw.reason);
  if (!reason) return null;
  if (raw.kind === "message_report") {
    if (
      raw.originalActionId !== null ||
      raw.nextState !== null ||
      !reportOutcomes.includes(raw.outcome as (typeof reportOutcomes)[number])
    )
      return null;
  } else if (
    !validId(raw.originalActionId) ||
    !appealOutcomes.includes(raw.outcome as (typeof appealOutcomes)[number]) ||
    (raw.outcome === "revised"
      ? !["clear", "restricted", "removed"].includes(String(raw.nextState))
      : raw.nextState !== null)
  )
    return null;
  return {
    kind: raw.kind as TrustCaseKind,
    caseId: raw.caseId,
    resourceId: raw.resourceId,
    originalActionId: raw.originalActionId as string | null,
    requestId: raw.requestId,
    expectedRevision: raw.expectedRevision,
    expectedResourceRevision: raw.expectedResourceRevision,
    outcome: raw.outcome as CaseOutcome,
    nextState: raw.nextState as ModerationState | null,
    reason,
  };
}
export function sameCaseCommand(a: CaseCommand, b: CaseCommand) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function parseCaseReceipt(
  raw: unknown,
  command: CaseCommand,
): CaseReceipt | null {
  if (!object(raw) || !object(raw.decision)) return null;
  const accepted = parseCaseCommand(raw.command),
    d = raw.decision;
  if (
    !accepted ||
    !sameCaseCommand(accepted, command) ||
    !validId(d.id) ||
    d.kind !== command.kind ||
    d.caseId !== command.caseId ||
    d.resourceId !== command.resourceId ||
    d.revision !== command.expectedRevision + 1 ||
    !revision(d.resourceRevision) ||
    d.outcome !== command.outcome ||
    d.reason !== command.reason ||
    (d.actionId !== null && !validId(d.actionId)) ||
    typeof d.at !== "string" ||
    !Number.isFinite(Date.parse(d.at)) ||
    !["clear", "restricted", "removed", "visible", "hidden"].includes(
      String(d.state),
    )
  )
    return null;
  const acts =
    command.outcome === "message_hidden" || command.outcome === "revised";
  if (
    (d.actionId !== null) !== acts ||
    d.resourceRevision !== command.expectedResourceRevision + (acts ? 1 : 0) ||
    (command.outcome === "message_hidden" && d.state !== "hidden") ||
    (command.outcome === "revised" && d.state !== command.nextState)
  )
    return null;
  return { command: accepted, decision: d as CaseDecision };
}
export type CaseDraft = {
  version: 1;
  revision: number;
  resourceRevision: number;
  outcome: CaseOutcome;
  nextState: ModerationState;
  reason: string;
  attempt: CaseCommand | null;
  receipt: CaseReceipt | null;
  rejected: boolean;
  code: string | null;
};
export function emptyCaseDraft(context: CaseContext): CaseDraft {
  return {
    version: 1,
    revision: context.revision,
    resourceRevision: context.resourceRevision,
    outcome: context.kind === "appeal" ? "upheld" : "no_violation",
    nextState: "clear",
    reason: "",
    attempt: null,
    receipt: null,
    rejected: false,
    code: null,
  };
}
export function parseCaseDraft(
  raw: string | null,
  context: CaseContext,
): { draft: CaseDraft; invalid: boolean } {
  const empty = emptyCaseDraft(context);
  if (raw === null) return { draft: empty, invalid: false };
  try {
    if (raw.length > 20000) throw Error();
    const v: unknown = JSON.parse(raw);
    if (
      !object(v) ||
      v.version !== 1 ||
      !revision(v.revision) ||
      !revision(v.resourceRevision) ||
      typeof v.reason !== "string" ||
      v.reason.length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v.reason) ||
      !(
        context.kind === "appeal" ? [...appealOutcomes] : [...reportOutcomes]
      ).includes(v.outcome as never) ||
      !["clear", "restricted", "removed"].includes(String(v.nextState)) ||
      typeof v.rejected !== "boolean" ||
      (v.code !== null && (typeof v.code !== "string" || v.code.length > 64))
    )
      throw Error();
    const attempt = v.attempt === null ? null : parseCaseCommand(v.attempt);
    if (
      v.attempt !== null &&
      (!attempt ||
        attempt.kind !== context.kind ||
        attempt.caseId !== context.caseId ||
        attempt.resourceId !== context.resourceId ||
        attempt.originalActionId !== context.originalActionId ||
        attempt.expectedRevision !== v.revision ||
        attempt.expectedResourceRevision !== v.resourceRevision ||
        attempt.reason !== v.reason.trim() ||
        attempt.outcome !== v.outcome ||
        (attempt.outcome === "revised" && attempt.nextState !== v.nextState))
    )
      throw Error();
    let receipt: CaseReceipt | null = null;
    if (v.receipt !== null) {
      if (!object(v.receipt)) throw Error();
      const command = parseCaseCommand(v.receipt.command);
      receipt = command ? parseCaseReceipt(v.receipt, command) : null;
      if (
        !receipt ||
        receipt.command.kind !== context.kind ||
        receipt.command.caseId !== context.caseId ||
        receipt.command.resourceId !== context.resourceId ||
        receipt.command.originalActionId !== context.originalActionId ||
        attempt
      )
        throw Error();
    }
    if (v.rejected && !attempt) throw Error();
    return { draft: { ...v, attempt, receipt } as CaseDraft, invalid: false };
  } catch {
    return { draft: empty, invalid: true };
  }
}
