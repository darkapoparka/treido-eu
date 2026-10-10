import { onlyKeys } from "../inventory/model";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import type { HelperChange } from "./sell-helper-model";

export const HELPER_HISTORY_PAGE_SIZE = 20;
export type HelperHistoryQuery = { sellerId: string; before: string | null };
export type HelperHistoryView = {
  sellerId: string;
  items: { requestId: string; operation: "prepare" | "accept" | "discard"; outcome: HelperChange["outcome"]; draftId: string | null; draftRevision: number | null; revision: number; createdAt: string }[];
  nextBefore: string | null;
};
export function parseHelperHistoryQuery(raw: unknown): HelperHistoryQuery {
  if (!onlyKeys(raw, ["sellerId", "before"]) || !validId(raw.sellerId) || (raw.before !== undefined && raw.before !== null && !validId(raw.before)))
    throw new SellerError("INVALID_INPUT");
  return { sellerId: raw.sellerId, before: typeof raw.before === "string" ? raw.before : null };
}
