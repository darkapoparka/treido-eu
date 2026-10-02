import type { Store } from "./types";
import type { MerchantPresentation } from "./merchant-types";
export type {
  MerchantCollection,
  MerchantReviewMediaItem,
} from "./merchant-types";

/** The shared view reads this seller's projection; it never imports the fixture registry. */
export function merchantPresentation(store: Store): MerchantPresentation {
  return (
    store.referenceMerchant ?? {
      source: "catalog",
      background: "#e8e6e1",
      foreground: "#111",
      panel: "#ffffff40",
      avatar: store.logo,
      cover: store.coverImage,
      description: store.description,
      website: store.referenceWebsite,
      rating: store.rating,
      ratingCount: store.ratingCount,
    }
  );
}

export function hasMerchantPresentation(store: Store): boolean {
  return store.referenceStyle === "android";
}
