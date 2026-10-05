import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { object, type ReviewLine } from "../purchase-reviews/model";
export const INQUIRY_STATUSES = [
  "new",
  "in_progress",
  "waiting_buyer",
  "resolved",
  "closed",
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export function isInquiryStatus(value: unknown): value is InquiryStatus {
  return (
    typeof value === "string" &&
    INQUIRY_STATUSES.some((status) => status === value)
  );
}
export type InquiryItem = {
  id: string;
  sellerId: string;
  threadId: string;
  messageId: string;
  language: "bg" | "en";
  source: "cart" | "offer";
  currency: "EUR";
  handover: "pickup" | "shipping";
  merchandiseMinor: number;
  sentAt: string;
  expiresAt: string;
  expired: boolean;
  status: InquiryStatus;
  revision: number;
  lines: ReviewLine[];
};
export type InquiryQueue = {
  actorKey: string;
  sellerId: string;
  canManage: boolean;
  items: InquiryItem[];
  nextBefore: string | null;
};
export type InquiryDetail = {
  actorKey: string;
  item: InquiryItem;
  canManage: boolean;
  canReply: boolean;
  history: {
    revision: number;
    kind: "status" | "reply";
    from: InquiryStatus;
    to: InquiryStatus;
    at: string;
    own: boolean;
  }[];
};
export type InquiryCommand = {
  actorKey: string;
  sellerId: string;
  reviewId: string;
  requestId: string;
  expectedRevision: number;
  operation:
    { kind: "status"; status: InquiryStatus } | { kind: "reply"; body: string };
};
export type InquiryResult = {
  revision: number;
  status: InquiryStatus;
  acceptedRevision: number;
  messageId: string | null;
};
export function parseInquiryCommand(value: unknown): InquiryCommand {
  if (
    !object(value) ||
    Object.keys(value).some(
      (k) =>
        ![
          "actorKey",
          "sellerId",
          "reviewId",
          "requestId",
          "expectedRevision",
          "operation",
        ].includes(k),
    ) ||
    typeof value.actorKey !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.actorKey) ||
    !validId(value.sellerId) ||
    !validId(value.reviewId) ||
    !validId(value.requestId) ||
    !Number.isSafeInteger(value.expectedRevision) ||
    Number(value.expectedRevision) < 0 ||
    Number(value.expectedRevision) >= 2147483647 ||
    !object(value.operation)
  )
    throw new SellerError("INVALID_INPUT");
  const op = value.operation;
  if (op.kind === "status") {
    if (
      Object.keys(op).some((k) => !["kind", "status"].includes(k)) ||
      !isInquiryStatus(op.status)
    )
      throw new SellerError("INVALID_INPUT");
  } else if (op.kind === "reply") {
    if (
      Object.keys(op).some((k) => !["kind", "body"].includes(k)) ||
      typeof op.body !== "string" ||
      op.body.trim().length < 1 ||
      op.body.length > 4000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(op.body)
    )
      throw new SellerError("INVALID_INPUT");
    return {
      ...value,
      operation: { kind: "reply", body: op.body.trim() },
    } as InquiryCommand;
  } else throw new SellerError("INVALID_INPUT");
  return value as InquiryCommand;
}
