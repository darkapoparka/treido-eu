import { validId } from "../selling/draft-model";
export type InboxScope = { sellerId: string | null };
export type InboxQuery = InboxScope & {
  q: string;
  filter: "all" | "unread";
  cursor: string | null;
};
export type InboxItem = {
  id: string;
  listingId: string;
  title: string | null;
  sellerName: string;
  sellerKind: "personal" | "business";
  lastBody: string;
  lastAt: string;
  unread: number;
  blocked: boolean;
};
export type InboxView = {
  items: InboxItem[];
  nextCursor: string | null;
  query: InboxQuery;
};
export type ConversationMessage = {
  id: string;
  sequence: number;
  body: string;
  from: "buyer" | "seller";
  mine: boolean;
  createdAt: string;
  attachments: number;
};
export type ConversationView = {
  id: string;
  listingId: string;
  sellerId: string;
  title: string | null;
  sellerName: string;
  side: "buyer" | "seller";
  canReply: boolean;
  canBlock: boolean;
  blockedByYou: boolean;
  blockedByOther: boolean;
  contactRevision: number;
  lastSequence: number;
  readSequence: number;
  messages: ConversationMessage[];
  olderBefore: number | null;
};
export const inboxLimits = {
  page: 30,
  messages: 50,
  query: 120,
  pollMs: 8000,
} as const;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
export function parseInboxScope(value: unknown): InboxScope | null {
  if (!object(value) || Object.keys(value).some((k) => k !== "sellerId"))
    return null;
  return value.sellerId === null
    ? { sellerId: null }
    : validId(value.sellerId)
      ? { sellerId: value.sellerId.toLowerCase() }
      : null;
}
export function parseInboxQuery(value: unknown): InboxQuery | null {
  if (
    !object(value) ||
    Object.keys(value).some(
      (k) => !["sellerId", "q", "filter", "cursor"].includes(k),
    )
  )
    return null;
  const scope = parseInboxScope({ sellerId: value.sellerId });
  const q = value.q ?? "",
    filter = value.filter ?? "all",
    cursor = value.cursor ?? null;
  if (
    !scope ||
    typeof q !== "string" ||
    q.length > inboxLimits.query ||
    /[\p{Cc}]/u.test(q) ||
    (filter !== "all" && filter !== "unread") ||
    (cursor !== null &&
      (typeof cursor !== "string" ||
        cursor.length > 1024 ||
        !/^[A-Za-z0-9_-]+$/.test(cursor)))
  )
    return null;
  return { ...scope, q: q.trim(), filter, cursor };
}
export function parseConversationQuery(value: unknown) {
  if (
    !object(value) ||
    Object.keys(value).some(
      (k) => !["sellerId", "threadId", "before"].includes(k),
    )
  )
    return null;
  const scope = parseInboxScope({ sellerId: value.sellerId }),
    before = value.before ?? null;
  if (
    !scope ||
    !validId(value.threadId) ||
    (before !== null &&
      (!Number.isSafeInteger(before) ||
        Number(before) < 1 ||
        Number(before) > 2147483647))
  )
    return null;
  return {
    ...scope,
    threadId: value.threadId.toLowerCase(),
    before: before as number | null,
  };
}
export function parseContactCommand(value: unknown) {
  if (
    !object(value) ||
    Object.keys(value).some(
      (k) =>
        ![
          "sellerId",
          "threadId",
          "blocked",
          "requestId",
          "expectedRevision",
        ].includes(k),
    )
  )
    return null;
  const query = parseConversationQuery({
    sellerId: value.sellerId,
    threadId: value.threadId,
  });
  if (
    !query ||
    typeof value.blocked !== "boolean" ||
    !validId(value.requestId) ||
    !Number.isSafeInteger(value.expectedRevision) ||
    Number(value.expectedRevision) < 1 ||
    Number(value.expectedRevision) >= 2147483647
  )
    return null;
  return {
    sellerId: query.sellerId,
    threadId: query.threadId,
    blocked: value.blocked,
    requestId: value.requestId.toLowerCase(),
    expectedRevision: value.expectedRevision as number,
  };
}
export function inboxHref(
  scope: InboxScope,
  locale: "bg" | "en",
  threadId?: string,
  query: Record<string, string> = {},
) {
  const base = scope.sellerId
    ? "/app/sellers/" + scope.sellerId + "/inbox"
    : "/messages";
  const params = new URLSearchParams({ ...query, lang: locale });
  return base + (threadId ? "/" + threadId : "") + "?" + params;
}
