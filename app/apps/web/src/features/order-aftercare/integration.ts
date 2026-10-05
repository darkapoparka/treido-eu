import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import type { Language } from "./model";
export function orderAftercareHref(
  orderId: string,
  sellerId: string | null,
  language: Language,
) {
  if (
    !validId(orderId) ||
    (sellerId !== null && !validId(sellerId)) ||
    (language !== "bg" && language !== "en")
  )
    throw new SellerError("INVALID_INPUT");
  return (
    (sellerId
      ? "/app/sellers/" + sellerId + "/orders/" + orderId + "/support"
      : "/orders/" + orderId + "/support") +
    "?lang=" +
    language
  );
}
export function orderFeedbackHref(orderId: string, language: Language) {
  if (!validId(orderId) || (language !== "bg" && language !== "en"))
    throw new SellerError("INVALID_INPUT");
  return "/orders/" + orderId + "/feedback?lang=" + language;
}
export type { AftercareOwnExport, AftercareView } from "./view";
export type {
  FeedbackOwnExport,
  FeedbackView,
  PublicPurchaseFeedback,
} from "../order-feedback/view";
/** Canonical root connects these actual new source surfaces; URL formation grants no ownership, financial or feedback authority. */
export const ORDER_AFTERCARE_INTEGRATION_VERSION = 1;
