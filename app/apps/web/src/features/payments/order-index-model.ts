import { validId } from "../selling/draft-model";
import type { OrderView } from "./model";

export const ORDER_PAGE_SIZE = 30;
export const orderQueues = ["all", "fulfilment", "financial", "refunded"] as const;
export type OrderQueue = (typeof orderQueues)[number];
export type OrderIndexQuery = {
  q: string;
  queue: OrderQueue;
  before: string | null;
  customerOrder: string | null;
};
export type SellerOrderIndex = {
  sellerId: string;
  sellerName: string;
  actorKey: string;
  observedAt: string;
  query: OrderIndexQuery;
  orders: OrderView[];
  nextBefore: string | null;
  canExport: boolean;
};

export function parseOrderIndexQuery(raw: Record<string, unknown>): OrderIndexQuery | null {
  if (Object.keys(raw).some((key) => !["lang", "q", "queue", "before", "customerOrder"].includes(key))) return null;
  const q = raw.q ?? "", queue = raw.queue ?? "all", before = raw.before ?? null, customerOrder = raw.customerOrder ?? null;
  if (typeof q !== "string" || q.length > 160 || /[\u0000-\u001f\u007f]/.test(q) ||
    !orderQueues.includes(queue as OrderQueue) ||
    (before !== null && !validId(before)) || (customerOrder !== null && !validId(customerOrder)) ||
    (raw.lang !== undefined && !["bg", "en"].includes(raw.lang as string))) return null;
  return { q: q.trim(), queue: queue as OrderQueue, before: typeof before === "string" ? before.toLowerCase() : null, customerOrder: typeof customerOrder === "string" ? customerOrder.toLowerCase() : null };
}

export function orderIndexHref(sellerId: string, language: "bg" | "en", query: OrderIndexQuery, change: Partial<OrderIndexQuery> = {}) {
  const next = { ...query, before: null, ...change };
  const params = new URLSearchParams({ lang: language });
  if (next.q) params.set("q", next.q);
  if (next.queue !== "all") params.set("queue", next.queue);
  if (next.before) params.set("before", next.before);
  if (next.customerOrder) params.set("customerOrder", next.customerOrder);
  return `/app/sellers/${sellerId}/orders?${params}`;
}

/** Literal search, not SQL wildcard syntax. Only used as a bound parameter. */
export function literalOrderSearch(q: string) {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}
