import { getCategory } from "@treido/contracts/categories";
import { onlyKeys, whole } from "../inventory/model";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import {
  parseToolIntent,
  toolParams,
  type ToolIntent,
} from "../shopping-tools/intent";
import {
  observe,
  type ToolListing,
  type Observation,
} from "../shopping-tools/model";

export const GIFT_LIMITS = {
  candidates: 20,
  shortlist: 4,
  commandBytes: 12000,
} as const;
export const giftOccasions = [
  "none",
  "birthday",
  "celebration",
  "thanks",
  "housewarming",
] as const;
export const giftAges = ["unspecified", "child", "teen", "adult"] as const;
export type GiftBrief = {
  version: 1;
  occasion: (typeof giftOccasions)[number];
  age: (typeof giftAges)[number];
  neededBy: string | null;
  criteria: string;
};
const invalid = (): never => {
  throw new SellerError("INVALID_INPUT");
};
export function giftId(value: unknown): string {
  if (typeof value !== "string" || value.length !== 36 || !validId(value))
    return invalid();
  return value.toLowerCase();
}
export function giftIds(
  value: unknown,
  maximum: number = GIFT_LIMITS.candidates,
): string[] {
  if (!Array.isArray(value) || value.length > maximum) return invalid();
  const ids = value.map(giftId);
  if (new Set(ids).size !== ids.length) return invalid();
  return ids.sort();
}
export function parseGiftBrief(raw: unknown): GiftBrief {
  if (
    !onlyKeys(raw, ["version", "occasion", "age", "neededBy", "criteria"]) ||
    raw.version !== 1 ||
    !giftOccasions.includes(raw.occasion as GiftBrief["occasion"]) ||
    !giftAges.includes(raw.age as GiftBrief["age"])
  )
    return invalid();
  if (raw.neededBy !== null) {
    if (
      typeof raw.neededBy !== "string" ||
      raw.neededBy.length !== 10 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(raw.neededBy)
    )
      return invalid();
    const date = new Date(raw.neededBy + "T00:00:00Z");
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== raw.neededBy
    )
      return invalid();
  }
  const intent = parseToolIntent(raw.criteria, "find-for-me");
  if (
    intent.cursor ||
    !intent.discovery.category ||
    getCategory(intent.discovery.category)?.kind !== "leaf"
  )
    return invalid();
  // Known availability is explicit; an unknown stock declaration cannot fulfill it.
  return {
    version: 1,
    occasion: raw.occasion as GiftBrief["occasion"],
    age: raw.age as GiftBrief["age"],
    neededBy: raw.neededBy as string | null,
    criteria: toolParams(intent).toString(),
  };
}
export function giftIntent(
  brief: GiftBrief,
  cursor: string | null = null,
): ToolIntent {
  const params = new URLSearchParams(brief.criteria);
  if (cursor) params.set("cursor", cursor);
  return parseToolIntent(params.toString(), "find-for-me");
}
export function unsupportedGiftFields(brief: GiftBrief): "arrival"[] {
  return brief.neededBy ? ["arrival"] : [];
}
export type GiftSnapshot = {
  observation: Observation;
  title: string;
  categoryId: string;
  condition: string;
  locality: string;
  attributes: ToolListing["attributes"];
  handover: ToolListing["handover"];
  defects: string | null;
};
export function giftSnapshot(item: ToolListing): GiftSnapshot {
  return {
    observation: observe(item),
    title: item.card.title,
    categoryId: item.card.categoryId,
    condition: item.card.condition,
    locality: item.card.locality,
    attributes: item.attributes,
    handover: item.handover,
    defects: item.defects,
  };
}
export type GiftOperation =
  | { kind: "find"; brief: GiftBrief; confirmed: true }
  | { kind: "page"; briefHash: string; cursor: string }
  | { kind: "choose"; listingIds: string[] }
  | {
      kind: "refresh";
      briefHash: string;
      listingIds: string[];
      expected: { listingId: string; observation: Observation | null }[];
    }
  | { kind: "clear"; briefHash: string; listingIds: string[] };
