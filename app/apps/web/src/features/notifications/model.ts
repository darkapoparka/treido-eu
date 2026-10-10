import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import type { MatchFeed } from "../saved-searches/model";
import type { SupportUpdateFeed } from "../support/updates-model";

export type NotificationScope = { actorKey: string; sellerId: string | null };
export type NotificationQuery = {
  sellerId: string | null;
  filter: "all" | "unread";
  kind: "all" | "message" | "offer" | "search" | "support";
  q: string;
  before: string | null;
};
export type NotificationItem = {
  id: string;
  threadId: string;
  sequence: number;
  title: string | null;
  sellerName: string;
  body: string;
  at: string;
  unread: boolean;
  offerKind: string | null;
};
export type NotificationFeed = NotificationScope & {
  query: NotificationQuery;
  items: NotificationItem[];
  nextBefore: string | null;
  unreadCount: number;
  matches?: MatchFeed;
  support?: SupportUpdateFeed;
};
export type ReadSelection = {
  messageId: string;
  threadId: string;
  sequence: number;
  requestId: string;
};
export type NotificationReadCommand = NotificationScope & {
  rows: ReadSelection[];
};
export type NotificationReadResult = ReadSelection &
  (
    | { state: "read"; acknowledgedThrough: number }
    | { state: "rejected" | "unresolved"; code: string }
  );
export const NOTIFICATION_LIMIT = 20;
export function validSequence(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) > 0 &&
    Number(value) < 2147483647
  );
}
export function parseNotificationScope(raw: unknown): NotificationScope {
  if (
    !object(raw) ||
    typeof raw.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey) ||
    (raw.sellerId !== null && !validId(raw.sellerId))
  )
    throw new SellerError("INVALID_INPUT");
  return { actorKey: raw.actorKey, sellerId: raw.sellerId as string | null };
}
export function parseNotificationQuery(raw: unknown): NotificationQuery {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (key) => !["sellerId", "filter", "kind", "q", "before"].includes(key),
    ) ||
    (raw.sellerId !== null && !validId(raw.sellerId))
  )
    throw new SellerError("INVALID_INPUT");
  const filter = raw.filter ?? "all",
    kind = raw.kind ?? "all",
    q = raw.q ?? "",
    before = raw.before ?? null;
  if (
    (filter !== "all" && filter !== "unread") ||
    typeof kind !== "string" ||
    !["all", "message", "offer", "search", "support"].includes(kind) ||
    typeof q !== "string" ||
    q.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(q) ||
    (before !== null && (typeof before !== "string" || before.length > 1024))
  )
    throw new SellerError("INVALID_INPUT");
  if (raw.sellerId !== null && ["search", "support"].includes(kind))
    throw new SellerError("INVALID_INPUT");
  return {
    sellerId: raw.sellerId as string | null,
    filter,
    kind: kind as NotificationQuery["kind"],
    q: q.trim(),
    before: before as string | null,
  };
}
export function parseReadSelection(raw: unknown): ReadSelection {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (key) =>
        !["messageId", "threadId", "sequence", "requestId"].includes(key),
    ) ||
    !validId(raw.messageId) ||
    !validId(raw.threadId) ||
    !validId(raw.requestId) ||
    !validSequence(raw.sequence)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    messageId: raw.messageId,
    threadId: raw.threadId,
    requestId: raw.requestId,
    sequence: raw.sequence,
  };
}
export function parseNotificationRead(raw: unknown): NotificationReadCommand {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (key) => !["actorKey", "sellerId", "rows"].includes(key),
    ) ||
    !Array.isArray(raw.rows) ||
    !raw.rows.length ||
    raw.rows.length > NOTIFICATION_LIMIT
  )
    throw new SellerError("INVALID_INPUT");
  const scope = parseNotificationScope(raw),
    rows = raw.rows.map(parseReadSelection);
  if (
    new Set(rows.map((row) => row.messageId)).size !== rows.length ||
    new Set(rows.map((row) => row.requestId)).size !== rows.length
  )
    throw new SellerError("INVALID_INPUT");
  return { ...scope, rows };
}
export function notificationsHref(
  sellerId: string | null,
  language: string,
  query: Partial<Omit<NotificationQuery, "sellerId">> = {},
) {
  const params = new URLSearchParams({ lang: language });
  for (const key of ["filter", "kind", "q", "before"] as const)
    if (query[key]) params.set(key, query[key]);
  return (
    (sellerId
      ? "/app/sellers/" + sellerId + "/notifications"
      : "/notifications") +
    "?" +
    params
  );
}
