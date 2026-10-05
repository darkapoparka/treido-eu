import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { parseMessageInput } from "./message-model";
export type ReplyCommand = {
  actorSubject: string;
  sellerId: string | null;
  threadId: string;
  requestId: string;
  body: string;
};
export type ReplyReceipt = { id: string; sequence: number; recovered: boolean };
export type ReplyDraft = {
  version: 1;
  body: string;
  attempt: ReplyCommand | null;
  rejected: boolean;
  code: string | null;
  receipt: ReplyReceipt | null;
};
export function parseReplyCommand(raw: unknown): ReplyCommand {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (k) =>
        !["actorSubject", "sellerId", "threadId", "requestId", "body"].includes(
          k,
        ),
    ) ||
    typeof raw.actorSubject !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(raw.actorSubject) ||
    (raw.sellerId !== null && !validId(raw.sellerId))
  )
    throw new SellerError("INVALID_INPUT");
  const input = parseMessageInput({
    threadId: raw.threadId,
    requestId: raw.requestId,
    body: raw.body,
    attachmentIds: [],
  });
  if (!input) throw new SellerError("INVALID_INPUT");
  return {
    actorSubject: raw.actorSubject,
    sellerId: raw.sellerId as string | null,
    threadId: input.threadId,
    requestId: input.requestId,
    body: input.body,
  };
}
export const emptyReplyDraft = (): ReplyDraft => ({
  version: 1,
  body: "",
  attempt: null,
  rejected: false,
  code: null,
  receipt: null,
});
export function parseReplyDraft(
  raw: string | null,
  scope: Pick<ReplyCommand, "actorSubject" | "sellerId" | "threadId">,
): { draft: ReplyDraft; invalid: boolean } {
  if (!raw) return { draft: emptyReplyDraft(), invalid: false };
  try {
    if (raw.length > 24000) throw Error();
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      value.version !== 1 ||
      typeof value.body !== "string" ||
      value.body.length > 4000 ||
      typeof value.rejected !== "boolean" ||
      (value.code !== null &&
        (typeof value.code !== "string" || !/^[A-Z_]{1,64}$/.test(value.code)))
    )
      throw Error();
    const attempt =
      value.attempt === null ? null : parseReplyCommand(value.attempt);
    if (
      attempt &&
      (attempt.actorSubject !== scope.actorSubject ||
        attempt.sellerId !== scope.sellerId ||
        attempt.threadId !== scope.threadId ||
        attempt.body !== value.body.trim())
    )
      throw Error();
    let receipt: ReplyReceipt | null = null;
    if (value.receipt !== null) {
      const saved = value.receipt;
      if (
        !object(saved) ||
        !validId(saved.id) ||
        !Number.isSafeInteger(saved.sequence) ||
        Number(saved.sequence) < 1 ||
        Number(saved.sequence) >= 2147483647 ||
        typeof saved.recovered !== "boolean" ||
        attempt
      )
        throw Error();
      receipt = {
        id: saved.id,
        sequence: Number(saved.sequence),
        recovered: saved.recovered,
      };
    }
    return {
      draft: {
        version: 1,
        body: value.body,
        attempt,
        rejected: value.rejected,
        code: value.code as string | null,
        receipt,
      },
      invalid: false,
    };
  } catch {
    return { draft: emptyReplyDraft(), invalid: true };
  }
}
