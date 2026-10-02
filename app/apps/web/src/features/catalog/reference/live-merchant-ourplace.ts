import { nativeOurPlaceCollections } from "./live-ourplace-catalog";
import type { MerchantCollection } from "../merchant-types";
import { ourPlaceReviewMedia } from "./live-merchant-review-media";
import type { MerchantPresentation } from "./live-merchant-fixtures";
const image = (name: string) =>
  `/api/reference-media/merchant-ourplace-${name}`;
// Installed Android store, profile and reviews, 2026-09-29.
export const ourPlacePresentation: MerchantPresentation = {
  background: "#4e3a38",
  foreground: "#ffffff",
  panel: "#664c49",
  avatar: image("avatar"),
  wordmark: image("wordmark"),
  wordmarkWidth: 247.333,
  wordmarkHeight: 80,
  cover: image("poster"),
  coverVideo: "merchant-ourplace-hero",
  heroHeight: 260,
  description:
    "For connections made across the kitchen table. We believe in the power of home cooking to bring people together.\n\nIt’s why we create products that make cooking and sharing a meal easier and more joyful.",
  descriptionExpandable: true,
  website: "https://fromourplace.com",
  rating: 4.6,
  ratingCount: "101K",
  reviewCount: "101.1K",
  categories: (
    [
      {
        slug: "shop-all",
        title: "Shop all",
        image: image("all"),
        profileWide: true,
      },
      { slug: "bundles", title: "Bundles", image: image("bundles") },
      {
        slug: "cookware",
        title: "Cookware",
        image: image("cookware"),
        productIds: [
          "live-explore-perfect-pot",
          "live-merchant-ourplace-mini-pot",
          "live-merchant-ourplace-large-pan",
        ],
      },
      { slug: "appliances", title: "Appliances", image: image("appliances") },
      { slug: "bakeware", title: "Bakeware", image: image("bakeware") },
      { slug: "tableware", title: "Tableware", image: image("tableware") },
      { slug: "kitchen-tools", title: "Kitchen Tools", image: image("tools") },
    ] satisfies MerchantCollection[]
  ).map((category) => ({
    ...category,
    ...nativeOurPlaceCollections[category.slug],
  })),
  featuredProductIds: [
    "live-explore-perfect-pot",
    "live-merchant-ourplace-mini-pot",
    "live-merchant-ourplace-large-pan",
  ],
  reviewPhotos: ourPlaceReviewMedia.slice(0, 12).map((item) => item.thumbnail),
  reviewMedia: ourPlaceReviewMedia,
  locations: [
    {
      name: "Abbot Kinney",
      address: "1344 Abbot Kinney Blvd, Venice, CA 90291",
    },
  ],
  contacts: [
    {
      label: "Website",
      url: "https://fromourplace.com",
      icon: "external-link",
    },
    {
      label: "hello@fromourplace.com",
      url: "mailto:hello@fromourplace.com",
      icon: "mail",
    },
  ],
  policies: [
    { label: "Refund policy", url: "https://fromourplace.com/pages/returns" },
    {
      label: "Terms and conditions",
      url: "https://fromourplace.com/pages/terms",
    },
    { label: "Privacy policy", url: "https://fromourplace.com/pages/privacy" },
  ],
  reviews: [
    {
      id: "ourplace-gift",
      stars: 5,
      title: "Gift",
      productTitle: "",
      author: "Renee",
      date: "Yesterday",
      body: "Purchased for my daughter in law for her Birthday and she loved them. She was very disappointed that the small saucepan did not come with the set. And very discouraged at how much it was separately. You need to do the mini set in this style and discount it for the holidays!",
    },
    {
      id: "ourplace-spoons",
      stars: 5,
      title: "Must haves for the Our Place pots",
      productTitle: "Beechwood Spoons",
      author: "Lynn",
      date: "Yesterday",
      image: image("reviewed-spoons"),
      body: "I purchased these so not to be concerned about scratching the pots and pans surfaces. Just go ahead and get the whole silicone cooking set. An absolute to go with the wonderful OP cookware.",
      reply: {
        body: "Thanks so much for the five-star review, Lynn! We’re thrilled the silicone cooking set gives you peace of mind while cooking and is a great match for your Our Place cookware.",
        author: "Our Place",
        date: "Yesterday",
      },
    },
  ],
};
