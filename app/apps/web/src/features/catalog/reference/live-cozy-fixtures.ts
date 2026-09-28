import type { Product, Store } from "../types";
import { hudsonGracePolicies } from "./live-cozy-policies";

// Display-only curation snapshot observed in Shop on emulator-5560, 2026-09-26.
// These are reference prices/ratings, not live offers or inventory. Checkout
// stays behind the existing uncaptured-merchant boundary.
const source = [
  [
    "wake-light",
    "Wake Sleep Light in Pebble White",
    "Tala US",
    29500,
    "USD",
    5,
    "4",
  ],
  [
    "camila-throw",
    "Camila Throw by Morrow Soft Goods",
    "Lulu and Georgia",
    20500,
    "USD",
    5,
    "1",
  ],
  [
    "olive-mugs",
    "Essential Mug, Set of 4 - Olive",
    "Hawkins New York",
    4800,
    "USD",
    4.8,
    "4",
  ],
  ["matisse-throw", "Matisse Throw", "Goodee", 39500, "USD", 5, "16"],
  [
    "hinoki-candle",
    "HINOKI RITUALS CANDLE",
    "RANGER STATION",
    3900,
    "USD",
    4.8,
    "57",
  ],
  ["vera-sconce", "Vera Sconce", "Sophie Lou Jacobsen", 164847, "EUR", 5, "1"],
  ["wavy-lamp", "Mini Wavy Lamp", "Wooj Design", 9500, "USD", 4.8, "97"],
  [
    "nina-rug",
    "Nina Indigo & Rust Rug by Jungalow",
    "Ruggable",
    13900,
    "USD",
    4.6,
    "59",
  ],
  [
    "waffle-pillow",
    "Snug Waffle Mini Pillow",
    "Sunday Citizen",
    7500,
    "USD",
    4.7,
    "120",
  ],
  [
    "teddy-pillow",
    "Teddy Sphere Pillow - Mushroom",
    "House of Leon",
    17000,
    "USD",
    5,
    "3",
  ],
  [
    "fir-candle",
    "Douglas Fir Vetiver Candle",
    "Flamingo Estate",
    6800,
    "USD",
    4.7,
    "231",
  ],
  [
    "striped-basket",
    "T-Striped Shopping Basket",
    "UNDERWATER WEAVING STUDIO",
    45200,
    "USD",
    null,
    "",
  ],
  [
    "sateen-sheets",
    "Luxe Sateen Core Sheet Set",
    "Brooklinen",
    16900,
    "USD",
    4.8,
    "249",
  ],
  [
    "cashmere-throw",
    "Reserve Maison Cashmere Throw Blanket - Cream/Heathered Pewter/Heathered Twig Plaid",
    "Boll & Branch",
    99900,
    "USD",
    null,
    "",
  ],
  [
    "honey-tapers",
    "Hand Dipped Taper Set - Honey",
    "Hawkins New York",
    800,
    "USD",
    4.8,
    "6",
  ],
  [
    "amber-glasses",
    "Rounded Moroccan Glasses Set | Amber",
    "TOAST",
    2800,
    "GBP",
    null,
    "",
  ],
  [
    "match-striker",
    "Cast Iron Brass Match Striker",
    "Hudson Grace",
    7800,
    "USD",
    null,
    "",
  ],
  [
    "pastel-stemware",
    "Estelle Colored Wine Stemware - Set of 6 {Pastel Mixed Set}",
    "Estelle Colored Glass",
    19500,
    "USD",
    4.9,
    "36",
  ],
] as const;

export const cozyStores: readonly Store[] = [
  ...new Set(source.map((row) => row[2])),
].map((name) => ({
  id:
    "live-cozy-store-" +
    name
      .toLowerCase()
      .replaceAll("&", "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
  name,
  logo:
    name === "Hudson Grace"
      ? "/api/reference-media/live-cozy-hudson-logo"
      : name === "Tala US"
        ? "/api/reference-media/live-cozy-tala-logo"
        : "",
  rating: name === "Hudson Grace" ? 4.8 : name === "Tala US" ? 4.7 : undefined,
  ratingCount:
    name === "Hudson Grace" ? "1.4K" : name === "Tala US" ? "97" : "",
  description: "",
  referenceWebsite:
    name === "Hudson Grace" ? "https://hudsongracesf.com" : undefined,
  referencePolicies: name === "Hudson Grace" ? hudsonGracePolicies : undefined,
  categories: ["Home"],
  referenceStyle: "android",
}));
export const cozyProducts: readonly Product[] = source.map(
  ([id, title, name, amount, currency, rating, ratingCount]) => ({
    id: "live-cozy-" + id,
    title,
    storeId: cozyStores.find((store) => store.name === name)!.id,
    category: "Home",
    images:
      id === "wake-light"
        ? [
            "/api/reference-media/live-cozy-wake-light-pdp",
            ...Array.from(
              { length: 9 },
              (_, i) =>
                "/api/reference-media/live-cozy-wake-light-photo-" + (i + 2),
            ),
          ]
        : id === "match-striker"
          ? [
              "/api/reference-media/live-cozy-match-striker-pdp",
              "/api/reference-media/live-cozy-match-striker-photo-2",
            ]
          : ["/api/reference-media/live-cozy-" + id],
    price: { amount, currency },
    rating: rating ?? undefined,
    ratingCount,
    color: id === "wake-light" ? "Pebble White" : undefined,
    description:
      id === "wake-light"
        ? "Wake was created in collaboration with Thomas Heatherwick. Crafted with enduring materials and inspired by nature's rhythms, Wake is tuned to promote better rest and clearer mornings. Begin each day with a gentle symphony of light and sound, and unwind each evening with a calming, warm glow."
        : id === "match-striker"
          ? "Constructed from solid cast iron, this bold Brass Match Striker boasts substantial weight, anchoring itself beautifully in any decor. The exterior surface features a deep knurling pattern, which when paired with strike anywhere matches, creates a flame. Pair with a Hudson Grace Signature Scented Candle for the perfect housewarming or hostess gift."
          : "",
    detail:
      id === "wake-light"
        ? {
            completeDescription: true,
            colorSwatch: "/api/reference-media/live-cozy-wake-light-swatch",
            delivery: {
              postalCode: "9000",
              message: "Shipping not available to this address",
              shippingPolicy: false,
            },
            reviewPreview: {
              distribution: [100, 0, 0, 0, 0],
              reviews: [
                {
                  title:
                    "Love this lamp/clock/art! Highly recommend. It takes a little bit of study and trial and error to get it right, but so worth the effort.",
                  rating: 5,
                  author: "Stephanie",
                  date: "Nov 7, 2025",
                },
              ],
            },
          }
        : id === "match-striker"
          ? {
              descriptionSpecs: [
                '2" x 2" x 2"',
                "Carbon steel with electroplated black zinc",
                "Works with strike anywhere matches - not included",
                "Imported",
              ],
              descriptionLink: {
                label: "Hudson Grace Signature Scented Candle",
                url: "https://hudsongracesf.com/collections/scented-candles",
              },
              delivery: {
                postalCode: "9000",
                message: "Shipping calculated at checkout",
                shippingPolicy: true,
                returns: {
                  message: "Returns accepted within 30 days",
                  disclaimer: "Exclusions may apply. See full policy",
                },
              },
            }
          : undefined,
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    // Preserve the observed quantity control without inventing inventory.
    variants: [
      {
        id: "live-cozy-" + id + "-preview",
        label: "Default",
        availableQuantity: null,
        referenceSelectable: true,
      },
    ],
  }),
);
