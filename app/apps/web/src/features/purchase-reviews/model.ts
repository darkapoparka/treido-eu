import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
export const REVIEW_LIMITS = {
  lines: 30,
  perHour: 20,
  page: 20,
  seconds: 900,
} as const;
export type ReviewSource =
  | { kind: "cart"; sellerId: string; cartRevision: number }
  | { kind: "offer"; threadId: string; offerId: string };
export type CreateReview = {
  actorKey: string;
  requestId: string;
  language: "bg" | "en";
  handover: "pickup" | "shipping";
  source: ReviewSource;
};
export type ReviewLine = {
  listingId: string;
  skuId: string;
  publicationRevision: number;
  title: string;
  options: Record<string, string>;
  quantity: number;
  unitPriceMinor: number;
  deliveryDetails: string;
  current: boolean;
  available: number | null;
};
export type PurchaseReview = {
  id: string;
  sellerId: string;
  sellerName: string;
  source: "cart" | "offer";
  language: "bg" | "en";
  currency: "EUR";
  handover: "pickup" | "shipping";
  merchandiseMinor: number;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  allocationId: string | null;
  holdState:
    "active" | "released" | "expired" | "consumed" | "reconciliation" | null;
  threadId: string | null;
  offerId: string | null;
  contactThreadId: string | null;
  revision: number;
  note: string;
  archived: boolean;
  lines: ReviewLine[];
  payment: {
    available: false;
    buyerFeeMinor: null;
    deliveryMinor: null;
    payableMinor: null;
  };
};
export type ReviewIndexItem = Pick<
  PurchaseReview,
  | "id"
  | "sellerName"
  | "source"
  | "merchandiseMinor"
  | "createdAt"
  | "expiresAt"
  | "expired"
  | "archived"
> & { lineCount: number };
export type ReviewIndex = {
  actorKey: string;
  items: ReviewIndexItem[];
  nextBefore: string | null;
};
export function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}
function revision(value: unknown, minimum = 0) {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= minimum &&
    Number(value) < 2147483647
  );
}
export function parseCreateReview(value: unknown): CreateReview {
  if (
    !object(value) ||
    !exact(value, [
      "actorKey",
      "requestId",
      "language",
      "handover",
      "source",
    ]) ||
    typeof value.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.actorKey) ||
    !validId(value.requestId) ||
    !["bg", "en"].includes(String(value.language)) ||
    !["pickup", "shipping"].includes(String(value.handover)) ||
    !object(value.source)
  )
    throw new SellerError("INVALID_INPUT");
  const source = value.source;
  if (
    source.kind === "cart"
      ? !exact(source, ["kind", "sellerId", "cartRevision"]) ||
        !validId(source.sellerId) ||
        !revision(source.cartRevision, 1)
      : source.kind !== "offer" ||
        !exact(source, ["kind", "threadId", "offerId"]) ||
        !validId(source.threadId) ||
        !validId(source.offerId)
  )
    throw new SellerError("INVALID_INPUT");
  return value as CreateReview;
}
export type ReviewEdit = {
  reviewId: string;
  actorKey: string;
  requestId: string;
  expectedRevision: number;
  note: string;
  archived: boolean;
};
export function parseReviewEdit(value: unknown): ReviewEdit {
  if (
    !object(value) ||
    !exact(value, [
      "reviewId",
      "actorKey",
      "requestId",
      "expectedRevision",
      "note",
      "archived",
    ]) ||
    !validId(value.reviewId) ||
    !validId(value.requestId) ||
    typeof value.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.actorKey) ||
    !revision(value.expectedRevision) ||
    typeof value.note !== "string" ||
    value.note.length > 1000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.note) ||
    typeof value.archived !== "boolean"
  )
    throw new SellerError("INVALID_INPUT");
  return { ...value, note: value.note.trim() } as ReviewEdit;
}
export function merchandiseTotal(
  lines: Pick<ReviewLine, "quantity" | "unitPriceMinor">[],
) {
  if (
    !lines.length ||
    lines.length > REVIEW_LIMITS.lines ||
    lines.some(
      (l) =>
        !Number.isSafeInteger(l.quantity) ||
        l.quantity < 1 ||
        l.quantity > 99 ||
        !Number.isSafeInteger(l.unitPriceMinor) ||
        l.unitPriceMinor < 0 ||
        l.unitPriceMinor > 1_000_000_000,
    )
  )
    throw new SellerError("INVALID_INPUT");
  const sum = lines.reduce(
    (total, line) => total + line.quantity * line.unitPriceMinor,
    0,
  );
  if (!Number.isSafeInteger(sum)) throw new SellerError("INVALID_INPUT");
  return sum;
}
/** A bounded plain-text snapshot, not a purchase, payment demand or private note. */
export function reviewMessage(
  review: Pick<
    PurchaseReview,
    "id" | "language" | "lines" | "merchandiseMinor" | "handover"
  >,
): string {
  const bg = review.language === "bg";
  const money = (n: number) => (n / 100).toFixed(2) + " EUR";
  const lines = review.lines.map(
    (l) =>
      `${l.quantity} × ${l.title.replace(/[\r\n]+/g, " ").slice(0, 50)} (${Object.values(
        l.options,
      )
        .join(" / ")
        .replace(/[\r\n]+/g, " ")
        .slice(0, 20)}) — ${money(l.unitPriceMinor * l.quantity)}`,
  );
  return [
    bg
      ? "Запазен преглед на покупка — запитване, не поръчка."
      : "Saved purchase review — an inquiry, not an order.",
    ...lines,
    (bg ? "Стойност на артикулите: " : "Merchandise subtotal: ") +
      money(review.merchandiseMinor),
    bg
      ? "Доставката и таксите не са включени или договорени. Няма извършено плащане."
      : "Delivery and fees are not included or agreed. No payment has been made.",
    (bg ? "Получаване: " : "Handover: ") +
      (review.handover === "pickup"
        ? bg
          ? "лично предаване"
          : "pickup"
        : bg
          ? "доставка по уговорка"
          : "shipping by agreement"),
    (bg ? "Референция: " : "Reference: ") + review.id,
  ].join("\n");
}
