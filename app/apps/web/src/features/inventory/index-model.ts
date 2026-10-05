import { onlyKeys } from "./model";
import { SellerError } from "../sellers/errors";
export const inventoryFilters = [
  "all",
  "available",
  "reserved",
  "out_of_stock",
  "unknown",
] as const;
export type InventoryFilter = (typeof inventoryFilters)[number];
export type InventoryIndexQuery = {
  q: string;
  status: InventoryFilter;
  cursor: string | null;
};
export function parseInventoryIndexQuery(raw: unknown): InventoryIndexQuery {
  if (!onlyKeys(raw, ["q", "status", "cursor", "lang"]))
    throw new SellerError("INVALID_INPUT");
  const q = raw.q ?? "",
    status = raw.status ?? "all",
    cursor = raw.cursor ?? null;
  if (
    typeof q !== "string" ||
    q.length > 160 ||
    /[\p{Cc}]/u.test(q) ||
    !inventoryFilters.includes(status as InventoryFilter) ||
    (cursor !== null &&
      (typeof cursor !== "string" ||
        cursor.length > 1500 ||
        !/^[-_A-Za-z0-9.]+$/.test(cursor))) ||
    (raw.lang !== undefined && !["bg", "en"].includes(String(raw.lang)))
  )
    throw new SellerError("INVALID_INPUT");
  return {
    q: q.trim(),
    status: status as InventoryFilter,
    cursor: cursor as string | null,
  };
}
export type InventoryIndex = {
  sellerId: string;
  canManage: boolean;
  query: InventoryIndexQuery;
  total: number;
  nextCursor: string | null;
  items: {
    listingId: string;
    skuId: string | null;
    title: string;
    sellerSku: string;
    options: Record<string, string>;
    mode: "unique" | "stocked" | null;
    state: Exclude<InventoryFilter, "all">;
    inventoryRevision: number | null;
    onHand: number | null;
    reserved: number;
    available: number | null;
  }[];
};
export function inventoryIndexHref(
  sellerId: string,
  locale: string,
  query: InventoryIndexQuery,
  cursor?: string,
) {
  const params = new URLSearchParams({ lang: locale });
  if (query.q) params.set("q", query.q);
  if (query.status !== "all") params.set("status", query.status);
  if (cursor) params.set("cursor", cursor);
  return "/app/sellers/" + sellerId + "/inventory?" + params;
}
