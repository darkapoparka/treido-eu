import type { Product, Store } from "../types";

// Frozen recommendation facts from f061-006 and f063-002/003. Quantities use
// the same isolated presentation fixture as sibling source products; they do
// not represent live merchant inventory or a connected purchase service.
export const orderProducts: readonly Product[] = [
  {
    id: "order-tire-trim",
    title: "Tire+Trim Gel Plastic and Rubber High-Glo…",
    storeId: "chemical-guys",
    category: "Shop all",
    images: ["/api/reference-media/order-tire-trim-photo"],
    price: { amount: 2499, currency: "USD" },
    rating: 5,
    ratingCount: "46",
    promotion: "Save $20",
    description:
      "The frozen order recommendation captures this product's photograph, title and price. Its full product description is not included.",
    saleUnit: "piece",
    variants: [
      {
        id: "order-tire-trim-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
  {
    id: "order-peach-bee",
    title: "Peach Bee Balm",
    storeId: "my-bee-balm",
    category: "Shop all",
    images: ["/api/reference-media/order-peach-bee-photo"],
    price: { amount: 500, currency: "USD" },
    compareAt: { amount: 1999, currency: "USD" },
    rating: 5,
    ratingCount: "7.1K",
    promotion: "Save $5",
    description:
      "The frozen order recommendation captures this product's photograph, title and price. Its full product description is not included.",
    saleUnit: "piece",
    variants: [
      {
        id: "order-peach-bee-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
];

export const orderStores: readonly Store[] = [
  {
    id: "my-bee-balm",
    name: "My Bee Balm",
    logo: "",
    ratingCount: "",
    description: "",
    categories: ["Shop all"],
  },
];

export const orderGridDeals = {
  transit: [
    { photo: "order-deal-blue-bag", promotion: "Save $5" },
    { photo: "order-deal-white-treatment", promotion: "Save $30" },
    { photo: "order-deal-strawberry-balm", promotion: "Save $5" },
    { photo: "order-deal-mascara", promotion: "Save $25" },
    { photo: "order-deal-hush", promotion: "Save $25" },
    { photo: "order-deal-carpe", promotion: "Save $20" },
  ],
  delivered: [
    { photo: "order-deal-blue-bag", promotion: "Save $5" },
    { photo: "order-deal-dropper", promotion: "$10 off order" },
    { photo: "order-deal-strawberry-balm", promotion: "Save $5" },
    { photo: "order-deal-white-treatment", promotion: "Save $25" },
    { photo: "order-deal-mascara", promotion: "Save $25" },
    { photo: "order-deal-hush", promotion: "Save $25" },
  ],
} as const;
