import { validId } from "../selling/draft-model";

export const MESSAGE_LIMITS = {
  body: 4000,
  attachments: 4,
  pageSize: 50,
} as const;
export function parseMessageInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) =>
        !["threadId", "requestId", "body", "attachmentIds"].includes(key),
    ) ||
    !validId(value.threadId) ||
    !validId(value.requestId) ||
    typeof value.body !== "string" ||
    value.body.length > MESSAGE_LIMITS.body ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.body)
  )
    return null;
  const attachments = value.attachmentIds ?? [];
  if (
    !Array.isArray(attachments) ||
    attachments.length > MESSAGE_LIMITS.attachments ||
    attachments.some((id) => !validId(id)) ||
    new Set(attachments).size !== attachments.length
  )
    return null;
  const body = value.body.trim();
  if (!body && !attachments.length) return null;
  return {
    threadId: value.threadId,
    requestId: value.requestId,
    body,
    attachmentIds: attachments as string[],
  };
}
