import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
export const INVENTORY_LIMITS = {
  skus: 100,
  dimensions: 3,
  onHand: 1_000_000,
  quantity: 99,
  lines: 20,
  history: 30,
  checkoutSeconds: 900,
  offerSeconds: 3600,
} as const;
export type InventoryEventKind =
  | "setup"
  | "adjustment"
  | "reported_sale"
  | "restock"
  | "reserve"
  | "release"
  | "expire"
  | "consume"
  | "reconcile";
export type InventoryMode = "unique" | "stocked";
export type StockState = "unknown" | "available" | "reserved" | "out_of_stock";
export type VariantOptions = Record<string, string>;
export type InventorySku = {
  id: string;
  sellerSku: string;
  options: VariantOptions;
  priceMinor: number | null;
  onHand: number;
  reserved: number;
  available: number;
  sold: number;
  revision: number;
};
export type InventoryView = {
  sellerId: string;
  listingId: string;
  listingRevision: number;
  title: string;
  kind: "personal" | "business";
  mode: InventoryMode | null;
  maxVariants: number;
  revision: number;
  canManage: boolean;
  canDefine: boolean;
  skus: InventorySku[];
  events: {
    id: string;
    skuId: string;
    kind: InventoryEventKind;
    quantity: number;
    onHandAfter: number;
    reason: string;
    createdAt: string;
  }[];
};
export type PublicSku = {
  id: string;
  options: VariantOptions;
  priceMinor: number;
  available: number;
  onHand: number;
};
export type PublicInventory = {
  mode: InventoryMode | "unknown";
  state: StockState;
  publicationRevision: number;
  skus: PublicSku[];
};
export type InventoryOperation =
  | { kind: "setup"; mode: InventoryMode; onHand: number; sellerSku: string }
  | {
      kind: "variant";
      skuId: string | null;
      sellerSku: string;
      options: VariantOptions;
      priceMinor: number | null;
      onHand?: number;
    }
  | {
      kind: "stock";
      skuId: string;
      onHand: number;
      reason: string;
      reasonKind: "adjustment" | "reported_sale" | "restock";
    }
  | { kind: "archive"; skuId: string };
export type InventoryCommand = {
  sellerId: string;
  listingId: string;
  requestId: string;
  expectedRevision: number;
  operation: InventoryOperation;
};
export type InventoryAcknowledgement = {
  revision: number;
  skuId: string;
  listingRevision: number;
};
export function plainRecord(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
export function onlyKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    plainRecord(value) && Object.keys(value).every((key) => keys.includes(key))
  );
}
export const whole = (
  value: unknown,
  min: number,
  max: number,
): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
export function boundedText(value: unknown, max: number, minimum = 0): string {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value))
    throw new SellerError("INVALID_INPUT");
  const result = value.normalize("NFC").trim();
  if (result.length < minimum || result.length > max)
    throw new SellerError("INVALID_INPUT");
  return result;
}
export function parseOptions(value: unknown): VariantOptions {
  if (
    !plainRecord(value) ||
    Object.keys(value).length > INVENTORY_LIMITS.dimensions
  )
    throw new SellerError("INVALID_INPUT");
  const entries = Object.entries(value).map(
    ([key, item]) =>
      [boundedText(key, 40, 1), boundedText(item, 60, 1)] as const,
  );
  if (
    new Set(entries.map(([key]) => key.toLowerCase())).size !==
      entries.length ||
    entries.some(([key]) =>
      ["__proto__", "constructor", "prototype"].includes(key.toLowerCase()),
    )
  )
    throw new SellerError("INVALID_INPUT");
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}
export function parseInventoryScope(value: unknown) {
  if (
    !onlyKeys(value, ["sellerId", "listingId"]) ||
    !validId(value.sellerId) ||
    !validId(value.listingId)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    sellerId: value.sellerId.toLowerCase(),
    listingId: value.listingId.toLowerCase(),
  };
}
export function parseInventoryCommand(value: unknown): InventoryCommand {
  if (
    !onlyKeys(value, [
      "sellerId",
      "listingId",
      "requestId",
      "expectedRevision",
      "operation",
    ]) ||
    !validId(value.requestId) ||
    !whole(value.expectedRevision, 0, 2147483646) ||
    !plainRecord(value.operation)
  )
    throw new SellerError("INVALID_INPUT");
  const scope = parseInventoryScope({
      sellerId: value.sellerId,
      listingId: value.listingId,
    }),
    op = value.operation;
  let operation: InventoryOperation;
  if (
    op.kind === "setup" &&
    onlyKeys(op, ["kind", "mode", "onHand", "sellerSku"]) &&
    ["unique", "stocked"].includes(String(op.mode)) &&
    whole(op.onHand, 0, op.mode === "unique" ? 1 : INVENTORY_LIMITS.onHand)
  ) {
    operation = {
      kind: "setup",
      mode: op.mode as InventoryMode,
      onHand: op.onHand,
      sellerSku: boundedText(op.sellerSku, 64),
    };
  } else if (
    op.kind === "variant" &&
    onlyKeys(op, [
      "kind",
      "skuId",
      "sellerSku",
      "options",
      "priceMinor",
      "onHand",
    ]) &&
    (op.skuId === null || validId(op.skuId)) &&
    (op.priceMinor === null || whole(op.priceMinor, 0, 1_000_000_000)) &&
    (op.skuId === null
      ? whole(op.onHand, 0, INVENTORY_LIMITS.onHand)
      : op.onHand === undefined)
  ) {
    operation = {
      kind: "variant",
      skuId: typeof op.skuId === "string" ? op.skuId.toLowerCase() : null,
      sellerSku: boundedText(op.sellerSku, 64),
      options: parseOptions(op.options),
      priceMinor: op.priceMinor,
      ...(op.skuId === null ? { onHand: op.onHand as number } : {}),
    };
  } else if (
    op.kind === "stock" &&
    onlyKeys(op, ["kind", "skuId", "onHand", "reason", "reasonKind"]) &&
    validId(op.skuId) &&
    whole(op.onHand, 0, INVENTORY_LIMITS.onHand) &&
    ["adjustment", "reported_sale", "restock"].includes(String(op.reasonKind))
  ) {
    operation = {
      kind: "stock",
      skuId: op.skuId.toLowerCase(),
      onHand: op.onHand,
      reason: boundedText(op.reason, 300, 2),
      reasonKind: op.reasonKind as "adjustment" | "reported_sale" | "restock",
    };
  } else if (
    op.kind === "archive" &&
    onlyKeys(op, ["kind", "skuId"]) &&
    validId(op.skuId)
  )
    operation = { kind: "archive", skuId: op.skuId.toLowerCase() };
  else throw new SellerError("INVALID_INPUT");
  return {
    ...scope,
    requestId: value.requestId.toLowerCase(),
    expectedRevision: value.expectedRevision,
    operation,
  };
}
export function stockState(
  skus: readonly Pick<PublicSku, "available" | "onHand">[],
  configured: boolean,
): StockState {
  return !configured
    ? "unknown"
    : skus.some((s) => s.available > 0)
      ? "available"
      : skus.some((s) => s.onHand > 0)
        ? "reserved"
        : "out_of_stock";
}
export function variantCaption(options: VariantOptions) {
  return Object.entries(options)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}
