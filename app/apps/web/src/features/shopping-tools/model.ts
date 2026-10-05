import type { PublicListingCard } from "../catalog/public-discovery-model";
import type { DiscoveryAttribute } from "../catalog/discovery-input";
import type { StockState, VariantOptions } from "../inventory/model";
import { onlyKeys, whole } from "../inventory/model";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import { TOOL_LIMITS, type ToolIntent } from "./intent";
export type ToolListing = {
  card: PublicListingCard;
  revision: number;
  attributes: Record<string, DiscoveryAttribute>;
  defects: string | null;
  handover: ("pickup" | "shipping")[];
  deliveryDetails: string | null;
  inventory: {
    state: StockState;
    mode: "unknown" | "unique" | "stocked";
    available: number | null;
    variants: number;
  };
  variant: {
    id: string;
    options: VariantOptions;
    priceMinor: number;
    available: number;
  } | null;
  priceBasis: "available_variant" | "listing" | "no_available_variant";
  shippingMinor: null;
  totalMinor: null;
  checkedAt: string;
};
export type ToolResults = {
  intent: ToolIntent;
  items: ToolListing[];
  nextCursor: string | null;
  checkedAt: string;
};
export type Observation = {
  listingId: string;
  publicationRevision: number;
  skuId: string | null;
  priceMinor: number;
  stock: StockState;
};
export function observe(item: ToolListing): Observation {
  return {
    listingId: item.card.id,
    publicationRevision: item.revision,
    skuId: item.variant?.id ?? null,
    priceMinor: item.card.price.amount,
    stock: item.inventory.state,
  };
}
export type ComparisonItem = {
  id: string;
  position: number;
  observation: Observation;
  observedAt: string;
  current: ToolListing | null;
};
export type ComparisonView = {
  actorKey: string;
  revision: number;
  items: ComparisonItem[];
  checkedAt: string;
};
export type ComparisonOperation =
  | { kind: "add"; observation: Observation }
  | { kind: "remove"; selectionId: string }
  | { kind: "reorder"; selectionIds: string[] }
  | { kind: "clear"; selectionIds: string[] }
  | { kind: "refresh"; selectionId: string; observation: Observation };
export type ComparisonCommand = {
  actorKey: string;
  expectedRevision: number;
  requestId: string;
  operation: ComparisonOperation;
};
export type ComparisonChange = {
  revision: number;
  selectionId: string | null;
  replayed: boolean;
};
export type ComparisonAcknowledgment = {
  requestId: string;
  operation: ComparisonOperation["kind"];
  change: ComparisonChange;
};
export function comparisonChanges(
  item: ComparisonItem,
): (
  | "publicationChanged"
  | "variantChanged"
  | "priceChanged"
  | "stockChanged"
  | "publicationUnavailable"
)[] {
  if (!item.current) return ["publicationUnavailable"];
  const saved = item.observation,
    current = observe(item.current);
  const changes: ReturnType<typeof comparisonChanges> = [];
  if (saved.publicationRevision !== current.publicationRevision)
    changes.push("publicationChanged");
  if (saved.skuId !== current.skuId) changes.push("variantChanged");
  if (saved.priceMinor !== current.priceMinor) changes.push("priceChanged");
  if (saved.stock !== current.stock) changes.push("stockChanged");
  return changes;
}
const invalid = (): never => {
  throw new SellerError("INVALID_INPUT");
};
function id(raw: unknown) {
  if (!validId(raw)) return invalid();
  return raw.toLowerCase();
}
function observation(raw: unknown): Observation {
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
    listingId: id(raw.listingId),
    publicationRevision: raw.publicationRevision,
    skuId: raw.skuId === null ? null : id(raw.skuId),
    priceMinor: raw.priceMinor,
    stock: raw.stock as StockState,
  };
}
export function parseComparisonCommand(raw: unknown): ComparisonCommand {
  if (
    !onlyKeys(raw, [
      "actorKey",
      "expectedRevision",
      "requestId",
      "operation",
    ]) ||
    typeof raw.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey) ||
    !whole(raw.expectedRevision, 0, 2147483646) ||
    !onlyKeys(raw.operation, [
      "kind",
      "observation",
      "selectionId",
      "selectionIds",
    ])
  )
    return invalid();
  const op = raw.operation;
  let operation: ComparisonOperation;
  if (op.kind === "add" && onlyKeys(op, ["kind", "observation"]))
    operation = { kind: "add", observation: observation(op.observation) };
  else if (
    op.kind === "refresh" &&
    onlyKeys(op, ["kind", "selectionId", "observation"])
  )
    operation = {
      kind: "refresh",
      selectionId: id(op.selectionId),
      observation: observation(op.observation),
    };
  else if (op.kind === "remove" && onlyKeys(op, ["kind", "selectionId"]))
    operation = { kind: "remove", selectionId: id(op.selectionId) };
  else if (
    (op.kind === "clear" || op.kind === "reorder") &&
    onlyKeys(op, ["kind", "selectionIds"]) &&
    Array.isArray(op.selectionIds) &&
    op.selectionIds.length <= TOOL_LIMITS.selections
  ) {
    const selectionIds = op.selectionIds.map(id);
    if (new Set(selectionIds).size !== selectionIds.length) return invalid();
    operation = { kind: op.kind, selectionIds };
  } else return invalid();
  return {
    actorKey: raw.actorKey,
    expectedRevision: raw.expectedRevision,
    requestId: id(raw.requestId),
    operation,
  };
}
