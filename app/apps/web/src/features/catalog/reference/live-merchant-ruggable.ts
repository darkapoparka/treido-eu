import type { MerchantPresentation } from "./live-merchant-fixtures";
const image = (name: string) =>
  `/api/reference-media/merchant-ruggable-${name}`;
// Native merchant profile and review snapshots, emulator-5560 / 2026-09-29.
export const ruggablePresentation: MerchantPresentation = {
  background: "#6d6957",
  foreground: "#ffffff",
  panel: "#847f69",
  wordmark: image("wordmark"),
  wordmarkWidth: 247.333,
  wordmarkHeight: 57,
  avatar: image("avatar"),
  heroHeight: 260,
  cover: image("best-selling"),
  featuredProductIds: [
    "live-merchant-ruggable-poppy",
    "live-merchant-ruggable-calabria",
    "live-merchant-ruggable-palm",
  ],
  featureCollections: [
    {
      slug: "best-selling-rugs",
      title: "Best Selling Rugs",
      image: image("best-selling"),
      productIds: [
        "live-merchant-ruggable-cyrus",
        "live-merchant-ruggable-strawberry-ivory",
        "live-merchant-ruggable-nerissa",
        "live-merchant-ruggable-strawberry-indigo",
      ],
    },
  ],
  description:
    "Shop area rugs, accent rugs and runner rugs at Ruggable. Washable, stain-resistant and waterproof, our rugs are perfect for homes with kids and pets. Ships free!",
  rating: 4.7,
  ratingCount: "305.8K",
  reviewCount: "305.9K",
  website: "https://ruggable.com",
  categories: [
    { slug: "shop-all", title: "Shop all", image: image("all") },
    { slug: "outdoor-rugs", title: "Outdoor Rugs", image: image("outdoor") },
    {
      slug: "doormats",
      title: "Doormats",
      image: image("doormats"),
      productIds: ["live-merchant-ruggable-poppy"],
    },
    { slug: "re-jute-rugs", title: "Re-Jute Rugs", image: image("re-jute") },
    {
      slug: "flatwoven-rugs",
      title: "Flatwoven Rugs",
      image: image("flatwoven"),
      productIds: ["live-explore-verena-rug", "live-merchant-ruggable-palm"],
    },
    {
      slug: "tufted-rugs",
      title: "Tufted Rugs",
      image: image("tufted"),
      productIds: ["live-merchant-ruggable-calabria"],
    },
  ],
  reviewPhotos: Array.from({ length: 5 }, (_, i) =>
    image(`review-photo-${i + 1}`),
  ),
  policies: [
    {
      label: "Refund policy",
      url: "https://ruggable.com/help/faqs/how-to-returns-exchange",
    },
    {
      label: "Shipping policy",
      url: "https://ruggable.com/help/faqs/shipping-policy",
    },
    {
      label: "Privacy policy",
      url: "https://ruggable.com/pages/privacy-policy",
    },
    {
      label: "Terms and conditions",
      url: "https://ruggable.com/pages/terms-and-conditions",
    },
  ],
  reviews: [
    {
      id: "ruggable-eartha",
      stars: 4,
      title: "Cute rug, Hard to Vacuum",
      productTitle: "Eartha Terracotta Flatwoven Rug by Jungalow",
      image: image("reviewed-1"),
      author: "Jessica",
      date: "Today",
      body: "This rug is adorable and unique. I also love that it Velcro’s onto the rug pad, making it easy to lift off for cleaning and then reattach once washed. My last rug kept slipping off the rug pad, so I appreciate this setup. The rug pad also cushions the rug and makes it comfy to walk on. One issue, however, is that because the rug is thin, it is difficult to vacuum. The vacuum suction pulls the rug away from the pad and wrinkles it, so I have to reposition it afterward. Overall happy with the purchase of this adorable rug, though",
    },
    {
      id: "ruggable-hampton",
      stars: 5,
      title: "Beautiful rug!",
      productTitle: "Hampton Soft Blue Rug by Gracie",
      image: image("reviewed-2"),
      author: "Elena",
      date: "Today",
      body: "What a beautiful and great quality washable rug! Color is exactly as shown and quality is better than expected. I purchased other washable rugs, but this is something else! Very happy with the purchase.",
    },
  ],
};