function parseObserved(raw: unknown): Observation | null {
  if (raw === null) return null;
  if (
    !onlyKeys(raw, [
      "listingId",
      "publicationRevision",
      "skuId",
      "priceMinor",
      "stock",
    ]) ||
    !whole(raw.publicationRevision, 2, 2147483646) ||
    !whole(raw.priceMinor, 0, 1000000000) ||
    !["unknown", "available", "reserved", "out_of_stock"].includes(
      String(raw.stock),
    )
  )
    return invalid();
  return {
    listingId: giftId(raw.listingId),
    publicationRevision: raw.publicationRevision,
    skuId: raw.skuId === null ? null : giftId(raw.skuId),
    priceMinor: raw.priceMinor,
    stock: raw.stock as Observation["stock"],
  };
}
export type GiftCommand = {
  actorKey: string;
  expectedRevision: number;
  requestId: string;
  operation: GiftOperation;
};
export function parseGiftCommand(raw: unknown): GiftCommand {
  let encoded: string;
  try {
    encoded = JSON.stringify(raw) ?? "";
  } catch {
    return invalid();
  }
  if (
    new TextEncoder().encode(encoded).byteLength > GIFT_LIMITS.commandBytes ||
    !onlyKeys(raw, [
      "actorKey",
      "expectedRevision",
      "requestId",
      "operation",
    ]) ||
    typeof raw.actorKey !== "string" ||
    raw.actorKey.length !== 64 ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey) ||
    !whole(raw.expectedRevision, 0, 2147483645) ||
    !onlyKeys(raw.operation, [
      "kind",
      "brief",
      "confirmed",
      "briefHash",
      "cursor",
      "listingIds",
      "expected",
    ])
  )
    return invalid();
  const op = raw.operation;
  let operation: GiftOperation;
  if (
    op.kind === "find" &&
    onlyKeys(op, ["kind", "brief", "confirmed"]) &&
    op.confirmed === true
  )
    operation = {
      kind: "find",
      brief: parseGiftBrief(op.brief),
      confirmed: true,
    };
  else if (op.kind === "choose" && onlyKeys(op, ["kind", "listingIds"]))
    operation = {
      kind: "choose",
      listingIds: giftIds(op.listingIds, GIFT_LIMITS.shortlist),
    };
  else if (
    (op.kind === "page" || op.kind === "refresh" || op.kind === "clear") &&
    typeof op.briefHash === "string" &&
    op.briefHash.length === 64 &&
    /^[a-f0-9]{64}$/.test(op.briefHash)
  ) {
    if (
      op.kind === "page" &&
      onlyKeys(op, ["kind", "briefHash", "cursor"]) &&
      typeof op.cursor === "string" &&
      op.cursor.length > 0 &&
      op.cursor.length <= 4096
    )
      operation = { kind: "page", briefHash: op.briefHash, cursor: op.cursor };
    else if (
      op.kind === "clear" &&
      onlyKeys(op, ["kind", "briefHash", "listingIds"])
    )
      operation = {
        kind: "clear",
        briefHash: op.briefHash,
        listingIds: giftIds(op.listingIds),
      };
    else if (
      op.kind === "refresh" &&
      onlyKeys(op, ["kind", "briefHash", "listingIds", "expected"]) &&
      Array.isArray(op.expected) &&
      op.expected.length <= GIFT_LIMITS.candidates
    ) {
      const listingIds = giftIds(op.listingIds),
        expected = op.expected
          .map((row) => {
            if (!onlyKeys(row, ["listingId", "observation"])) return invalid();
            const listingId = giftId(row.listingId),
              observation = parseObserved(row.observation);
            if (observation && observation.listingId !== listingId)
              return invalid();
            return { listingId, observation };
          })
          .sort((a, b) => a.listingId.localeCompare(b.listingId));
      if (
        JSON.stringify(expected.map((row) => row.listingId)) !==
        JSON.stringify(listingIds)
      )
        return invalid();
      operation = {
        kind: "refresh",
        briefHash: op.briefHash,
        listingIds,
        expected,
      };
    } else return invalid();
  } else return invalid();
  return {
    actorKey: raw.actorKey,
    expectedRevision: raw.expectedRevision,
    requestId: giftId(raw.requestId),
    operation,
  };
}
export type GiftItem = {
  listingId: string;
  position: number;
  observedAt: string;
  observed: GiftSnapshot | null;
  current: ToolListing | null;
  changed: boolean;
  selected: boolean;
};
export type GiftView = {
  actorKey: string;
  revision: number;
  brief: GiftBrief | null;
  briefHash: string;
  nextCursor: string | null;
  unsupported: "arrival"[];
  items: GiftItem[];
  checkedAt: string;
};
export type GiftChange = { revision: number; replayed: boolean; count: number };
