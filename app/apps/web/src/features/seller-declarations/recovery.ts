import {
  parseReviewDeclarationInput,
  record,
  type DeclarationDecision,
  type ReviewDeclarationInput,
} from "./model";
export type DeclarationDraft = {
  reason: string;
  decision: DeclarationDecision;
  attempt: ReviewDeclarationInput | null;
  rejected: boolean;
};
export const emptyDeclarationDraft: DeclarationDraft = {
  reason: "",
  decision: "accepted",
  attempt: null,
  rejected: false,
};
export function declarationRecoveryKey(
  actorKey: string,
  declarationId: string,
) {
  return `treido-declaration-review:${actorKey}:${declarationId}`;
}
export function parseDeclarationDraft(
  raw: string | null,
  sellerId: string,
  declarationId: string,
): { draft: DeclarationDraft; invalid: boolean } {
  if (!raw) return { draft: { ...emptyDeclarationDraft }, invalid: false };
  try {
    if (raw.length > 8000) throw Error();
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      Object.keys(value).length !== 4 ||
      Object.keys(value).some(
        (key) => !["reason", "decision", "attempt", "rejected"].includes(key),
      ) ||
      typeof value.reason !== "string" ||
      value.reason.length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.reason) ||
      (value.decision !== "accepted" && value.decision !== "rejected") ||
      typeof value.rejected !== "boolean"
    )
      throw Error();
    const attempt =
      value.attempt === null
        ? null
        : parseReviewDeclarationInput(value.attempt);
    if (
      value.attempt !== null &&
      (!attempt ||
        attempt.sellerId !== sellerId ||
        attempt.declarationId !== declarationId ||
        attempt.reason !== value.reason.trim() ||
        attempt.decision !== value.decision)
    )
      throw Error();
    return {
      invalid: false,
      draft: {
        reason: value.reason,
        decision: value.decision as DeclarationDecision,
        attempt,
        rejected: value.rejected,
      },
    };
  } catch {
    return { draft: { ...emptyDeclarationDraft }, invalid: true };
  }
}
