import type { Catalog, Product, Store } from "../types";

// Installed Shop guest snapshots, emulator-5560, 2026-09-26. Display facts
// are not current offers. The quantity limit of 99 is a local interaction
// fixture, not merchant inventory. Uncaptured variants are not invented.
export const liveShopStores: readonly Store[] = [
  {
    id: "live-belleboxbg",
    name: "belleboxbg",
    logo: "/api/reference-media/live-belle-logo",
    ratingCount: "",
    referenceStyle: "android",
    description: "",
    categories: [],
  },
  {
    id: "live-testograph",
    name: "Testograph",
    logo: "",
    rating: 4.3,
    ratingCount: "36",
    referenceStyle: "android",
    description: "",
    categories: [],
  },
  {
    id: "live-zlatna-ribka",
    name: "Zlatna Ribka | Лидерът в луксозната козметика за коса",
    logo: "/api/reference-media/live-zlatna-logo",
    rating: 4.9,
    ratingCount: "8.4K",
    referenceStyle: "android",
    description: "",
    categories: [],
  },
  {
    id: "live-freebubbles",
    name: "FreeBubbles",
    logo: "",
    rating: 4.3,
    ratingCount: "739",
    referenceStyle: "android",
    description: "",
    categories: [],
  },
];

export const liveShopProducts: readonly Product[] = [
  {
    id: "live-belle-monthly",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-belle-monthly",
      grid: "/api/reference-media/live-grid-belle-monthly",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Fri, Oct 2",
    },
    title: "BelleBox Месечен Абонамент",
    storeId: "live-belleboxbg",
    category: "Shop all",
    images: ["/api/reference-media/live-belle-monthly"],
    price: {
      amount: 1799,
      currency: "EUR",
    },
    rating: 4.7,
    ratingCount: "177",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 0.8199445983379502,
    variants: [
      {
        id: "live-belle-monthly-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-belle-11",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-belle-11",
      grid: "/api/reference-media/live-grid-belle-11",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Sun, Oct 4",
    },
    title: "BelleBox Limited Edition 11",
    storeId: "live-belleboxbg",
    category: "Shop all",
    images: ["/api/reference-media/live-belle-11"],
    price: {
      amount: 1699,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 0.8199445983379502,
    variants: [
      {
        id: "live-belle-11-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-belle-12",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-belle-12",
      grid: "/api/reference-media/live-grid-belle-12",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Thu, Oct 1",
    },
    title: "BelleBox Limited Edition 12",
    storeId: "live-belleboxbg",
    category: "Shop all",
    images: ["/api/reference-media/live-belle-12"],
    price: {
      amount: 1699,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 0.8199445983379502,
    variants: [
      {
        id: "live-belle-12-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-testo-up",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-testo-up",
      grid: "/api/reference-media/live-grid-testo-up",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Tue, Sep 29",
    },
    title: "TestoUP - №1 ДОБАВКА ЗА МЪЖЕ",
    storeId: "live-testograph",
    category: "Shop all",
    images: ["/api/reference-media/live-testo-up"],
    price: {
      amount: 3425,
      currency: "EUR",
    },
    rating: 4.3,
    ratingCount: "15",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-testo-up-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-freet",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-freet",
      grid: "/api/reference-media/live-grid-freet",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Tue, Sep 29",
    },
    title: "FreeT - ПРЕМИУМ ГОРИВО ЗА МЪЖЕ",
    storeId: "live-testograph",
    category: "Shop all",
    images: ["/api/reference-media/live-freet"],
    price: {
      amount: 2970,
      currency: "EUR",
    },
    rating: 2,
    ratingCount: "1",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-freet-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-creatine",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-creatine",
      grid: "/api/reference-media/live-grid-creatine",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Tue, Sep 29",
    },
    title: "Креатин монохидрат",
    storeId: "live-testograph",
    category: "Shop all",
    images: ["/api/reference-media/live-creatine"],
    price: {
      amount: 2290,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-creatine-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-zlatna-1",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-zlatna-1",
      grid: "/api/reference-media/live-grid-zlatna-1",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Thu, Oct 1",
    },
    title: "Безамонячна трайна боя с арганово масло и кератин 100 мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-zlatna-1"],
    price: {
      amount: 1071,
      currency: "EUR",
    },
    rating: 4.9,
    ratingCount: "201",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-zlatna-1-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-zlatna-2",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-zlatna-2",
      grid: "/api/reference-media/live-grid-zlatna-2",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Thu, Oct 1",
    },
    title: "Безамонячна трайна боя за коса 60 мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-zlatna-2"],
    price: {
      amount: 1513,
      currency: "EUR",
    },
    rating: 4.9,
    ratingCount: "75",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-zlatna-2-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-zlatna-3",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-zlatna-3",
      grid: "/api/reference-media/live-grid-zlatna-3",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Thu, Oct 1",
    },
    title: "Трайна боя за коса 100 мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-zlatna-3"],
    price: {
      amount: 1187,
      currency: "EUR",
    },
    rating: 4.9,
    ratingCount: "147",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-zlatna-3-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-freebubbles-1",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-freebubbles-1",
      grid: "/api/reference-media/live-grid-freebubbles-1",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Wed, Sep 30",
    },
    title: "Киселина за фуги – Acido Pulifughe",
    storeId: "live-freebubbles",
    category: "Shop all",
    images: ["/api/reference-media/live-freebubbles-1"],
    price: {
      amount: 498,
      currency: "EUR",
    },
    compareAt: {
      amount: 900,
      currency: "EUR",
    },
    rating: 4.4,
    ratingCount: "105",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-freebubbles-1-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-freebubbles-2",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-freebubbles-2",
      grid: "/api/reference-media/live-grid-freebubbles-2",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Wed, Sep 30",
    },
    title: "Пръскалка / Тригер за бутилки FreeBubbles",
    storeId: "live-freebubbles",
    category: "Shop all",
    images: ["/api/reference-media/live-freebubbles-2"],
    price: {
      amount: 50,
      currency: "EUR",
    },
    rating: 5,
    ratingCount: "11",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-freebubbles-2-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-freebubbles-3",
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-freebubbles-3",
      grid: "/api/reference-media/live-grid-freebubbles-3",
    },
    detail: {
      arrivalLabel: "Arrives as soon as Wed, Sep 30",
    },
    title:
      "Препарат против варовик Kalk Stop Gel Professional - за блестяща баня",
    storeId: "live-freebubbles",
    category: "Shop all",
    images: ["/api/reference-media/live-freebubbles-3"],
    price: {
      amount: 597,
      currency: "EUR",
    },
    compareAt: {
      amount: 899,
      currency: "EUR",
    },
    rating: 4.4,
    ratingCount: "36",
    description: "",
    saleUnit: "piece",
    referenceStyle: "android",
    referenceImageRatio: 1,
    variants: [
      {
        id: "live-freebubbles-3-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-following-zlatna-1",
    title: "Регенерираща маска за коса с термозащита 180мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-following-zlatna-1"],
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-following-zlatna-1",
      grid: "/api/reference-media/live-grid-following-zlatna-1",
    },
    referenceStyle: "android",
    referenceImageRatio: 1,
    price: {
      amount: 2995,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    detail: {
      arrivalLabel: "Arrives as soon as Fri, Oct 2",
    },
    variants: [
      {
        id: "live-following-zlatna-1-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-following-zlatna-2",
    title: "Регенериращ балсам с термозащита 480мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-following-zlatna-2"],
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-following-zlatna-2",
      grid: "/api/reference-media/live-grid-following-zlatna-2",
    },
    referenceStyle: "android",
    referenceImageRatio: 1,
    price: {
      amount: 2995,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    detail: {
      arrivalLabel: "Arrives as soon as Fri, Oct 2",
    },
    variants: [
      {
        id: "live-following-zlatna-2-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-following-zlatna-3",
    title: "Регенериращ шампоан с термозащита 480мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-following-zlatna-3"],
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-following-zlatna-3",
      grid: "/api/reference-media/live-grid-following-zlatna-3",
    },
    referenceStyle: "android",
    referenceImageRatio: 1,
    price: {
      amount: 2995,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    detail: {
      arrivalLabel: "Arrives as soon as Fri, Oct 2",
    },
    variants: [
      {
        id: "live-following-zlatna-3-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-following-zlatna-4",
    title: "Изглаждащ и възстановяващ балсам 470 мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-following-zlatna-4"],
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-following-zlatna-4",
      grid: "/api/reference-media/live-grid-following-zlatna-4",
    },
    referenceStyle: "android",
    referenceImageRatio: 1,
    price: {
      amount: 2795,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    detail: {
      arrivalLabel: "Arrives as soon as Fri, Oct 2",
    },
    variants: [
      {
        id: "live-following-zlatna-4-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-following-zlatna-5",
    title: "Изглаждащ и възстановяващ шампоан 470 мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-following-zlatna-5"],
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-following-zlatna-5",
      grid: "/api/reference-media/live-grid-following-zlatna-5",
    },
    referenceStyle: "android",
    referenceImageRatio: 1,
    price: {
      amount: 2795,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    detail: {
      arrivalLabel: "Arrives as soon as Fri, Oct 2",
    },
    variants: [
      {
        id: "live-following-zlatna-5-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-following-zlatna-6",
    title: "Балсам за хидратация и обем за тънка коса 470 мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-following-zlatna-6"],
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-following-zlatna-6",
      grid: "/api/reference-media/live-grid-following-zlatna-6",
    },
    referenceStyle: "android",
    referenceImageRatio: 1,
    price: {
      amount: 2795,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    detail: {
      arrivalLabel: "Arrives as soon as Fri, Oct 2",
    },
    variants: [
      {
        id: "live-following-zlatna-6-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-following-zlatna-7",
    title: "Шампоан за хидратация и обем за тънка коса 470 мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-following-zlatna-7"],
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-following-zlatna-7",
      grid: "/api/reference-media/live-grid-following-zlatna-7",
    },
    referenceStyle: "android",
    referenceImageRatio: 1,
    price: {
      amount: 2795,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    detail: {
      arrivalLabel: "Arrives as soon as Fri, Oct 2",
    },
    variants: [
      {
        id: "live-following-zlatna-7-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-following-zlatna-8",
    title: "Комплект терапия за интензивно възстановяване на увредена коса",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-following-zlatna-8"],
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-following-zlatna-8",
      grid: "/api/reference-media/live-grid-following-zlatna-8",
    },
    referenceStyle: "android",
    referenceImageRatio: 1,
    price: {
      amount: 4587,
      currency: "EUR",
    },
    rating: 4.9,
    ratingCount: "8",
    description: "",
    saleUnit: "piece",
    detail: {
      arrivalLabel: "Arrives as soon as Thu, Oct 1",
    },
    variants: [
      {
        id: "live-following-zlatna-8-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
  {
    id: "live-following-zlatna-9",
    title:
      "Серум за скалп за стимулиране на растеж и уплътняване на косата 15 мл",
    storeId: "live-zlatna-ribka",
    category: "Shop all",
    images: ["/api/reference-media/live-following-zlatna-9"],
    referenceThumbnails: {
      shelf: "/api/reference-media/live-shelf-following-zlatna-9",
      grid: "/api/reference-media/live-grid-following-zlatna-9",
    },
    referenceStyle: "android",
    referenceImageRatio: 1,
    price: {
      amount: 4450,
      currency: "EUR",
    },
    ratingCount: "",
    description: "",
    saleUnit: "piece",
    detail: {
      arrivalLabel: "Arrives as soon as Thu, Oct 1",
    },
    variants: [
      {
        id: "live-following-zlatna-9-preview",
        label: "Default",
        availableQuantity: 99,
      },
    ],
  },
];

// The source header says nine new items while its visible first post has
// eight cards, followed by one older full-width post. Preserve both facts.
export const liveFollowingPosts: NonNullable<Catalog["liveFollowingPosts"]> = [
  {
    storeId: "live-zlatna-ribka",
    productIds: [
      "live-following-zlatna-1",
      "live-following-zlatna-2",
      "live-following-zlatna-3",
      "live-following-zlatna-4",
      "live-following-zlatna-5",
      "live-following-zlatna-6",
      "live-following-zlatna-7",
      "live-following-zlatna-8",
    ],
    added: "9 items added 23 hours ago",
  },
  {
    storeId: "live-zlatna-ribka",
    productIds: ["live-following-zlatna-9"],
    added: "1 item added 8 days ago",
    wide: true,
  },
];
