import type { Product, Store } from "../types";

// Display-only native Shop snapshot, emulator-5560, 2026-09-27.
// Merchant photography is independently verified; quantities never imply stock.
export const liveShelfStores: readonly Store[] = [
  {
    id: "live-explore-our-place",
    name: "Our Place",
    logo: "/api/reference-media/live-shelf-our-place-logo",
    rating: 4.6,
    ratingCount: "101K",
    description: "",
    categories: ["Home"],
    referenceStyle: "android",
    referenceWebsite: "https://fromourplace.com",
  },
  {
    id: "live-explore-ruggable",
    name: "Ruggable",
    logo: "/api/reference-media/live-shelf-ruggable-logo",
    rating: 4.7,
    ratingCount: "305.7K",
    description: "",
    categories: ["Home"],
    referenceStyle: "android",
    referenceWebsite: "https://ruggable.com",
  },
  {
    id: "live-explore-cozy-earth",
    name: "Cozy Earth",
    logo: "/api/reference-media/live-shelf-cozy-earth-logo",
    rating: 4.6,
    ratingCount: "88.8K",
    description: "",
    categories: ["Home"],
    referenceStyle: "android",
    referenceWebsite: "https://cozyearth.com",
  },
];
export const liveShelfProducts: readonly Product[] = [
  {
    id: "live-explore-perfect-pot",
    title: "Ceramic Nonstick Perfect Pot 6.5 qt.",
    storeId: "live-explore-our-place",
    category: "Home",
    images: [
      "/api/reference-media/live-shelf-pot-photo-8",
      "/api/reference-media/live-shelf-pot-photo-1",
      "/api/reference-media/live-shelf-pot-photo-2",
      "/api/reference-media/live-shelf-pot-photo-3",
      "/api/reference-media/live-shelf-pot-photo-4",
      "/api/reference-media/live-shelf-pot-photo-5",
      "/api/reference-media/live-shelf-pot-photo-6",
      "/api/reference-media/live-shelf-pot-photo-7",
      "/api/reference-media/live-shelf-pot-photo-9",
      "/api/reference-media/live-shelf-pot-photo-10",
      "/api/reference-media/live-shelf-pot-photo-11",
      "/api/reference-media/live-shelf-pot-photo-12",
      "/api/reference-media/live-shelf-pot-photo-13",
      "/api/reference-media/live-shelf-pot-photo-14",
      "/api/reference-media/live-shelf-pot-photo-15",
      "/api/reference-media/live-shelf-pot-photo-16",
      "/api/reference-media/live-shelf-pot-photo-17",
      "/api/reference-media/live-shelf-pot-photo-18",
      "/api/reference-media/live-shelf-pot-photo-19",
      "/api/reference-media/live-shelf-pot-photo-20",
      "/api/reference-media/live-shelf-pot-photo-21",
      "/api/reference-media/live-shelf-pot-photo-22",
    ],
    price: {
      amount: 14900,
      currency: "USD",
    },
    rating: 4.8,
    ratingCount: "8.8K",
    description: "An 8-in-1 family-sized, stovetop-to-oven nonstick pot",
    detail: {
      completeDescription: true,
      referenceBadge: "500+ bought in past month",
      colorGallery: [
        "/api/reference-media/live-shelf-pot-photo-1",
        "/api/reference-media/live-shelf-pot-photo-2",
        "/api/reference-media/live-shelf-pot-photo-3",
        "/api/reference-media/live-shelf-pot-photo-4",
        "/api/reference-media/live-shelf-pot-photo-5",
        "/api/reference-media/live-shelf-pot-photo-6",
        "/api/reference-media/live-shelf-pot-photo-7",
        "/api/reference-media/live-shelf-pot-photo-8",
        "/api/reference-media/live-shelf-pot-photo-9",
        "/api/reference-media/live-shelf-pot-photo-10",
        "/api/reference-media/live-shelf-pot-photo-11",
        "/api/reference-media/live-shelf-pot-photo-12",
        "/api/reference-media/live-shelf-pot-photo-13",
        "/api/reference-media/live-shelf-pot-photo-14",
        "/api/reference-media/live-shelf-pot-photo-15",
        "/api/reference-media/live-shelf-pot-photo-16",
        "/api/reference-media/live-shelf-pot-photo-17",
        "/api/reference-media/live-shelf-pot-photo-18",
        "/api/reference-media/live-shelf-pot-photo-19",
        "/api/reference-media/live-shelf-pot-photo-20",
        "/api/reference-media/live-shelf-pot-photo-21",
        "/api/reference-media/live-shelf-pot-photo-22",
      ],
      referenceBadgeTone: "neutral",
      delivery: {
        postalCode: "9000",
        message: "Shipping calculated at checkout",
        shippingPolicy: false,
      },
      reviewPreview: {
        distribution: [89, 5, 2, 1, 3],
        reviews: [
          {
            title: "The Perfect Pot!",
            rating: 5,
            author: "Reece",
            date: "Aug 11, 2026",
          },
          {
            title: "Safe pan options.",
            rating: 5,
            author: "Pamela",
            date: "Aug 10, 2026",
          },
        ],
        cardWidth: 280,
      },
    },
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-explore-pot-spice",
        label: "Spice",
        availableQuantity: null,
        referenceSelectable: true,
        referenceColor: {
          swatch: "#e09d81",
          photo: "/api/reference-media/live-shelf-pot-photo-8",
        },
      },
      {
        id: "live-explore-pot-char",
        label: "Char",
        availableQuantity: null,
        referenceSelectable: true,
        referenceColor: {
          swatch: "#595752",
          photo: "/api/reference-media/live-shelf-pot-photo-1",
        },
      },
      {
        id: "live-explore-pot-blue-salt",
        label: "Blue Salt",
        availableQuantity: null,
        referenceSelectable: true,
        referenceColor: {
          swatch: "#748ea1",
          photo: "/api/reference-media/live-shelf-pot-photo-2",
        },
      },
      {
        id: "live-explore-pot-sage",
        label: "Sage",
        availableQuantity: null,
        referenceSelectable: true,
        referenceColor: {
          swatch: "#7d836e",
          photo: "/api/reference-media/live-shelf-pot-photo-7",
        },
      },
      {
        id: "live-explore-pot-clay",
        label: "Clay",
        availableQuantity: null,
        referenceColor: {
          swatch: "#623932",
          photo: "/api/reference-media/live-shelf-pot-photo-10",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-lavender",
        label: "Lavender",
        availableQuantity: null,
        referenceColor: {
          swatch: "#94888e",
          photo: "/api/reference-media/live-shelf-pot-photo-9",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-steam",
        label: "Steam",
        availableQuantity: null,
        referenceSelectable: true,
        referenceColor: {
          swatch: "#cdc7b3",
          photo: "/api/reference-media/live-shelf-pot-photo-6",
        },
      },
      {
        id: "live-explore-pot-vanilla-bean",
        label: "Vanilla Bean",
        availableQuantity: null,
        referenceSelectable: true,
        referenceColor: {
          swatch: "linear-gradient(#705951, #d0c8b3 70%)",
          photo: "/api/reference-media/live-shelf-pot-photo-22",
        },
      },
      {
        id: "live-explore-pot-turmeric",
        label: "Turmeric",
        availableQuantity: null,
        referenceColor: {
          swatch: "#9a6e33",
          photo: "/api/reference-media/live-shelf-pot-photo-11",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-charm",
        label: "Charm",
        availableQuantity: null,
        referenceColor: {
          swatch: "#5b2932",
          photo: "/api/reference-media/live-shelf-pot-photo-19",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-rosa",
        label: "Rosa",
        availableQuantity: null,
        referenceColor: {
          swatch: "#731431",
          photo: "/api/reference-media/live-shelf-pot-photo-20",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-azul",
        label: "Azul",
        availableQuantity: null,
        referenceColor: {
          swatch: "#192d72",
          photo: "/api/reference-media/live-shelf-pot-photo-21",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-cielo",
        label: "Cielo",
        availableQuantity: null,
        referenceColor: {
          swatch: "#778e8c",
          photo: "/api/reference-media/live-shelf-pot-photo-17",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-tierra",
        label: "Tierra",
        availableQuantity: null,
        referenceColor: {
          swatch: "#5f5241",
          photo: "/api/reference-media/live-shelf-pot-photo-18",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-firecracker",
        label: "Firecracker",
        availableQuantity: null,
        referenceColor: {
          swatch: "#66131a",
          photo: "/api/reference-media/live-shelf-pot-photo-16",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-eve",
        label: "Eve",
        availableQuantity: null,
        referenceColor: {
          swatch: "transparent",
          photo: "/api/reference-media/live-shelf-pot-photo-15",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-aura",
        label: "Aura",
        availableQuantity: null,
        referenceColor: {
          swatch: "transparent",
          photo: "/api/reference-media/live-shelf-pot-photo-14",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-acid",
        label: "Acid",
        availableQuantity: null,
        referenceColor: {
          swatch: "transparent",
          photo: "/api/reference-media/live-shelf-pot-photo-13",
          unavailable: true,
        },
      },
      {
        id: "live-explore-pot-blanch",
        label: "Blanch",
        availableQuantity: null,
        referenceColor: {
          swatch: "transparent",
          photo: "/api/reference-media/live-shelf-pot-photo-12",
          unavailable: true,
        },
      },
    ],
  },
  {
    id: "live-explore-verena-rug",
    title: "Verena Dark Wood Flatwoven Rug",
    storeId: "live-explore-ruggable",
    category: "Home",
    images: [
      "/api/reference-media/live-shelf-rug-photo-9",
      "/api/reference-media/live-shelf-rug-photo-1",
      "/api/reference-media/live-shelf-rug-photo-2",
      "/api/reference-media/live-shelf-rug-photo-3",
      "/api/reference-media/live-shelf-rug-photo-4",
      "/api/reference-media/live-shelf-rug-photo-5",
      "/api/reference-media/live-shelf-rug-photo-6",
      "/api/reference-media/live-shelf-rug-photo-7",
      "/api/reference-media/live-shelf-rug-photo-8",
      "/api/reference-media/live-shelf-rug-photo-10",
      "/api/reference-media/live-shelf-rug-photo-11",
      "/api/reference-media/live-shelf-rug-photo-12",
      "/api/reference-media/live-shelf-rug-photo-13",
      "/api/reference-media/live-shelf-rug-photo-14",
      "/api/reference-media/live-shelf-rug-photo-15",
      "/api/reference-media/live-shelf-rug-photo-16",
      "/api/reference-media/live-shelf-rug-photo-17",
      "/api/reference-media/live-shelf-rug-photo-18",
      "/api/reference-media/live-shelf-rug-photo-19",
      "/api/reference-media/live-shelf-rug-photo-20",
      "/api/reference-media/live-shelf-rug-photo-21",
      "/api/reference-media/live-shelf-rug-photo-22",
    ],
    price: {
      amount: 8900,
      currency: "USD",
    },
    rating: 4.8,
    ratingCount: "4.4K",
    description:
      "Verena Dark Wood Rug gives a classic Persian theme a modern farmhouse feel. This rug features an ornate border around intricate gem-like shapes that are spaciously spread out across an open field. Its color, a deep rustic brown that's almost black, is slightly distressed for that rustic appeal.",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 0.8199445983379502,
    detail: {
      completeDescription: true,
      referenceBadge: "200+ bought in past month",
      referenceBadgeTone: "neutral",
      optionGroups: [
        {
          name: "Rug",
          showSelection: true,
        },
        {
          name: "Size",
          limit: 7,
        },
      ],
      colorGallery: [
        "/api/reference-media/live-shelf-rug-photo-1",
        "/api/reference-media/live-shelf-rug-photo-2",
        "/api/reference-media/live-shelf-rug-photo-3",
        "/api/reference-media/live-shelf-rug-photo-4",
        "/api/reference-media/live-shelf-rug-photo-5",
        "/api/reference-media/live-shelf-rug-photo-6",
        "/api/reference-media/live-shelf-rug-photo-7",
        "/api/reference-media/live-shelf-rug-photo-8",
        "/api/reference-media/live-shelf-rug-photo-9",
        "/api/reference-media/live-shelf-rug-photo-10",
        "/api/reference-media/live-shelf-rug-photo-11",
        "/api/reference-media/live-shelf-rug-photo-12",
        "/api/reference-media/live-shelf-rug-photo-13",
        "/api/reference-media/live-shelf-rug-photo-14",
        "/api/reference-media/live-shelf-rug-photo-15",
        "/api/reference-media/live-shelf-rug-photo-16",
        "/api/reference-media/live-shelf-rug-photo-17",
        "/api/reference-media/live-shelf-rug-photo-18",
        "/api/reference-media/live-shelf-rug-photo-19",
        "/api/reference-media/live-shelf-rug-photo-20",
        "/api/reference-media/live-shelf-rug-photo-21",
        "/api/reference-media/live-shelf-rug-photo-22",
      ],
      delivery: {
        postalCode: "9000",
        message: "Shipping not available to this address",
        shippingPolicy: true,
      },
      reviewPreview: {
        distribution: [88, 8, 2, 1, 1],
        reviews: [
          {
            title: "The Perfect Rug",
            rating: 5,
            author: "Nancy",
            date: "4 days ago",
          },
          {
            title: "Beautiful and easy to maintain",
            rating: 5,
            author: "Abigail",
            date: "27 days ago",
          },
        ],
        cardWidth: 280,
      },
    },
    variants: [
      {
        id: "live-explore-rug-39389502210103",
        label: "Rug + Pad System / 2'x3'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "2'x3'",
        },
        referencePrice: {
          amount: 8900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-9",
      },
      {
        id: "live-explore-rug-32154783383607",
        label: "Rug + Pad System / 2.5'x7'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "2.5'x7'",
        },
        referencePrice: {
          amount: 15900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-10",
      },
      {
        id: "live-explore-rug-32154783416375",
        label: "Rug + Pad System / 2.5'x10'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "2.5'x10'",
        },
        referencePrice: {
          amount: 19900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-11",
      },
      {
        id: "live-explore-rug-40222694998071",
        label: "Rug + Pad System / 2.5'x12'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "2.5'x12'",
        },
        referencePrice: {
          amount: 21900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-12",
      },
      {
        id: "live-explore-rug-32154783449143",
        label: "Rug + Pad System / 3'x5'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "3'x5'",
        },
        referencePrice: {
          amount: 13900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-13",
      },
      {
        id: "live-explore-rug-39839567773751",
        label: "Rug + Pad System / 4'x6'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "4'x6'",
        },
        referencePrice: {
          amount: 20900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-14",
      },
      {
        id: "live-explore-rug-32154783481911",
        label: "Rug + Pad System / 5'x7'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "5'x7'",
        },
        referencePrice: {
          amount: 23900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-1",
      },
      {
        id: "live-explore-rug-32154783514679",
        label: "Rug + Pad System / 6'x9'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "6'x9'",
        },
        referencePrice: {
          amount: 36900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-15",
      },
      {
        id: "live-explore-rug-32154783547447",
        label: "Rug + Pad System / 8'x10'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "8'x10'",
        },
        referencePrice: {
          amount: 57900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-16",
      },
      {
        id: "live-explore-rug-32292704092215",
        label: "Rug + Pad System / 9'x12'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "9'x12'",
        },
        referencePrice: {
          amount: 72900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-17",
      },
      {
        id: "live-explore-rug-40196984864823",
        label: "Rug + Pad System / 10'x14'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "10'x14'",
        },
        referencePrice: {
          amount: 95900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-18",
      },
      {
        id: "live-explore-rug-32154783580215",
        label: "Rug + Pad System / 6' Round",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "6' Round",
        },
        referencePrice: {
          amount: 26900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-19",
      },
      {
        id: "live-explore-rug-32154783612983",
        label: "Rug + Pad System / 8' Round",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Pad System",
          Size: "8' Round",
        },
        referencePrice: {
          amount: 37900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-20",
      },
      {
        id: "live-explore-rug-39686909919287",
        label: "Rug + Cushioned Pad System / 2'x3'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "2'x3'",
        },
        referencePrice: {
          amount: 11900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-9",
      },
      {
        id: "live-explore-rug-32421539840055",
        label: "Rug + Cushioned Pad System / 2.5'x7'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "2.5'x7'",
        },
        referencePrice: {
          amount: 18900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-10",
      },
      {
        id: "live-explore-rug-32421539872823",
        label: "Rug + Cushioned Pad System / 2.5'x10'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "2.5'x10'",
        },
        referencePrice: {
          amount: 23900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-11",
      },
      {
        id: "live-explore-rug-32421539905591",
        label: "Rug + Cushioned Pad System / 3'x5'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "3'x5'",
        },
        referencePrice: {
          amount: 16900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-13",
      },
      {
        id: "live-explore-rug-39839567806519",
        label: "Rug + Cushioned Pad System / 4'x6'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "4'x6'",
        },
        referencePrice: {
          amount: 25900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-14",
      },
      {
        id: "live-explore-rug-32421539938359",
        label: "Rug + Cushioned Pad System / 5'x7'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "5'x7'",
        },
        referencePrice: {
          amount: 29900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-1",
      },
      {
        id: "live-explore-rug-32421539971127",
        label: "Rug + Cushioned Pad System / 6'x9'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "6'x9'",
        },
        referencePrice: {
          amount: 46900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-15",
      },
      {
        id: "live-explore-rug-32421540003895",
        label: "Rug + Cushioned Pad System / 8'x10'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "8'x10'",
        },
        referencePrice: {
          amount: 67900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-16",
      },
      {
        id: "live-explore-rug-39686909952055",
        label: "Rug + Cushioned Pad System / 9'x12'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "9'x12'",
        },
        referencePrice: {
          amount: 90900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-17",
      },
      {
        id: "live-explore-rug-40295328186423",
        label: "Rug + Cushioned Pad System / 10'x14'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "10'x14'",
        },
        referencePrice: {
          amount: 125900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-18",
      },
      {
        id: "live-explore-rug-32421540036663",
        label: "Rug + Cushioned Pad System / 6' Round",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "6' Round",
        },
        referencePrice: {
          amount: 33900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-19",
      },
      {
        id: "live-explore-rug-32421540069431",
        label: "Rug + Cushioned Pad System / 8' Round",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Rug + Cushioned Pad System",
          Size: "8' Round",
        },
        referencePrice: {
          amount: 49900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-20",
      },
      {
        id: "live-explore-rug-39389502242871",
        label: "Washable Rug Cover / 2'x3'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "2'x3'",
        },
        referencePrice: {
          amount: 6900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-9",
      },
      {
        id: "live-explore-rug-32154783645751",
        label: "Washable Rug Cover / 2.5'x7'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "2.5'x7'",
        },
        referencePrice: {
          amount: 10900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-10",
      },
      {
        id: "live-explore-rug-32154783678519",
        label: "Washable Rug Cover / 2.5'x10'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "2.5'x10'",
        },
        referencePrice: {
          amount: 14900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-11",
      },
      {
        id: "live-explore-rug-40222695030839",
        label: "Washable Rug Cover / 2.5'x12'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "2.5'x12'",
        },
        referencePrice: {
          amount: 15900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-12",
      },
      {
        id: "live-explore-rug-32154783711287",
        label: "Washable Rug Cover / 3'x5'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "3'x5'",
        },
        referencePrice: {
          amount: 10900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-13",
      },
      {
        id: "live-explore-rug-39839567839287",
        label: "Washable Rug Cover / 4'x6'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "4'x6'",
        },
        referencePrice: {
          amount: 15900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-14",
      },
      {
        id: "live-explore-rug-32154783744055",
        label: "Washable Rug Cover / 5'x7'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "5'x7'",
        },
        referencePrice: {
          amount: 16900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-1",
      },
      {
        id: "live-explore-rug-32154783776823",
        label: "Washable Rug Cover / 6'x9'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "6'x9'",
        },
        referencePrice: {
          amount: 24900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-15",
      },
      {
        id: "live-explore-rug-32154783809591",
        label: "Washable Rug Cover / 8'x10'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "8'x10'",
        },
        referencePrice: {
          amount: 40900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-16",
      },
      {
        id: "live-explore-rug-32292704124983",
        label: "Washable Rug Cover / 9'x12'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "9'x12'",
        },
        referencePrice: {
          amount: 50900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-17",
      },
      {
        id: "live-explore-rug-40196984930359",
        label: "Washable Rug Cover / 10'x14'",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "10'x14'",
        },
        referencePrice: {
          amount: 66900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-18",
      },
      {
        id: "live-explore-rug-32154783842359",
        label: "Washable Rug Cover / 6' Round",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "6' Round",
        },
        referencePrice: {
          amount: 18900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-19",
      },
      {
        id: "live-explore-rug-32154783875127",
        label: "Washable Rug Cover / 8' Round",
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Rug: "Washable Rug Cover",
          Size: "8' Round",
        },
        referencePrice: {
          amount: 25900,
          currency: "USD",
        },
        referenceImage: "/api/reference-media/live-shelf-rug-photo-20",
      },
    ],
  },
  {
    id: "live-explore-bubble-blanket",
    title: "Bubble Cuddle Blanket",
    storeId: "live-explore-cozy-earth",
    category: "Home",
    images: [
      "/api/reference-media/live-shelf-blanket-photo-1",
      "/api/reference-media/live-shelf-blanket-photo-2",
      "/api/reference-media/live-shelf-blanket-photo-3",
      "/api/reference-media/live-shelf-blanket-photo-4",
      "/api/reference-media/live-shelf-blanket-photo-5",
      "/api/reference-media/live-shelf-blanket-photo-6",
      "/api/reference-media/live-shelf-blanket-photo-7",
      "/api/reference-media/live-shelf-blanket-photo-8",
      "/api/reference-media/live-shelf-blanket-photo-9",
      "/api/reference-media/live-shelf-blanket-photo-10",
      "/api/reference-media/live-shelf-blanket-photo-11",
      "/api/reference-media/live-shelf-blanket-photo-12",
      "/api/reference-media/live-shelf-blanket-photo-13",
      "/api/reference-media/live-shelf-blanket-photo-14",
      "/api/reference-media/live-shelf-blanket-photo-15",
      "/api/reference-media/live-shelf-blanket-photo-16",
      "/api/reference-media/live-shelf-blanket-photo-17",
      "/api/reference-media/live-shelf-blanket-photo-18",
      "/api/reference-media/live-shelf-blanket-photo-19",
      "/api/reference-media/live-shelf-blanket-photo-20",
      "/api/reference-media/live-shelf-blanket-photo-21",
      "/api/reference-media/live-shelf-blanket-photo-22",
      "/api/reference-media/live-shelf-blanket-photo-23",
      "/api/reference-media/live-shelf-blanket-photo-24",
      "/api/reference-media/live-shelf-blanket-photo-25",
    ],
    price: {
      amount: 28295,
      currency: "EUR",
    },
    rating: 4.8,
    ratingCount: "589",
    description:
      "Lose yourself in luxury with our Bubble Cuddle Blanket. This blanket offers a combination of comfort and style with its distinctively textured design intricately woven from ultra-soft fibers. Showcasing an extended, plush pile and mid-weight construction, this faux fur blanket makes the perfect centerpiece for your living room or bedroom.",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 0.8199445983379502,
    detail: {
      completeDescription: true,
      descriptionInitiallyCollapsed: true,
      referenceBadge: "500+ bought in past month",
      referenceBadgeTone: "neutral",
      optionGroups: [
        {
          name: "Color",
          colors: true,
        },
        {
          name: "Size",
          showSelection: true,
        },
      ],
      colorGallery: [
        "/api/reference-media/live-shelf-blanket-photo-1",
        "/api/reference-media/live-shelf-blanket-photo-2",
        "/api/reference-media/live-shelf-blanket-photo-3",
        "/api/reference-media/live-shelf-blanket-photo-4",
        "/api/reference-media/live-shelf-blanket-photo-5",
        "/api/reference-media/live-shelf-blanket-photo-6",
        "/api/reference-media/live-shelf-blanket-photo-7",
        "/api/reference-media/live-shelf-blanket-photo-8",
        "/api/reference-media/live-shelf-blanket-photo-9",
        "/api/reference-media/live-shelf-blanket-photo-10",
        "/api/reference-media/live-shelf-blanket-photo-11",
        "/api/reference-media/live-shelf-blanket-photo-12",
        "/api/reference-media/live-shelf-blanket-photo-13",
        "/api/reference-media/live-shelf-blanket-photo-14",
        "/api/reference-media/live-shelf-blanket-photo-15",
        "/api/reference-media/live-shelf-blanket-photo-16",
        "/api/reference-media/live-shelf-blanket-photo-17",
        "/api/reference-media/live-shelf-blanket-photo-18",
        "/api/reference-media/live-shelf-blanket-photo-19",
        "/api/reference-media/live-shelf-blanket-photo-20",
        "/api/reference-media/live-shelf-blanket-photo-21",
        "/api/reference-media/live-shelf-blanket-photo-22",
        "/api/reference-media/live-shelf-blanket-photo-23",
        "/api/reference-media/live-shelf-blanket-photo-24",
        "/api/reference-media/live-shelf-blanket-photo-25",
      ],
      highlights: [
        "Ultra soft faux fur fibers provide exceptional comfort for lounging or cuddling",
        "Distinctive textured design adds visual interest and style to any room",
        "Extended plush pile ensures a deep, cozy feel",
        "Mid weight construction balances warmth and breathability",
        "Versatile for use as a throw over sofa, bed, or as a centerpiece",
      ],
      specifications: [
        {
          label: "Material",
          value: "Faux fur",
        },
        {
          label: "Construction",
          value: "Mid weight",
        },
        {
          label: "Pile Height",
          value: "Extended plush",
        },
        {
          label: "Design",
          value: "Textured, intricately woven",
        },
        {
          label: "Intended Use",
          value: "Throw blanket",
        },
      ],
      reviewPreview: {
        distribution: [93, 4, 1, 1, 2],
        reviews: [
          {
            title: "Best Furry Blanket",
            rating: 5,
            author: "Elece",
            date: "10 days ago",
          },
          {
            title: "Cozy Cuddle Blanket",
            rating: 5,
            author: "Debra",
            date: "11 days ago",
          },
        ],
        cardWidth: 280,
      },
      delivery: {
        postalCode: "9000",
        message: "Shipping calculated at checkout",
        shippingPolicy: true,
        returns: {
          message: "Returns accepted within 90 days",
          disclaimer: "Exclusions may apply. See full policy",
        },
      },
    },
    variants: [
      {
        id: "live-explore-blanket-42852305174708",
        label: 'Creme / Medium: 50" x 60"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Creme",
          Size: 'Medium: 50" x 60"',
        },
        referencePrice: {
          amount: 28295,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-1") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-1",
        },
      },
      {
        id: "live-explore-blanket-42852305207476",
        label: 'Creme / Large: 60" x 80"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Creme",
          Size: 'Large: 60" x 80"',
        },
        referencePrice: {
          amount: 34495,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-1") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-1",
        },
      },
      {
        id: "live-explore-blanket-42852305109172",
        label: 'Light Grey / Medium: 50" x 60"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Light Grey",
          Size: 'Medium: 50" x 60"',
        },
        referencePrice: {
          amount: 28295,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-16") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-16",
        },
      },
      {
        id: "live-explore-blanket-42852305141940",
        label: 'Light Grey / Large: 60" x 80"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Light Grey",
          Size: 'Large: 60" x 80"',
        },
        referencePrice: {
          amount: 34495,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-16") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-16",
        },
      },
      {
        id: "live-explore-blanket-43644160540852",
        label: 'Walnut / Medium: 50" x 60"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Walnut",
          Size: 'Medium: 50" x 60"',
        },
        referencePrice: {
          amount: 28295,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-10") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-10",
        },
      },
      {
        id: "live-explore-blanket-43644160573620",
        label: 'Walnut / Large: 60" x 80"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Walnut",
          Size: 'Large: 60" x 80"',
        },
        referencePrice: {
          amount: 34495,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-10") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-10",
        },
      },
      {
        id: "live-explore-blanket-44033765408948",
        label: 'Blossom / Medium: 50" x 60"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Blossom",
          Size: 'Medium: 50" x 60"',
        },
        referencePrice: {
          amount: 28295,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-12") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-12",
        },
      },
      {
        id: "live-explore-blanket-44033765441716",
        label: 'Blossom / Large: 60" x 80"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Blossom",
          Size: 'Large: 60" x 80"',
        },
        referencePrice: {
          amount: 34495,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-12") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-12",
        },
      },
      {
        id: "live-explore-blanket-44373634285748",
        label: 'Raisin / Medium: 50" x 60"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Raisin",
          Size: 'Medium: 50" x 60"',
        },
        referencePrice: {
          amount: 28295,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-22") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-22",
        },
      },
      {
        id: "live-explore-blanket-44373634252980",
        label: 'Raisin / Large: 60" x 80"',
        availableQuantity: null,
        referenceSelectable: true,
        referenceOptions: {
          Color: "Raisin",
          Size: 'Large: 60" x 80"',
        },
        referencePrice: {
          amount: 34495,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-22") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-22",
        },
      },
      {
        id: "live-explore-blanket-44141414219956",
        label: 'Tide / Medium: 50" x 60"',
        availableQuantity: null,
        referenceOptions: {
          Color: "Tide",
          Size: 'Medium: 50" x 60"',
        },
        referencePrice: {
          amount: 28295,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-3") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-3",
          unavailable: true,
        },
      },
      {
        id: "live-explore-blanket-44141414187188",
        label: 'Tide / Large: 60" x 80"',
        availableQuantity: null,
        referenceOptions: {
          Color: "Tide",
          Size: 'Large: 60" x 80"',
        },
        referencePrice: {
          amount: 34495,
          currency: "EUR",
        },
        referenceColor: {
          swatch:
            'url("/api/reference-media/live-shelf-blanket-photo-3") center / cover no-repeat',
          photo: "/api/reference-media/live-shelf-blanket-photo-3",
          unavailable: true,
        },
      },
    ],
  },
];

export const liveHomeShelfProductIds = [
  "live-explore-perfect-pot",
  "live-explore-verena-rug",
  "live-explore-bubble-blanket",
] as const;
export const liveHomeShelfRatingCounts: Readonly<Record<string, string>> = {
  "live-explore-perfect-pot": "8.8K",
  "live-explore-verena-rug": "4.4K",
  "live-explore-bubble-blanket": "589",
};

/** The root Explore rail and native Home category show the same captured shelf.
 * Do not replace it with every product that happens to have category Home. */
export function projectLiveHomeShelf(products: readonly Product[]): Product[] {
  return liveHomeShelfProductIds.flatMap((id) => {
    const product = products.find((entry) => entry.id === id);
    return product
      ? [{ ...product, ratingCount: liveHomeShelfRatingCounts[id] }]
      : [];
  });
}
