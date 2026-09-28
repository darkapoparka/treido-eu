import type { Product, Store } from "../types";
// Isolated frozen Home presentation fixtures, not service inventory or merchant assertions.
export const homeStores: readonly Store[] = [
  {
    id: "carpe",
    name: "Carpe",
    logo: "/api/reference-media/home-carpe-wordmark",
    ratingCount: "",
    description:
      "The frozen Home capture includes this shop identity, but not its products or store details.",
    categories: [],
  },
  {
    id: "princess-polly",
    name: "PRINCESS POLLY",
    logo: "",
    rating: 4.5,
    ratingCount: "414.7K",
    description: "",
    categories: ["Shop all"],
  },
  {
    id: "drmtlgy",
    name: "DRMTLGY",
    logo: "",
    rating: 4.5,
    ratingCount: "78.1K",
    description: "",
    categories: ["Shop all"],
  },
  {
    id: "mountain-goat",
    name: "Mountain Goat Soap Co.",
    logo: "/api/reference-media/home-mountain-logo",
    rating: 4.9,
    ratingCount: "2K",
    description: "",
    categories: ["Shop all"],
  },
  {
    id: "loaded-tea",
    name: "The Loaded Tea Shop",
    logo: "/api/reference-media/home-loaded-logo",
    rating: 4.8,
    ratingCount: "101.8K",
    description: "",
    categories: ["Shop all"],
  },
];
export const homeProducts: readonly Product[] = [
  ...[
    {
      id: "home-drmtlgy-bundle",
      title: "Eye treatment and tinted SPF duo",
      amount: 5625,
      was: 7500,
    },
    {
      id: "home-drmtlgy-masks",
      title: "Peptide Nourishing Eye Masks",
      amount: 4400,
    },
  ].map<Product>((item) => ({
    id: item.id,
    title: item.title,
    storeId: "drmtlgy",
    category: "Shop all",
    images: [`/api/reference-media/${item.id}`],
    price: { amount: item.amount, currency: "USD" as const },
    ...(item.was
      ? { compareAt: { amount: item.was, currency: "USD" as const } }
      : {}),
    ratingCount: "",
    description:
      "Frozen Home presentation fixture. Product photography is limited to the unobscured source regions; this is not live merchant inventory.",
    saleUnit: "piece",
    variants: [
      { id: `${item.id}-default`, label: "Default", availableQuantity: 12 },
    ],
  })),
  {
    id: "home-princess-top",
    title: "Sage green top",
    storeId: "princess-polly",
    category: "Shop all",
    images: ["/api/reference-media/home-princess-top"],
    price: {
      amount: 3400,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-princess-top-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
    compareAt: {
      amount: 4900,
      currency: "USD",
    },
  },
  {
    id: "home-princess-dress",
    title: "Black mini dress",
    storeId: "princess-polly",
    category: "Shop all",
    images: ["/api/reference-media/home-princess-dress"],
    price: {
      amount: 6500,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-princess-dress-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
  {
    id: "home-tea-blue",
    title: "Blue loaded tea",
    storeId: "loaded-tea",
    category: "Shop all",
    images: ["/api/reference-media/home-tea-blue"],
    price: {
      amount: 400,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-tea-blue-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
    compareAt: {
      amount: 800,
      currency: "USD",
    },
  },
  {
    id: "home-tea-orange",
    title: "Bahama Mama loaded tea",
    storeId: "loaded-tea",
    category: "Shop all",
    images: ["/api/reference-media/home-tea-orange"],
    price: {
      amount: 400,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-tea-orange-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
    compareAt: {
      amount: 800,
      currency: "USD",
    },
  },
  {
    id: "home-mountain-pink",
    title: "Pink marbled soap",
    storeId: "mountain-goat",
    category: "Shop all",
    images: ["/api/reference-media/home-mountain-pink"],
    price: {
      amount: 900,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-mountain-pink-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
  {
    id: "home-mountain-black",
    title: "Black round soap",
    storeId: "mountain-goat",
    category: "Shop all",
    images: ["/api/reference-media/home-mountain-black"],
    price: {
      amount: 900,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-mountain-black-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
  {
    id: "home-drmtlgy-retinol",
    title: "Retinol Body Lotion",
    storeId: "drmtlgy",
    category: "Shop all",
    images: ["/api/reference-media/home-drmtlgy-retinol"],
    price: {
      amount: 3600,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-drmtlgy-retinol-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
  {
    id: "home-drmtlgy-needleless",
    title: "Needle-less Growth Factor Serum",
    storeId: "drmtlgy",
    category: "Shop all",
    images: ["/api/reference-media/home-drmtlgy-needleless"],
    price: {
      amount: 6900,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-drmtlgy-needleless-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
  {
    id: "home-drmtlgy-eye",
    title: "Luminous Eye Corrector SPF 41",
    storeId: "drmtlgy",
    category: "Shop all",
    images: ["/api/reference-media/home-drmtlgy-eye"],
    price: {
      amount: 4400,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-drmtlgy-eye-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
  {
    id: "home-drmtlgy-tinted",
    title: "Universal Tinted Moisturizer SPF 46",
    storeId: "drmtlgy",
    category: "Shop all",
    images: ["/api/reference-media/home-drmtlgy-tinted"],
    price: {
      amount: 3100,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-drmtlgy-tinted-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
  {
    id: "home-curl-cream",
    title: "Moisturizing Curl Cream",
    storeId: "kitsch",
    category: "Shop all",
    images: ["/api/reference-media/home-curl-cream"],
    price: {
      amount: 1600,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-curl-cream-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
  {
    id: "home-air-dry-cream",
    title: "Smoothing Air Dry Cream",
    storeId: "kitsch",
    category: "Shop all",
    images: ["/api/reference-media/home-air-dry-cream"],
    price: {
      amount: 2100,
      currency: "USD",
    },
    ratingCount: "",
    description:
      "Presentation fixture from the frozen Home campaign. Where a listing name was not captured, the title describes only the visible product.",
    saleUnit: "piece",
    variants: [
      {
        id: "home-air-dry-cream-default",
        label: "One size",
        availableQuantity: 12,
      },
    ],
  },
];
