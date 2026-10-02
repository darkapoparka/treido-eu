import type { Product } from "./types";

/** Display/save inputs only; a card is not a purchasable inventory record. */
export type ProductCardData = Pick<
  Product,
  | "id"
  | "title"
  | "images"
  | "price"
  | "compareAt"
  | "rating"
  | "ratingCount"
  | "promotion"
  | "referenceStyle"
  | "referenceThumbnails"
  | "referenceImageTreatment"
>;
