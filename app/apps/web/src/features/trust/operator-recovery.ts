import { object } from "../purchase-reviews/model";
import { validId } from "../selling/draft-model";
import {
  parseModerationInput,
  type ModerationInput,
  type ModerationState,
} from "./moderation-model";
import type { ModerationContext } from "./operations-model";
export type OperatorAttempt = { actorKey: string; input: ModerationInput };
export type OperatorDraft = {
  reason: string;
  state: ModerationState;
  revision: number;
  attempt: OperatorAttempt | null;
  rejected: boolean;
  code: string | null;
  receipt: { id: string; revision: number } | null;
};
export function emptyOperatorDraft(context: ModerationContext): OperatorDraft {
  return {
    reason: "",
    state: context.state,
    revision: context.revision,
    attempt: null,
    rejected: false,
    code: null,
    receipt: null,
  };
}
export function parseOperatorDraft(
  raw: string | null,
  context: ModerationContext,
): { draft: OperatorDraft; invalid: boolean } {
  const fallback = emptyOperatorDraft(context);
  if (!raw) return { draft: fallback, invalid: false };
  try {
    if (raw.length > 14000) throw Error();
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      typeof value.reason !== "string" ||
      value.reason.length > 2000 ||
      !["clear", "restricted", "removed"].includes(String(value.state)) ||
      !Number.isSafeInteger(value.revision) ||
      Number(value.revision) < 1 ||
      Number(value.revision) >= 2147483647 ||
      typeof value.rejected !== "boolean" ||
      (value.code !== null &&
        (typeof value.code !== "string" || value.code.length > 80))
    )
      throw Error();
    let attempt: OperatorAttempt | null = null;
    if (value.attempt !== null) {
      if (!object(value.attempt) || value.attempt.actorKey !== context.actorKey)
        throw Error();
      const input = parseModerationInput(value.attempt.input);
      if (
        !input ||
        input.listingId !== context.listingId ||
        input.reportId !== context.reportId
      )
        throw Error();
      attempt = { actorKey: context.actorKey, input };
    }
    let receipt: OperatorDraft["receipt"] = null;
    if (value.receipt !== null) {
      if (
        !object(value.receipt) ||
        !validId(value.receipt.id) ||
        !Number.isSafeInteger(value.receipt.revision) ||
        Number(value.receipt.revision) < 1
      )
        throw Error();
      receipt = {
        id: value.receipt.id,
        revision: Number(value.receipt.revision),
      };
    }
    return {
      invalid: false,
      draft: {
        reason: value.reason,
        state: value.state as ModerationState,
        revision: Number(value.revision),
        attempt,
        rejected: value.rejected,
        code: value.code as string | null,
        receipt,
      },
    };
  } catch {
    return { draft: fallback, invalid: true };
  }
}
