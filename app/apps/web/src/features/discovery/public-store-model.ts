import type { BuyerPublicView } from "../catalog/buyer-entry-model";
import type { PublicSeller } from "../catalog/public-discovery-model";
import type { PurchaseFeedbackData } from "./purchase-feedback";

export type PublicStoreView = BuyerPublicView & {
  seller?: PublicSeller;
  purchaseFeedback?: PurchaseFeedbackData;
};
