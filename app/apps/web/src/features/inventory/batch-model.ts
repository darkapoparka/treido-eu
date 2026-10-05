import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import { onlyKeys, whole, boundedText, INVENTORY_LIMITS } from "./model";
export const STOCK_BATCH_LIMIT = 30;
export type StockBatchLine = {
  listingId: string;
  skuId: string;
  expectedRevision: number;
  onHand: number;
};
export type StockBatchCommand = {
  sellerId: string;
  requestId: string;
  reason: string;
  reasonKind: "adjustment" | "reported_sale" | "restock";
  lines: StockBatchLine[];
};
export type StockBatchResult = {
  lines: {
    listingId: string;
    skuId: string;
    onHand: number;
    revision: number;
    listingRevision: number;
  }[];
};
export function parseStockBatch(raw: unknown): StockBatchCommand {
  if (
    !onlyKeys(raw, [
      "sellerId",
      "requestId",
      "reason",
      "reasonKind",
      "lines",
    ]) ||
    !validId(raw.sellerId) ||
    !validId(raw.requestId) ||
    !["adjustment", "reported_sale", "restock"].includes(
      String(raw.reasonKind),
    ) ||
    !Array.isArray(raw.lines) ||
    !raw.lines.length ||
    raw.lines.length > STOCK_BATCH_LIMIT
  )
    throw new SellerError("INVALID_INPUT");
  const revisions = new Map<string, number>(),
    ids = new Set<string>();
  const lines = raw.lines
    .map((line) => {
      if (
        !onlyKeys(line, ["listingId", "skuId", "expectedRevision", "onHand"]) ||
        !validId(line.listingId) ||
        !validId(line.skuId) ||
        !whole(line.expectedRevision, 1, 2147483000) ||
        !whole(line.onHand, 0, INVENTORY_LIMITS.onHand)
      )
        throw new SellerError("INVALID_INPUT");
      const listingId = line.listingId.toLowerCase(),
        skuId = line.skuId.toLowerCase();
      if (
        ids.has(skuId) ||
        (revisions.has(listingId) &&
          revisions.get(listingId) !== line.expectedRevision)
      )
        throw new SellerError("INVALID_INPUT");
      ids.add(skuId);
      revisions.set(listingId, line.expectedRevision);
      return {
        listingId,
        skuId,
        expectedRevision: line.expectedRevision,
        onHand: line.onHand,
      };
    })
    .sort(
      (a, b) =>
        a.listingId.localeCompare(b.listingId) ||
        a.skuId.localeCompare(b.skuId),
    );
  return {
    sellerId: raw.sellerId.toLowerCase(),
    requestId: raw.requestId.toLowerCase(),
    reason: boundedText(raw.reason, 300, 2),
    reasonKind: raw.reasonKind as StockBatchCommand["reasonKind"],
    lines,
  };
}
