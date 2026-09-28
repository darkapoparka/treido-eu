import type { SavedListing } from "../types";

// Flow 54 / 005 shows a partial next result. Its name, seller and price are
// known; full photography, variants, stock and product detail are not. A saved
// projection retains this identity without manufacturing a purchasable SKU.
export const solSavedListings: readonly SavedListing[] = [
  {
    id: "hush-glasses",
    title: "HUSH",
    storeId: "fork-eyewear",
    images: [],
    price: { amount: 9500, currency: "USD" },
    detailUnavailable:
      "HUSH by FORK Eyewear — $95.00 in the captured recommendation. Only a partial photograph was included; full product details and purchasing options were not captured.",
  },
];
