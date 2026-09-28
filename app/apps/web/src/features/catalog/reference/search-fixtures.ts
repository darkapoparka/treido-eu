import type { Money, SavedListing } from "../types";

export type CapturedSearchListing = SavedListing & {
  readonly price: Money;
  readonly sellerName: string;
  readonly sellerLogo: string;
  readonly sellerHref?: string;
  readonly sellerRating?: number;
  readonly sellerRatingCount?: string;
  readonly rating: number;
  readonly ratingCount: string;
  readonly sourceFrame: string;
};

// Flow 44 / 006 continues below Related searches with two more result cards.
// Only facts visible in that frozen frame are retained here; complete product
// and mmml storefront destinations remain explicitly unavailable.
export const capturedJeansContinuation = [
  {
    id: "x721-dusted-skinny",
    title: "X721 Dusted Skinny Denim - 4th Day Sun Washed Blue",
    storeId: "mmml",
    sellerName: "mmml",
    sellerLogo: "/api/reference-media/search-mmml-logo",
    images: ["/api/reference-media/search-x721-photo"],
    price: { amount: 7800, currency: "USD" },
    promotion: "Save $10",
    rating: 5,
    ratingCount: "302",
    sourceFrame: "f044-006",
    detailUnavailable:
      "The frozen Search frame supplies this result photograph, title, rating, price, seller identity, and promotion. It does not include the complete product page, variants, inventory, or checkout facts, so this preview does not invent a purchase destination.",
  },
  {
    id: "tough-love-light-wash",
    title: "Tough Love Stretch Straight Leg Jean - Light Wash",
    storeId: "fashion-nova",
    sellerName: "Fashion Nova",
    sellerLogo: "/api/reference-media/fashion-logo",
    sellerHref: "/stores/fashion-nova",
    sellerRating: 4.3,
    sellerRatingCount: "428.8K",
    images: ["/api/reference-media/search-tough-love-photo"],
    price: { amount: 3999, currency: "USD" },
    rating: 5,
    ratingCount: "11",
    sourceFrame: "f044-006",
    detailUnavailable:
      "The frozen Search frame supplies this result photograph, title, rating, price, and seller identity. It does not include this product's complete page, variants, inventory, or checkout facts, so this preview does not invent them.",
  },
] as const satisfies readonly CapturedSearchListing[];

export const searchSavedListings: readonly SavedListing[] =
  capturedJeansContinuation;
