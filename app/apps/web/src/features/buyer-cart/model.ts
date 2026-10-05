import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import {
  onlyKeys,
  whole,
  type InventoryMode,
  type VariantOptions,
} from "../inventory/model";
export const CART_LIMITS = { lines: 100, quantity: 99 } as const;
export type CartItem = {
  listingId: string;
  skuId: string;
  sellerId: string;
  sellerName: string;
  title: string;
  photo: string;
  options: VariantOptions;
  mode: InventoryMode;
  publicationRevision: number;
  priceMinor: number;
  available: number;
};
export type CartLine = {
  skuId: string;
  quantity: number;
  item: CartItem | null;
  state: "ready" | "changed" | "shortage" | "unavailable";
};
export type BuyerCart = {
  actorKey: string;
  revision: number;
  lines: CartLine[];
};
export type CartOperation =
  | { kind: "remove"; skuId: string }
  | {
      kind: "add" | "set";
      listingId: string;
      skuId: string;
      publicationRevision: number;
      quantity: number;
    };
export type CartCommand = {
  actorKey: string;
  requestId: string;
  expectedRevision: number;
  operation: CartOperation;
};
export function parseCartCommand(value: unknown): CartCommand {
  if (
    !onlyKeys(value, [
      "actorKey",
      "requestId",
      "expectedRevision",
      "operation",
    ]) ||
    typeof value.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.actorKey) ||
    !validId(value.requestId) ||
    !whole(value.expectedRevision, 0, 2147483646)
  )
    throw new SellerError("INVALID_INPUT");
  const op = value.operation;
  let operation: CartOperation;
  if (
    onlyKeys(op, ["kind", "skuId"]) &&
    op.kind === "remove" &&
    validId(op.skuId)
  )
    operation = { kind: "remove", skuId: op.skuId.toLowerCase() };
  else if (
    onlyKeys(op, [
      "kind",
      "skuId",
      "listingId",
      "publicationRevision",
      "quantity",
    ]) &&
    (op.kind === "add" || op.kind === "set") &&
    validId(op.skuId) &&
    validId(op.listingId) &&
    whole(op.publicationRevision, 2, 2147483646) &&
    whole(op.quantity, 1, CART_LIMITS.quantity)
  )
    operation = {
      kind: op.kind,
      skuId: op.skuId.toLowerCase(),
      listingId: op.listingId.toLowerCase(),
      publicationRevision: op.publicationRevision,
      quantity: op.quantity,
    };
  else throw new SellerError("INVALID_INPUT");
  return {
    actorKey: value.actorKey,
    requestId: value.requestId.toLowerCase(),
    expectedRevision: value.expectedRevision,
    operation,
  };
}
