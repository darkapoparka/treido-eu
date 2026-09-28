import type { Product, Store } from "../types";

// Flow 14/001 and 96/004 expose the left edge, title and $12 of this
// recommendation. The rest of its photograph and its rating count are unknown.
// The allowlisted image preserves only the visible product packaging, not UI.
export const storeProducts: readonly Product[] = [
  {
    // Flow 15/001 records this truncated title, price and promotion only.
    // The missing original price, photograph remainder and inventory stay unknown.
    id: "chemical-deep-partial",
    title: "Deep Clea…",
    storeId: "chemical-guys",
    category: "Kits",
    images: ["/api/reference-media/chemical-store-deep-partial"],
    price: { amount: 5199, currency: "USD" },
    promotion: "15% off",
    ratingCount: "",
    description:
      "Only the beginning of this product title and photograph were captured. Its full name, original price, variants and availability are unknown.",
    saleUnit: "package",
    variants: [],
  },
  {
    id: "sugar-scrub",
    title: "Exfoliating Sugar Body Scrub Bar",
    storeId: "kitsch",
    category: "Cleanse",
    images: ["/api/reference-media/store-sugar-partial"],
    price: { amount: 1200, currency: "USD" },
    ratingCount: "",
    description:
      "The storefront capture shows only the left portion of this product photograph. A complete photograph and further product details were not recorded.",
    saleUnit: "package",
    variants: [
      { id: "sugar-scrub-default", label: "One size", availableQuantity: 12 },
    ],
  },
];

export function storefrontProjection(
  stores: readonly Store[],
  scenario: string | undefined,
): readonly Store[] {
  // The collection-saving recording independently advances the rating count.
  // Its product offer label does not rewrite store savings or cart pricing.
  if (scenario === "kitsch-product-saving-offer") {
    return stores.map((store) =>
      store.id === "kitsch" ? { ...store, ratingCount: "195.2K" } : store,
    );
  }
  if (
    scenario === "kitsch-product-arrival" ||
    scenario === "kitsch-product-settled"
  ) {
    return stores.map((store) =>
      store.id === "kitsch"
        ? {
            ...store,
            ...(scenario === "kitsch-product-arrival"
              ? {
                  capturedGrid: {
                    productIds: [
                      "rice-shampoo",
                      "rice-conditioner",
                      "rice-bundle",
                      "shea-butter",
                    ],
                    unidentifiedPhotos: [
                      "/api/reference-media/store-arrival-tail-left",
                      "/api/reference-media/store-arrival-tail-right",
                    ],
                  },
                }
              : {}),
            promotionSavings: scenario === "kitsch-product-arrival" ? 15 : 20,
            ratingCount:
              scenario === "kitsch-product-arrival" ? "194.9K" : "195K",
          }
        : store,
    );
  }
  // The returning source also changes its cart and hero photograph. Do not
  // fabricate those as side effects of pressing Follow: replay this explicitly
  // as the existing following-pair session. The hero mismatch remains open.
  if (scenario !== "following-pair") return stores;
  return stores.map((store) =>
    store.id === "kitsch"
      ? {
          ...store,
          promotionSavings: 15,
          recommendations: [
            { productId: "shea-butter", ratingCount: "3.3K" },
            { productId: "terracotta", ratingCount: "2.1K" },
            { productId: "sugar-scrub" },
          ],
        }
      : store,
  );
}
