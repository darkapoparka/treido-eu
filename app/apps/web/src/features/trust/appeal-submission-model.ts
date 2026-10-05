import { object } from "../purchase-reviews/model";
import { validId } from "../selling/draft-model";
import { boundedReason } from "./moderation-model";
export type AppealSubmission = {
  actionId: string;
  requestId: string;
  details: string;
};
export type AppealAcknowledgment = { id: string; input: AppealSubmission };
export function parseAppealSubmission(raw: unknown): AppealSubmission | null {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (k) => !["actionId", "requestId", "details"].includes(k),
    ) ||
    !validId(raw.actionId) ||
    !validId(raw.requestId)
  )
    return null;
  const details = boundedReason(raw.details);
  return details
    ? { actionId: raw.actionId, requestId: raw.requestId, details }
    : null;
}
export function parseAppealAcknowledgment(
  raw: unknown,
  input: AppealSubmission,
): AppealAcknowledgment | null {
  if (!object(raw) || !validId(raw.id)) return null;
  const received = parseAppealSubmission(raw.input);
  return received && JSON.stringify(received) === JSON.stringify(input)
    ? { id: raw.id, input: received }
    : null;
}
export type AppealDraft = {
  version: 1;
  details: string;
  pending: AppealSubmission | null;
  rejected: boolean;
  receipt: AppealAcknowledgment | null;
  code: string | null;
};
export const emptyAppealDraft: AppealDraft = {
  version: 1,
  details: "",
  pending: null,
  rejected: false,
  receipt: null,
  code: null,
};
export function parseAppealDraft(raw: string | null, actionId: string) {
  if (!raw) return { draft: emptyAppealDraft, invalid: false };
  try {
    if (raw.length > 14000) throw Error();
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      value.version !== 1 ||
      typeof value.details !== "string" ||
      value.details.length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.details) ||
      typeof value.rejected !== "boolean" ||
      (value.code !== null &&
        (typeof value.code !== "string" || value.code.length > 64))
    )
      throw Error();
    const pending =
      value.pending === null ? null : parseAppealSubmission(value.pending);
    if (
      value.pending !== null &&
      (!pending ||
        pending.actionId !== actionId ||
        pending.details !== value.details.trim())
    )
      throw Error();
    let receipt: AppealAcknowledgment | null = null;
    if (value.receipt !== null) {
      if (!object(value.receipt)) throw Error();
      const input = parseAppealSubmission(value.receipt.input);
      receipt = input ? parseAppealAcknowledgment(value.receipt, input) : null;
      if (!receipt || receipt.input.actionId !== actionId || pending)
        throw Error();
    }
    if (value.rejected && !pending) throw Error();
    return {
      draft: {
        version: 1,
        details: value.details,
        pending,
        rejected: value.rejected,
        receipt,
        code: value.code,
      } as AppealDraft,
      invalid: false,
    };
  } catch {
    return { draft: emptyAppealDraft, invalid: true };
  }
}
