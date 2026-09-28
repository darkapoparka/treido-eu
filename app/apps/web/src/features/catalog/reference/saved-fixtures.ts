import type { Product, SavedListing, Store } from "../types";

// Frozen flow 7 / 004, also repeated in flow 8 / 007 and flow 9 / 001.
// These are presentation facts, not current merchant prices or live inventory.
export const savedStores: readonly Store[] = [
  {
    id: "rhode",
    name: "rhode",
    logo: "",
    ratingCount: "",
    description: "",
    categories: ["Shop all"],
  },
];
export const savedProducts: readonly Product[] = [
  {
    id: "rhode-glazing-milk",
    title: "glazing milk",
    storeId: "rhode",
    category: "Skincare",
    images: ["/api/reference-media/saved-glazing-milk"],
    price: { amount: 3200, currency: "USD" },
    ratingCount: "",
    description:
      "The frozen listing supplies the name, price and saved size. Its full product description is not included in this reference.",
    saleUnit: "piece",
    variants: [
      {
        id: "rhode-glazing-milk-big",
        label: "big (4.2 oz)",
        availableQuantity: 12,
      },
    ],
  },
];
// Saved-specific presentation does not overwrite the Home product or pretend
// that an obscured item has a known price, selected size or purchase route.
export const savedListings: readonly SavedListing[] = [
  {
    ...savedProducts[0],
    variantLabel: "big (4.2 oz)",
    photoLayout: "milk",
  },
  {
    id: "home-drmtlgy-eye",
    title: "Luminous Eye Corrector® SPF 41",
    storeId: "drmtlgy",
    images: ["/api/reference-media/saved-eye"],
    price: { amount: 4400, currency: "USD" },
    promotion: "Save $30",
    photoLayout: "eye",
  },
  {
    id: "rhode-pink-captured",
    title: "Pink rhode tube",
    storeId: "rhode",
    images: ["/api/reference-media/saved-pink-partial"],
    photoLayout: "pink-partial",
    detailUnavailable:
      "Only this pink rhode tube is visible in the frozen Saved frame. Its listing name, price and lower photograph are obscured. You can save it or add it to a local collection, but this preview cannot offer an unverified purchase.",
  },
];
