import type {
  PublicListingCard,
  PublicSeller,
} from "../catalog/public-discovery-model";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";

export const LIBRARY_LIMITS = {
  saved: 2000,
  follows: 1000,
  collections: 100,
  page: 24,
  selection: 100,
  name: 80,
  commandsPerMinute: 120,
} as const;
export type LibraryOperation =
  | { kind: "save"; listingId: string; saved: boolean }
  | { kind: "follow"; sellerId: string; followed: boolean }
  | { kind: "createCollection"; name: string; listingId?: string }
  | { kind: "renameCollection"; collectionId: string; name: string }
  | { kind: "deleteCollection"; collectionId: string }
  | {
      kind: "collectionItem";
      collectionId: string;
      listingId: string;
      included: boolean;
    };
export type LibraryCommand = {
  requestId: string;
  expectedRevision: number;
  actorKey: string;
  operation: LibraryOperation;
};
export type LibraryQuery = {
  view: "state" | "saved" | "following";
  listingIds: string[];
  sellerIds: string[];
  collectionId: string | null;
  pickerId: string | null;
  cursor: string | null;
};
export type LibraryCollection = {
  id: string;
  name: string;
  count: number;
  contains: boolean;
  covers: string[];
};
export type LibraryItem = {
  id: string;
  card: PublicListingCard | null;
  collectionIds: string[];
};
export type LibraryFollow = { id: string; seller: PublicSeller | null };
export type LibraryView = {
  actorKey: string;
  revision: number;
  savedIds: string[];
  followedIds: string[];
  collections: LibraryCollection[];
  items: LibraryItem[];
  follows: LibraryFollow[];
  savedCount: number;
  followingCount: number;
  total: number;
  nextCursor: string | null;
};
export type LibraryChange = { revision: number; resultId: string | null };
function record(
  input: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new SellerError("INVALID_INPUT");
  return input as Record<string, unknown>;
}
function id(value: unknown): string {
  if (!validId(value)) throw new SellerError("INVALID_INPUT");
  return value;
}
function flag(value: unknown): boolean {
  if (typeof value !== "boolean") throw new SellerError("INVALID_INPUT");
  return value;
}
function name(value: unknown): string {
  if (typeof value !== "string") throw new SellerError("INVALID_INPUT");
  const result = value.normalize("NFC").trim();
  if (
    !result ||
    result.length > LIBRARY_LIMITS.name ||
    /[\u0000-\u001f\u007f]/.test(result)
  )
    throw new SellerError("INVALID_INPUT");
  return result;
}
export function parseLibraryOperation(input: unknown): LibraryOperation {
  const value = record(input, [
    "kind",
    "listingId",
    "sellerId",
    "collectionId",
    "name",
    "saved",
    "followed",
    "included",
  ]);
  switch (value.kind) {
    case "save":
      record(value, ["kind", "listingId", "saved"]);
      return {
        kind: value.kind,
        listingId: id(value.listingId),
        saved: flag(value.saved),
      };
    case "follow":
      record(value, ["kind", "sellerId", "followed"]);
      return {
        kind: value.kind,
        sellerId: id(value.sellerId),
        followed: flag(value.followed),
      };
    case "createCollection":
      record(value, ["kind", "name", "listingId"]);
      return {
        kind: value.kind,
        name: name(value.name),
        ...(value.listingId === undefined
          ? {}
          : { listingId: id(value.listingId) }),
      };
    case "renameCollection":
      record(value, ["kind", "collectionId", "name"]);
      return {
        kind: value.kind,
        collectionId: id(value.collectionId),
        name: name(value.name),
      };
    case "deleteCollection":
      record(value, ["kind", "collectionId"]);
      return { kind: value.kind, collectionId: id(value.collectionId) };
    case "collectionItem":
      record(value, ["kind", "collectionId", "listingId", "included"]);
      return {
        kind: value.kind,
        collectionId: id(value.collectionId),
        listingId: id(value.listingId),
        included: flag(value.included),
      };
    default:
      throw new SellerError("INVALID_INPUT");
  }
}
export function parseLibraryCommand(input: unknown): LibraryCommand {
  const value = record(input, [
    "requestId",
    "expectedRevision",
    "actorKey",
    "operation",
  ]);
  if (
    typeof value.expectedRevision !== "number" ||
    !Number.isSafeInteger(value.expectedRevision) ||
    value.expectedRevision < 0 ||
    value.expectedRevision >= 2147483647 ||
    typeof value.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.actorKey)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    requestId: id(value.requestId),
    expectedRevision: value.expectedRevision,
    actorKey: value.actorKey,
    operation: parseLibraryOperation(value.operation),
  };
}
export function parseLibraryQuery(input: unknown): LibraryQuery {
  const value = record(input, [
    "view",
    "listingIds",
    "sellerIds",
    "collectionId",
    "pickerId",
    "cursor",
  ]);
  const ids = (list: unknown): string[] => {
    if (list === undefined) return [];
    if (!Array.isArray(list) || list.length > LIBRARY_LIMITS.selection)
      throw new SellerError("INVALID_INPUT");
    return [...new Set(list.map(id))];
  };
  const view = value.view ?? "state";
  if (view !== "state" && view !== "saved" && view !== "following")
    throw new SellerError("INVALID_INPUT");
  if (
    value.cursor !== undefined &&
    value.cursor !== null &&
    (typeof value.cursor !== "string" || value.cursor.length > 1024)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    view,
    listingIds: ids(value.listingIds),
    sellerIds: ids(value.sellerIds),
    collectionId: value.collectionId == null ? null : id(value.collectionId),
    pickerId: value.pickerId == null ? null : id(value.pickerId),
    cursor: (value.cursor as string | null | undefined) ?? null,
  };
}
