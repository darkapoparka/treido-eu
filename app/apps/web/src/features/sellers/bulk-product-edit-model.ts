import { validId } from "../selling/draft-model";
import { CATALOG_BATCH_SIZE } from "./catalog-organization-model";
import type { SellerErrorCode } from "./errors";

export type BulkProductRow = { id: string; title: string; priceMinor: number | null; revision: number; publication: string; moderation: string };
export type BulkProductEdit = { listingId: string; expectedRevision: number; requestId: string; title: string; priceMinor: number | null };
export type BulkProductEditCommand = { sellerId: string; items: BulkProductEdit[] };
export type BulkProductEditOutcome = { listingId: string; result: { ok: true; revision: number; title: string; priceMinor: number | null } | { ok: false; code: SellerErrorCode } };
export function parseBulkProductEdits(value: unknown): BulkProductEditCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const command = value as Record<string, unknown>;
  if (!validId(command.sellerId) || !Array.isArray(command.items) || !command.items.length || command.items.length > CATALOG_BATCH_SIZE) return null;
  const items: BulkProductEdit[] = [];
  for (const raw of command.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (!validId(item.listingId) || !validId(item.requestId) || !Number.isSafeInteger(item.expectedRevision) || (item.expectedRevision as number) < 1 ||
      typeof item.title !== "string" || item.title.length > 160 ||
      (item.priceMinor !== null && (!Number.isSafeInteger(item.priceMinor) || (item.priceMinor as number) < 0 || (item.priceMinor as number) > 1_000_000_000))) return null;
    items.push({ listingId: item.listingId, requestId: item.requestId, expectedRevision: item.expectedRevision as number, title: item.title, priceMinor: item.priceMinor as number | null });
  }
  if (new Set(items.map((item) => item.listingId)).size !== items.length || new Set(items.map((item) => item.requestId)).size !== items.length) return null;
  return { sellerId: command.sellerId, items: items.sort((a, b) => a.listingId.localeCompare(b.listingId)) };
}
