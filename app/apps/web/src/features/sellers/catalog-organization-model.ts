import { validId } from "../selling/draft-model";
export const CATALOG_BATCH_SIZE = 30;
export const CATALOG_TAG_LIMIT = 20;
export type CatalogTagsMode = "keep" | "replace" | "add" | "remove";
export type CatalogCollection = { id: string; title: string; description: string; visible: boolean; archived: boolean; revision: number; updatedAt: string; productCount: number };
export type CatalogProduct = { id: string; title: string; publication: string; revision: number; organizationRevision: number; priceMinor: number | null; mediaId: string | null; tags: string[]; member: boolean };
export type ProductOrganization = { listingId: string; revision: number; tags: string[]; collectionIds: string[] };
export type CatalogAcknowledgement = { collectionId?: string; revision?: number; listingIds?: string[] };
type CommandBase = { sellerId: string; requestId: string };
type CollectionFields = { title: string; description: string; visible: boolean };
export type CatalogCommand = CommandBase & (
  | ({ kind: "createCollection" } & CollectionFields)
  | ({ kind: "saveCollection"; collectionId: string; expectedRevision: number } & CollectionFields)
  | { kind: "archiveCollection"; collectionId: string; expectedRevision: number }
  | { kind: "collectionProducts"; collectionId: string; expectedRevision: number; add: string[]; remove: string[] }
  | { kind: "organizeProducts"; products: { listingId: string; expectedRevision: number }[]; tagsMode: CatalogTagsMode; tags: string[]; addCollections: string[]; removeCollections: string[] }
);
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function revision(value: unknown, minimum = 0): value is number { return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) < 2147483647; }
export function normalizeCatalogTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > CATALOG_TAG_LIMIT) return null;
  const tags: string[] = [], seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const tag = entry.normalize("NFC").trim();
    if (!tag || tag.length > 40 || /[\u0000-\u001f\u007f]/.test(tag)) return null;
    const key = tag.toLowerCase();
    if (!seen.has(key)) { seen.add(key); tags.push(tag); }
  }
  return tags;
}
export function applyCatalogTags(current: string[], mode: CatalogTagsMode, changes: string[]): string[] | null {
  if (mode === "keep") return current;
  if (mode === "replace") return normalizeCatalogTags(changes);
  const keys = new Set(changes.map((tag) => tag.toLowerCase()));
  if (mode === "remove") return current.filter((tag) => !keys.has(tag.toLowerCase()));
  const merged = [...current], existing = new Set(current.map((tag) => tag.toLowerCase()));
  for (const tag of changes) if (!existing.has(tag.toLowerCase())) { merged.push(tag); existing.add(tag.toLowerCase()); }
  return normalizeCatalogTags(merged);
}
function ids(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > CATALOG_BATCH_SIZE || value.some((id) => typeof id !== "string" || !validId(id))) return null;
  const normalized = (value as string[]).map((id) => id.toLowerCase());
  return new Set(normalized).size === normalized.length ? normalized.sort() : null;
}
function fields(value: Record<string, unknown>): CollectionFields | null {
  if (typeof value.title !== "string" || typeof value.description !== "string" || typeof value.visible !== "boolean") return null;
  const title = value.title.normalize("NFC").trim(), description = value.description.normalize("NFC").trim();
  if (!title || title.length > 120 || description.length > 2000 || /[\u0000-\u001f\u007f]/.test(title) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(description)) return null;
  return { title, description, visible: value.visible };
}
export function parseCatalogCommand(input: unknown): CatalogCommand | null {
  if (!record(input) || typeof input.sellerId !== "string" || !validId(input.sellerId) || typeof input.requestId !== "string" || !validId(input.requestId)) return null;
  // PostgreSQL UUIDs are canonical lower-case. Revision lookups and receipt hashes
  // must use that same representation, including duplicate detection.
  const base = { sellerId: input.sellerId.toLowerCase(), requestId: input.requestId.toLowerCase() };
  if (input.kind === "organizeProducts") {
    if (!Array.isArray(input.products) || input.products.length < 1 || input.products.length > CATALOG_BATCH_SIZE) return null;
    const products: { listingId: string; expectedRevision: number }[] = [];
    for (const product of input.products) {
      if (!record(product) || typeof product.listingId !== "string" || !validId(product.listingId) || !revision(product.expectedRevision)) return null;
      products.push({ listingId: product.listingId.toLowerCase(), expectedRevision: product.expectedRevision });
    }
    if (new Set(products.map((product) => product.listingId)).size !== products.length) return null;
    const tagsMode = input.tagsMode;
    if (tagsMode !== "keep" && tagsMode !== "replace" && tagsMode !== "add" && tagsMode !== "remove") return null;
    const tags = normalizeCatalogTags(input.tags), addCollections = ids(input.addCollections), removeCollections = ids(input.removeCollections);
    if (!tags || !addCollections || !removeCollections || addCollections.some((id) => removeCollections.includes(id))) return null;
    if (tagsMode === "keep" && (tags.length || (!addCollections.length && !removeCollections.length))) return null;
    return { ...base, kind: "organizeProducts", products: products.sort((a, b) => a.listingId.localeCompare(b.listingId)), tagsMode, tags, addCollections, removeCollections };
  }
  if (input.kind === "createCollection") { const data = fields(input); return data ? { ...base, kind: "createCollection", ...data } : null; }
  if (typeof input.collectionId !== "string" || !validId(input.collectionId) || !revision(input.expectedRevision, 1)) return null;
  const collection = { ...base, collectionId: input.collectionId.toLowerCase(), expectedRevision: input.expectedRevision };
  if (input.kind === "archiveCollection") return { ...collection, kind: "archiveCollection" };
  if (input.kind === "saveCollection") { const data = fields(input); return data ? { ...collection, kind: "saveCollection", ...data } : null; }
  if (input.kind === "collectionProducts") {
    const add = ids(input.add), remove = ids(input.remove);
    if (!add || !remove || (!add.length && !remove.length) || add.length + remove.length > CATALOG_BATCH_SIZE || add.some((id) => remove.includes(id))) return null;
    return { ...collection, kind: "collectionProducts", add, remove };
  }
  return null;
}
