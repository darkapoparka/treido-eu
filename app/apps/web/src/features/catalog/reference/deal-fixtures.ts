import type { SavedListing, Store } from "../types";

export type DealListing = SavedListing & {
  price: NonNullable<SavedListing["price"]>;
  reviews: number;
};
export type DealStore = Store & {
  offer: number;
  threshold: number;
  productIds: readonly string[];
  trailingPhoto: string;
};
const image = (name: string) => `/api/reference-media/deals-${name}`;
// Frozen flow 4 / 002–003. Only the visible names, prices and reviews are known.
// These are saved-list projections, never invented sellable SKUs or stock.
export const dealStores: readonly DealStore[] = [
  {
    id: "rinse-bath-body",
    name: "Rinse Bath & Body",
    logo: image("rinse-logo"),
    offer: 10,
    threshold: 35,
    productIds: ["rinse-tres", "rinse-rainbow"],
    trailingPhoto: image("rinse-tail"),
    ratingCount: "",
    description: "",
    categories: [],
  },
  {
    id: "symansays",
    name: "Syman Says Farms",
    logo: image("syman-logo"),
    offer: 20,
    threshold: 60,
    productIds: ["syman-fir", "syman-lilac"],
    trailingPhoto: image("syman-tail"),
    ratingCount: "",
    description: "",
    categories: [],
  },
  {
    id: "francesco-palmieri",
    name: "Francesco Palmieri",
    logo: image("francesco-logo"),
    offer: 15,
    threshold: 70,
    productIds: ["francesco-goat", "francesco-lavender"],
    trailingPhoto: image("francesco-tail"),
    ratingCount: "",
    description: "",
    categories: [],
  },
  {
    id: "solid-hair-care",
    name: "Solid Hair Care",
    logo: image("solid-logo"),
    offer: 10,
    threshold: 30,
    productIds: ["solid-raquels", "solid-mask"],
    trailingPhoto: image("solid-tail"),
    ratingCount: "",
    description: "",
    categories: [],
  },
];
const unavailable =
  "This captured deal includes the visible item name, photograph and price. Its full description, variants, inventory and purchase destination were not recorded. You can save it and add it to a collection.";
const listing = (
  id: string,
  storeId: string,
  title: string,
  amount: number,
  reviews: number,
  photo: string,
): DealListing => ({
  id,
  storeId,
  title,
  price: { amount, currency: "USD" },
  reviews,
  sellerName: dealStores.find((store) => store.id === storeId)!.name,
  images: [image(photo)],
  detailUnavailable: unavailable,
});
export const dealListings: readonly DealListing[] = [
  listing(
    "rinse-tres",
    "rinse-bath-body",
    "Handmade Tres Clay Soap |…",
    800,
    2,
    "rinse-tres",
  ),
  listing(
    "rinse-rainbow",
    "rinse-bath-body",
    "Handmade Rainbow Sherbe…",
    800,
    4,
    "rinse-rainbow",
  ),
  listing(
    "syman-fir",
    "symansays",
    "Frosted Fir LIMITED | Simple…",
    700,
    4,
    "syman-fir",
  ),
  listing(
    "syman-lilac",
    "symansays",
    "LILAC | Goat Milk Lotion",
    700,
    1,
    "syman-lilac",
  ),
  listing(
    "francesco-goat",
    "francesco-palmieri",
    "SOAP BAR - GOAT MILK",
    1000,
    6,
    "francesco-goat",
  ),
  listing(
    "francesco-lavender",
    "francesco-palmieri",
    "SOAP BAR - LAVENDER",
    1000,
    4,
    "francesco-lavender",
  ),
  listing(
    "solid-raquels",
    "solid-hair-care",
    "Raquel’s Favorite - Leave in…",
    3200,
    1,
    "solid-raquels",
  ),
  listing(
    "solid-mask",
    "solid-hair-care",
    "Ultra Repair Hair Mask",
    3600,
    14,
    "solid-mask",
  ),
];
