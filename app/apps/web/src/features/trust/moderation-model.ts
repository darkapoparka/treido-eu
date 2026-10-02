import { validId } from "../selling/draft-model";
export type ModerationState = "clear" | "restricted" | "removed";
export type ModerationInput = {
  listingId: string;
  reportId: string | null;
  requestId: string;
  expectedRevision: number;
  state: ModerationState;
  reason: string;
};
export function boundedReason(value: unknown): string | null {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 2000 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    ? value.trim()
    : null;
}
export function parseModerationInput(value: unknown): ModerationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) =>
        ![
          "listingId",
          "reportId",
          "requestId",
          "expectedRevision",
          "state",
          "reason",
        ].includes(key),
    ) ||
    !validId(input.listingId) ||
    !validId(input.requestId) ||
    (input.reportId != null && !validId(input.reportId)) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    (input.expectedRevision as number) < 1 ||
    !["clear", "restricted", "removed"].includes(String(input.state))
  )
    return null;
  const reason = boundedReason(input.reason);
  if (!reason) return null;
  return {
    listingId: input.listingId,
    reportId: (input.reportId as string | null) ?? null,
    requestId: input.requestId,
    expectedRevision: input.expectedRevision as number,
    state: input.state as ModerationState,
    reason,
  };
}
