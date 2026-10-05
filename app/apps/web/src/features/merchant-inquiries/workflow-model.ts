import { object } from "../purchase-reviews/model";
import { validId } from "../selling/draft-model";
import {
  isInquiryStatus,
  parseInquiryCommand,
  type InquiryCommand,
  type InquiryDetail,
  type InquiryResult,
  type InquiryStatus,
} from "./model";

export type InquiryWorkflowView = Pick<
  InquiryDetail,
  "actorKey" | "canManage" | "canReply" | "history"
> & {
  sellerId: string;
  reviewId: string;
  threadId: string;
  status: InquiryStatus;
  revision: number;
};
export function inquiryWorkflowView(
  detail: InquiryDetail,
): InquiryWorkflowView {
  return {
    actorKey: detail.actorKey,
    sellerId: detail.item.sellerId,
    reviewId: detail.item.id,
    threadId: detail.item.threadId,
    status: detail.item.status,
    revision: detail.item.revision,
    canManage: detail.canManage,
    canReply: detail.canReply,
    history: detail.history,
  };
}
export type WorkflowDraft = {
  body: string;
  status: InquiryStatus;
  revision: number;
  attempt: InquiryCommand | null;
  rejected: boolean;
  code: string | null;
  receipt: InquiryResult | null;
};
export function emptyWorkflowDraft(view: InquiryWorkflowView): WorkflowDraft {
  return {
    body: "",
    status: view.status,
    revision: view.revision,
    attempt: null,
    rejected: false,
    code: null,
    receipt: null,
  };
}
function revision(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < 2147483647
  );
}
/** Browser recovery is input only. Malformed pending data blocks new sends rather
 * than silently replacing an operation that might already have committed. */
export function parseWorkflowDraft(
  raw: string | null,
  view: InquiryWorkflowView,
): {
  draft: WorkflowDraft;
  invalid: boolean;
} {
  const fallback = emptyWorkflowDraft(view);
  if (raw === null) return { draft: fallback, invalid: false };
  try {
    if (raw.length > 24000) throw new Error("limit");
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      typeof value.body !== "string" ||
      value.body.length > 4000 ||
      !isInquiryStatus(value.status) ||
      !revision(value.revision) ||
      typeof value.rejected !== "boolean" ||
      (value.code !== null &&
        (typeof value.code !== "string" || value.code.length > 40))
    )
      throw new Error("shape");
    const attempt =
      value.attempt === null ? null : parseInquiryCommand(value.attempt);
    if (
      attempt &&
      (attempt.actorKey !== view.actorKey ||
        attempt.sellerId !== view.sellerId ||
        attempt.reviewId !== view.reviewId)
    )
      throw new Error("scope");
    let receipt: InquiryResult | null = null;
    if (value.receipt !== null) {
      const saved = value.receipt;
      if (
        !object(saved) ||
        !revision(saved.revision) ||
        !revision(saved.acceptedRevision) ||
        !isInquiryStatus(saved.status) ||
        (saved.messageId !== null && !validId(saved.messageId))
      )
        throw new Error("receipt");
      receipt = {
        revision: saved.revision,
        acceptedRevision: saved.acceptedRevision,
        status: saved.status,
        messageId: saved.messageId as string | null,
      };
    }
    return {
      draft: {
        body: value.body,
        status: value.status,
        revision: value.revision,
        attempt,
        rejected: value.rejected && attempt !== null,
        code: value.code as string | null,
        receipt,
      },
      invalid: false,
    };
  } catch {
    return { draft: fallback, invalid: true };
  }
}
