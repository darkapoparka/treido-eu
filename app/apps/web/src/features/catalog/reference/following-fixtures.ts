import type { Product } from "../types";

// Names, amounts and ordering are transcribed from frozen flow 5, frames 3/4.
// These records are loaded only behind the existing reference-preview boundary.
// Variant availability is deterministic preview state, not merchant inventory.
const fragrances = [
  ["amber", "Moroccan Amber", 2099],
  ["mandarin", "Mandarin Coriander", 2100],
  ["cashmere", "White Cashmere & Musk", 1899],
  ["charcoal", "Charcoal", 1899],
  ["lemon", "Lemon Leaf", 2100],
  ["santa-fe", "Santa Fe", 1899],
] as const;

export const followingProducts: readonly Product[] = [
  ...fragrances.map<Product>(([key, title, amount]) => ({
    id: `following-${key}`,
    title,
    storeId: "pura",
    category: "Shop all",
    images: [`/api/reference-media/following-photo-${key}`],
    price: { amount, currency: "USD" },
    promotion: "$30 off order",
    ratingCount: "",
    description:
      "Frozen Following presentation fixture, not live merchant inventory. The capture does not include a complete product description. Lemon Leaf and Santa Fe photography is limited to the recorded visible region; the uncaptured portions are not reconstructed.",
    saleUnit: "piece",
    variants: [
      {
        id: `following-${key}-preview`,
        label: "Captured item",
        availableQuantity: 12,
      },
    ],
  })),
  {
    id: "following-black-bow",
    title: "Black Bow Hair Clip",
    storeId: "kitsch",
    category: "Shop all",
    images: ["/api/reference-media/following-photo-bow"],
    price: { amount: 1000, currency: "USD" },
    ratingCount: "",
    description:
      "Frozen Following presentation fixture. The photograph, title and displayed price are captured; a full product description is not. This is not live merchant inventory.",
    saleUnit: "piece",
    variants: [
      {
        id: "following-black-bow-preview",
        label: "Captured item",
        availableQuantity: 12,
      },
    ],
  },
];
