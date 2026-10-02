import { validId } from "../selling/draft-model";
import {
  parseWithdrawalInput,
  type WithdrawalInput,
} from "../selling/publication-model";
import type { SellerErrorCode } from "./errors";

export const PRODUCT_SELECTION_LIMIT = 30;
export type ProductSelection = Omit<WithdrawalInput, "sellerId">;
export type BulkWithdrawalInput = {
  sellerId: string;
  items: ProductSelection[];
};
export type ProductWithdrawalResult = {
  listingId: string;
  result: { ok: true; revision: number } | { ok: false; code: SellerErrorCode };
};

export function parseDuplicateProduct(input: unknown): WithdrawalInput | null {
  const value = parseWithdrawalInput(input);
  return value
    ? {
        ...value,
        sellerId: value.sellerId.toLowerCase(),
        listingId: value.listingId.toLowerCase(),
        requestId: value.requestId.toLowerCase(),
      }
    : null;
}

/** Explicit, bounded rows only. A URL filter or "select all" is never a command. */
export function parseBulkWithdrawal(
  input: unknown,
): BulkWithdrawalInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some((key) => !["sellerId", "items"].includes(key)) ||
    !validId(value.sellerId) ||
    !Array.isArray(value.items) ||
    value.items.length < 1 ||
    value.items.length > PRODUCT_SELECTION_LIMIT
  )
    return null;
  const items: ProductSelection[] = [];
  const ids = new Set<string>();
  const requests = new Set<string>();
  for (const row of value.items) {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      Object.keys(row).some(
        (key) => !["listingId", "expectedRevision", "requestId"].includes(key),
      )
    )
      return null;
    const parsed = parseDuplicateProduct({ ...row, sellerId: value.sellerId });
    if (!parsed || ids.has(parsed.listingId) || requests.has(parsed.requestId))
      return null;
    ids.add(parsed.listingId);
    requests.add(parsed.requestId);
    items.push({
      listingId: parsed.listingId,
      expectedRevision: parsed.expectedRevision,
      requestId: parsed.requestId,
    });
  }
  return { sellerId: value.sellerId.toLowerCase(), items };
}
