import { ruggablePresentation } from "./live-merchant-ruggable";
import { ourPlacePresentation } from "./live-merchant-ourplace";
import type { Store } from "../types";
import type { MerchantPresentation } from "../merchant-types";
export type {
  MerchantPresentation,
  MerchantCollection,
  MerchantReview,
  MerchantReviewMediaItem,
} from "../merchant-types";
const media = (name: string) => `/api/reference-media/merchant-${name}`;
// Installed Android / emulator-5560, 2026-09-29. Store and review counts
// deliberately preserve their distinct source snapshots. No live-service claims.
export const merchantPresentations: Readonly<
  Record<string, MerchantPresentation>
> = {
  "Our Place": ourPlacePresentation,
  Ruggable: ruggablePresentation,
  Goodee: {
    background: "#edbe53",
    foreground: "#17120b",
    panel: "#ffffff40",
    wordmark: media("goodee-wordmark"),
    wordmarkWidth: 247.333,
    wordmarkHeight: 106.667,
    avatar: media("goodee-avatar"),
    rating: 4.8,
    ratingCount: "2.7K",
    reviewCount: "2.8K",
    website: "https://www.goodeeworld.com",
    policies: [
      {
        label: "Refund policy",
        url: "https://www.goodeeworld.com/pages/shipping-returns-policy",
      },
      {
        label: "Shipping policy",
        url: "https://www.goodeeworld.com/pages/shipping-returns-policy",
      },
      {
        label: "Privacy policy",
        url: "https://www.goodeeworld.com/pages/privacy-policy",
      },
    ],
    description:
      "Goodee is on a journey towards discovering curated products and content by designers who believe in doing good. It’s a marketplace for a better world.",
    categories: [
      { slug: "shop-all", title: "Shop all", image: media("goodee-all") },
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image: media("goodee-new"),
      },
    ],
    collections: [
      {
        slug: "decor",
        title: "Decor",
        image: media("goodee-decor"),
        productIds: ["live-cozy-matisse-throw"],
      },
      {
        slug: "garden-outdoor",
        title: "Garden + Outdoor",
        image: media("goodee-garden"),
      },
    ],
    reviewPhotos: Array.from({ length: 5 }, (_, i) =>
      media(`goodee-review-photo-${i + 1}`),
    ),
    contacts: [
      {
        label: "care@goodeeworld.com",
        url: "mailto:care@goodeeworld.com",
        icon: "mail",
      },
      { label: "888-694-2054", url: "tel:8886942054", icon: "phone" },
      {
        label: "Instagram",
        url: "https://www.instagram.com/goodeeworld/",
        icon: "instagram",
      },
      {
        label: "Pinterest",
        url: "https://www.pinterest.ca/goodeeworld",
        icon: "external-link",
      },
    ],
    reviews: [
      {
        id: "goodee-warley",
        stars: 5,
        title: "Fantastic customer service",
        productTitle: "The Warley Fall (One Gallon)",
        author: "Tom",
        date: "2 days ago",
        image: media("goodee-reviewed-product-1"),
        body: "We had to call in the lifetime warranty on our warley fall watering can, there was a leak in the seam. My wife loves it so much. Goodee honored the replacement in a quick and ‘seamless!!’ Way. No issues. Piece of cake",
      },
      {
        id: "goodee-ollas",
        stars: 5,
        title: "Handy... and lovely",
        productTitle: "Mini Ollas Self-Watering Pots - Glaze- Set of 3",
        author: "Rickie",
        date: "7 days ago",
        image: media("goodee-reviewed-product-2"),
        body: "Who wouldn’t like a painted ollas? I have bought the small and the large ones and I can’t get enough of them. The big ones last bought a week, and I am often gone a little more than that so the plants do pretty well. The little ones in little planters - they are thriving. At least so far, I am new to the little ones. A Good buy. Probably are cheaper ones out there but the Goodee products have a crafty elegance I enjoy supporting.",
      },
    ],
  },
};
export function merchantPresentation(store: Store): MerchantPresentation {
  return (
    store.referenceMerchant ??
    merchantPresentations[store.name] ?? {
      source: "catalog",
      background: "#e8e6e1",
      foreground: "#111",
      panel: "#ffffff40",
      avatar: store.logo,
      cover: store.coverImage,
      description: store.description,
      website: store.referenceWebsite,
      rating: store.rating,
      ratingCount: store.ratingCount,
    }
  );
}
export function projectMerchantStore(store: Store): Store {
  const p = merchantPresentations[store.name];
  if (!p || store.referenceStyle !== "android") return store;
  return {
    ...store,
    logo: p.avatar ?? store.logo,
    description: p.description ?? store.description,
    referenceWebsite: p.website ?? store.referenceWebsite,
    rating: store.rating ?? p.rating,
    ratingCount: store.ratingCount || p.ratingCount || "",
  };
}

export function hasMerchantPresentation(store: Store): boolean {
  return store.referenceStyle === "android";
}
