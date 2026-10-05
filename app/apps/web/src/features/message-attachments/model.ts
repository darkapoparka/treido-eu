import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
export const ATTACHMENT_LIMITS = {
  bytes: 3 * 1024 * 1024,
  pixels: 20_000_000,
  edge: 2048,
  perMessage: 4,
  pendingHuman: 24,
  pendingThread: 12,
  daily: 100,
  dailyBytes: 256 * 1024 * 1024,
  writerSeconds: 120,
  unboundHours: 24,
} as const;
export const ATTACHMENT_PURPOSE = "private-message-images-v1";
export type AttachmentScope = { sellerId: string | null; threadId: string };
export type AttachmentView = {
  id: string;
  revision: number;
  state: "staged" | "uploading" | "processing" | "ready" | "removed";
  retryable: boolean;
  width: number | null;
  height: number | null;
};
export function attachmentScope(raw: unknown): AttachmentScope {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new SellerError("INVALID_INPUT");
  const v = raw as Record<string, unknown>;
  if (!validId(v.threadId) || (v.sellerId !== null && !validId(v.sellerId)))
    throw new SellerError("INVALID_INPUT");
  return {
    threadId: v.threadId.toLowerCase(),
    sellerId: v.sellerId === null ? null : (v.sellerId as string).toLowerCase(),
  };
}
export function intakeInput(raw: unknown) {
  const scope = attachmentScope(raw),
    v = raw as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) =>
        ![
          "sellerId",
          "threadId",
          "requestId",
          "bytes",
          "contentType",
          "checksum",
        ].includes(k),
    ) ||
    !validId(v.requestId) ||
    !Number.isSafeInteger(v.bytes) ||
    Number(v.bytes) < 1 ||
    Number(v.bytes) > ATTACHMENT_LIMITS.bytes ||
    !["image/jpeg", "image/png", "image/webp"].includes(
      String(v.contentType),
    ) ||
    typeof v.checksum !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.checksum)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    ...scope,
    requestId: v.requestId.toLowerCase(),
    bytes: Number(v.bytes),
    contentType: v.contentType as string,
    checksum: v.checksum,
  };
}
export function assetInput(raw: unknown) {
  const scope = attachmentScope(raw),
    v = raw as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) => !["sellerId", "threadId", "id", "revision"].includes(k),
    ) ||
    !validId(v.id) ||
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 1 ||
    Number(v.revision) >= 2147483647
  )
    throw new SellerError("INVALID_INPUT");
  return { ...scope, id: v.id.toLowerCase(), revision: Number(v.revision) };
}
export function attachmentHref(scope: AttachmentScope, id: string) {
  return (
    "/api/message-attachments/" +
    id +
    "?" +
    new URLSearchParams({
      threadId: scope.threadId,
      sellerId: scope.sellerId ?? "buyer",
    })
  );
}
