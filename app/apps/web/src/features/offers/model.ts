import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import { onlyKeys, whole, type PublicInventory } from "../inventory/model";
import {
  parseConversationQuery,
  type InboxScope,
} from "../messaging/inbox-model";
export const OFFER_LIMITS = {
  page: 20,
  hours: [1, 24, 48],
  perHour: 30,
} as const;
export type OfferState =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired"
  | "superseded"
  | "cancelled";
export type OfferEventKind =
  | "created"
  | "countered"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "cancelled"
  | "expired"
  | "hold_expired";
export type OfferMessage = {
  kind: OfferEventKind;
  unitPriceMinor: number;
  quantity: number;
  currency: "EUR";
};
export type OfferItem = {
  id: string;
  proposerSide: "buyer" | "seller";
  skuId: string;
  publicationRevision: number;
  unitPriceMinor: number;
  quantity: number;
  state: OfferState;
  revision: number;
  expiresAt: string;
  sequence: number;
  holdState:
    "active" | "released" | "expired" | "consumed" | "reconciliation" | null;
  holdUntil: string | null;
  timerHistory: { kind: "expired" | "hold_expired"; at: string }[];
};
export type OfferView = {
  actorKey: string;
  threadId: string;
  revision: number;
  side: "buyer" | "seller";
  canNegotiate: boolean;
  canCancel: boolean;
  inventory: PublicInventory | null;
  items: OfferItem[];
  olderBefore: number | null;
};
export type OfferOperation =
  | {
      kind: "propose";
      parentId: string | null;
      skuId: string;
      publicationRevision: number;
      quantity: number;
      unitPriceMinor: number;
      expiresHours: number;
    }
  | { kind: "accept" | "reject" | "withdraw" | "cancel"; offerId: string };
export type OfferCommand = InboxScope & {
  threadId: string;
  requestId: string;
  expectedRevision: number;
  operation: OfferOperation;
};
export function parseOfferQuery(raw: unknown) {
  const query = parseConversationQuery(raw);
  if (!query) throw new SellerError("INVALID_INPUT");
  return query;
}
export function parseOfferCommand(raw: unknown): OfferCommand {
  if (
    !onlyKeys(raw, [
      "sellerId",
      "threadId",
      "requestId",
      "expectedRevision",
      "operation",
    ]) ||
    !validId(raw.requestId) ||
    !whole(raw.expectedRevision, 0, 2147483646)
  )
    throw new SellerError("INVALID_INPUT");
  const query = parseOfferQuery({
      sellerId: raw.sellerId,
      threadId: raw.threadId,
    }),
    op = raw.operation;
  let operation: OfferOperation;
  if (
    onlyKeys(op, [
      "kind",
      "parentId",
      "skuId",
      "publicationRevision",
      "quantity",
      "unitPriceMinor",
      "expiresHours",
    ]) &&
    op.kind === "propose" &&
    (op.parentId === null || validId(op.parentId)) &&
    validId(op.skuId) &&
    whole(op.publicationRevision, 2, 2147483646) &&
    whole(op.quantity, 1, 99) &&
    whole(op.unitPriceMinor, 1, 1_000_000_000) &&
    OFFER_LIMITS.hours.some((hours) => hours === op.expiresHours)
  )
    operation = {
      kind: "propose",
      parentId:
        typeof op.parentId === "string" ? op.parentId.toLowerCase() : null,
      skuId: op.skuId.toLowerCase(),
      publicationRevision: op.publicationRevision,
      quantity: op.quantity,
      unitPriceMinor: op.unitPriceMinor,
      expiresHours: op.expiresHours as number,
    };
  else if (
    onlyKeys(op, ["kind", "offerId"]) &&
    ["accept", "reject", "withdraw", "cancel"].includes(String(op.kind)) &&
    validId(op.offerId)
  )
    operation = {
      kind: op.kind as "accept" | "reject" | "withdraw" | "cancel",
      offerId: op.offerId.toLowerCase(),
    };
  else throw new SellerError("INVALID_INPUT");
  return {
    sellerId: query.sellerId,
    threadId: query.threadId,
    requestId: raw.requestId.toLowerCase(),
    expectedRevision: raw.expectedRevision,
    operation,
  };
}
