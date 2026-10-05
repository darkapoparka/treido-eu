import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { object, type ReviewLine } from "./model";
export type RenewReviewCommand = {
  actorKey: string;
  reviewId: string;
  requestId: string;
  language: "bg" | "en";
  handover: "pickup" | "shipping";
  cartRevision: number | null;
};
export type ReviewRenewalContext = {
  previousId: string | null;
  nextId: string | null;
  expired: boolean;
  source: "cart" | "offer";
  handover: "pickup" | "shipping";
  cartRevision: number | null;
  lines: ReviewLine[];
  merchandiseMinor: number | null;
  available: boolean;
  reason: "cart_empty" | "offer_expired" | "source_changed" | null;
};
export function parseRenewReview(raw: unknown): RenewReviewCommand {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (key) =>
        ![
          "actorKey",
          "reviewId",
          "requestId",
          "language",
          "handover",
          "cartRevision",
        ].includes(key),
    ) ||
    typeof raw.actorKey !== "string" ||
    !/^[0-9a-f]{64}$/.test(raw.actorKey) ||
    !validId(raw.reviewId) ||
    !validId(raw.requestId) ||
    !["bg", "en"].includes(String(raw.language)) ||
    !["pickup", "shipping"].includes(String(raw.handover)) ||
    (raw.cartRevision !== null &&
      (!Number.isSafeInteger(raw.cartRevision) ||
        Number(raw.cartRevision) < 1 ||
        Number(raw.cartRevision) >= 2147483647))
  )
    throw new SellerError("INVALID_INPUT");
  return raw as RenewReviewCommand;
}
