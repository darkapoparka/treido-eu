import type { AccountSeed, Profile, ReferenceOrder } from "../../account/state";
import type { DiscoverySeed } from "../../discovery/state";
import {
  shopSourceAddress,
  shopSourcePayment,
} from "../../commerce/source-fixtures";

// Named, synthetic presentation inputs only. A scenario never represents a login,
// payment, provider response or permission grant. The server must gate selection.
export type ReferenceScenario = {
  account?: AccountSeed;
  discovery?: DiscoverySeed;
  catalog?: { unavailableVariants: readonly string[] };
};
const namedProfile: Partial<Profile> = { firstName: "Alex", lastName: "Smith" };
const completeProfile: Partial<Profile> = {
  ...namedProfile,
  phone: "+1 (650) 213-7552",
  gender: "Female",
  birthday: "1995-02-18",
  shoeSize: "8.5",
  shirtSize: "L",
  pantsSize: "L",
  avatar: "/api/reference-media/auth-reference-avatar",
};
const sourceCard = {
  id: "card-source-4263",
  last4: shopSourcePayment.last4,
  expiry: "••/••",
};
const bagLine = {
  productId: "shampoo-bag",
  variantId: "shampoo-bag-default",
  quantity: 1,
};
const sourceOrder: ReferenceOrder = {
  id: "REF-1001",
  productId: "shampoo-bag",
  name: "Shampoo Bar Bag",
  carrier: "Amazon Logistics",
  tracking: "TBA333200762603",
  status: "In transit",
  archived: false,
  rating: 0,
  review: "",
};
const manualOrder: ReferenceOrder = {
  id: "REF-manual-shirt",
  productId: "",
  name: "Loose Fit Printed T-Shirt",
  carrier: "DHL eCommerce",
  tracking: "68448512123",
  status: "Ordered",
  archived: false,
  rating: 0,
  review: "",
};
const emptyDiscovery: DiscoverySeed = {
  capturedSearchHistory: null,
  saved: [],
  collections: [],
  viewedProducts: [],
  viewedItems: [],
  viewedAnswers: [],
  followed: [],
  visitedMinis: [],
  cart: [],
  later: [],
  recentActivity: null,
};
const savedPair = ["shea-butter", "rice-bundle"];
const favs = {
  id: "source-favs",
  name: "Favs",
  visibility: "Private" as const,
  productIds: ["rice-bundle", "shea-butter"],
};
const expandedFavs = {
  ...favs,
  productIds: ["argan-liquid-combo", ...favs.productIds],
  collaborationPromptDismissed: true,
};
const editedFavs = { ...expandedFavs, name: "Favs💕" };
// Flow 43/44 begins with captured mixed history. Flow 49 is a separate
// recorded ordering; these fixtures never fabricate a browsing event.
const searchEntryItems: NonNullable<DiscoverySeed["viewedItems"]> = [
  { kind: "product", id: "shea-butter", promotion: "$15 off order" },
  { kind: "store", id: "kitsch", promotion: "Save $15" },
  { kind: "product", id: "shampoo-bag", promotion: "$15 off order" },
  { kind: "product", id: "rice-shampoo", promotion: "Save $15" },
  { kind: "product", id: "terracotta", promotion: "Save $15" },
  { kind: "store", id: "pura" },
  { kind: "store", id: "loaded-tea" },
  { kind: "store", id: "drmtlgy" },
];
const libraryItems = [
  "rhode-glazing-milk",
  "home-drmtlgy-eye",
  "rhode-pink-captured",
  "argan-liquid-combo",
  "shea-butter",
  "rice-bundle",
];
const preferenceProfile: Partial<Profile> = {
  ...namedProfile,
  gender: "Female",
  birthday: "1995-02-18",
};
const sizedProfile: Partial<Profile> = {
  ...preferenceProfile,
  shoeSize: "8.5",
  shirtSize: "L",
  pantsSize: "L",
};
const skinPreferences = {
  skinType: ["Combination", "With redness", "Sensitive"],
  undertone: ["Pink/Yellow"],
  tone: ["Fair skin"],
};
const skinHairPreferences = {
  ...skinPreferences,
  hairType: ["Normal"],
  hairColor: ["Black"],
};
const profileOrders: ReferenceOrder[] = [
  { ...manualOrder, status: "In transit" },
  { ...sourceOrder, status: "Ordered" },
];
const profileActivity: DiscoverySeed = {
  saved: ["argan-liquid-combo", "shea-butter", "rice-bundle"],
  followed: ["kitsch", "pura"],
  viewedProducts: ["shampoo-bag", "shea-butter", "rice-bundle"],
  viewedItems: [
    { kind: "store", id: "kitsch" },
    { kind: "product", id: "shampoo-bag", promotion: "$15 off order" },
    { kind: "product", id: "shea-butter", promotion: "$15 off order" },
    { kind: "product", id: "rice-bundle", promotion: "$15 off order" },
  ],
};
export const referenceScenarios = {
  // Explicit former preview defaults for frozen tests; ordinary entry is a guest.
  "reference-default": {},
  "profile-details": {
    account: { profile: { ...completeProfile, avatar: "" } },
  },
  "profile-gender": {
    account: { profile: { ...namedProfile, gender: "Female" } },
  },
  "profile-preferences-base": { account: { profile: preferenceProfile } },
  "profile-shoe-selected": {
    account: { profile: { ...preferenceProfile, shoeSize: "8.5" } },
  },
  "profile-preference-sizes": { account: { profile: sizedProfile } },
  "profile-skin": {
    account: { profile: sizedProfile, preferences: skinPreferences },
  },
  "profile-skin-hair": {
    account: { profile: sizedProfile, preferences: skinHairPreferences },
  },
  "profile-minis": {
    account: { profile: completeProfile, orders: profileOrders },
    discovery: {
      ...profileActivity,
      recentActivity: "minis",
      visitedMinis: ["gift", "look", "skin"],
    },
  },
  "home-welcome": { account: { orders: [] }, discovery: emptyDiscovery },
  "product-reporting": {
    account: { orders: [] },
    discovery: { ...emptyDiscovery, saved: ["rice-bundle"] },
  },
  "product-reported": {
    account: { orders: [] },
    discovery: {
      ...emptyDiscovery,
      saved: ["rice-bundle"],
      reportedProducts: ["shea-butter"],
    },
  },
  // Flow 17/001-002 records a cart-free $15 snapshot and a first Shea visit.
  // Follow was not visible in this segment; do not borrow following-pair's seed.
  "kitsch-product-arrival": {
    discovery: { cart: [], saved: [], viewedProducts: [], viewedItems: [] },
  },
  // Frame 003 changes the offer and rating without a recorded action.
  // A distinct source entry owns that snapshot; the tip timer changes no prices.
  "kitsch-product-settled": {
    discovery: {
      cart: [],
      saved: [],
      viewedProducts: ["shea-butter"],
      viewedItems: [{ kind: "product", id: "shea-butter" }],
    },
  },
  // Flow 19/002 contains a different catalog snapshot with no recorded cause.
  // Replay its real Save action within that snapshot, not as an offer change.
  "kitsch-product-saving-offer": {
    discovery: {
      saved: [],
      viewedProducts: ["shea-butter"],
      viewedItems: [{ kind: "product", id: "shea-butter" }],
    },
  },
  // Flow 17/008 already shows Following and no cart. Its cause is not recorded.
  "kitsch-shea-following": {
    account: { orders: [] },
    discovery: { ...emptyDiscovery, followed: ["kitsch"] },
  },
  // Flow 17/009 is a separate captured bag history. The recording already
  // contains a followed Kitsch shop and one Shampoo Bar Bag in the cart; no
  // preceding product-detail action in this flow proves when either changed.
  "kitsch-bag-following-cart": {
    discovery: {
      ...emptyDiscovery,
      followed: ["kitsch"],
      cart: [bagLine],
    },
  },
  "home-pura-options": {
    account: { orders: [] },
    discovery: emptyDiscovery,
  },
  "home-recent-shops": {
    discovery: {
      ...emptyDiscovery,
      recentActivity: "stores",
      viewedProducts: ["shea-butter"],
      viewedItems: [
        { kind: "store", id: "kitsch", promotion: "Save $20" },
        { kind: "product", id: "shea-butter", promotion: "$20 off order" },
        { kind: "store", id: "loaded-tea", promotion: "Save $10" },
        { kind: "store", id: "drmtlgy", promotion: "Save $30" },
      ],
    },
  },
  "home-recent-products": {
    account: { profile: completeProfile, orders: [sourceOrder] },
    discovery: {
      ...emptyDiscovery,
      recentActivity: "products",
      viewedProducts: ["cleo", "round-sunglasses", "u-see-me"],
      viewedItems: [
        { kind: "product", id: "cleo" },
        { kind: "product", id: "round-sunglasses", promotion: "Save $20" },
        { kind: "product", id: "u-see-me" },
      ],
    },
  },
  "search-entry": {
    discovery: {
      ...emptyDiscovery,
      viewedItems: searchEntryItems,
      viewedProducts: [
        "shea-butter",
        "shampoo-bag",
        "rice-shampoo",
        "terracotta",
      ],
    },
  },
  "search-photo": {
    discovery: {
      ...emptyDiscovery,
      capturedSearchHistory: "photo",
      viewedAnswers: ["jeans"],
      viewedItems: [
        { kind: "product", id: "cleo" },
        { kind: "product", id: "round-sunglasses", promotion: "Save $20" },
        { kind: "product", id: "u-see-me" },
      ],
      viewedProducts: ["cleo", "round-sunglasses", "u-see-me"],
    },
  },
  "search-recent": {
    discovery: {
      ...emptyDiscovery,
      viewedAnswers: ["jeans"],
      viewedItems: [
        searchEntryItems[1]!,
        searchEntryItems[2]!,
        searchEntryItems[0]!,
        ...searchEntryItems.slice(3),
      ],
      viewedProducts: [
        "shampoo-bag",
        "shea-butter",
        "rice-shampoo",
        "terracotta",
      ],
    },
  },
  "profile-named": { account: { profile: namedProfile } },
  "profile-complete": {
    account: { profile: completeProfile, orders: profileOrders },
    discovery: {
      ...profileActivity,
      recentActivity: "minis",
      visitedMinis: ["gift", "look", "skin"],
    },
  },
  "profile-before-payment": {
    account: {
      profile: completeProfile,
      paymentCards: [],
      hasPaymentProfile: false,
      orders: profileOrders,
    },
    discovery: { ...profileActivity, saved: [] },
  },
  "profile-deletion": {
    account: {
      profile: { ...namedProfile, email: "alexsmith.mobbin+2@gmail.com" },
    },
  },
  "saved-empty": { discovery: { ...emptyDiscovery } },
  "saved-pair": { discovery: { ...emptyDiscovery, saved: savedPair } },
  "saved-library": {
    account: { profile: completeProfile },
    discovery: {
      ...emptyDiscovery,
      saved: libraryItems,
      collections: [
        {
          ...favs,
          productIds: [
            "rice-bundle",
            "home-drmtlgy-eye",
            "rhode-glazing-milk",
            "argan-liquid-combo",
            "rhode-pink-captured",
            "shea-butter",
          ],
        },
      ],
    },
  },
  "saved-collection": {
    account: { profile: namedProfile },
    discovery: { ...emptyDiscovery, saved: savedPair, collections: [favs] },
  },
  "saved-collection-expanded": {
    account: { profile: completeProfile },
    discovery: {
      ...emptyDiscovery,
      saved: expandedFavs.productIds,
      collections: [expandedFavs],
    },
  },
  "saved-collection-edited": {
    account: { profile: completeProfile },
    discovery: {
      ...emptyDiscovery,
      saved: editedFavs.productIds,
      collections: [editedFavs],
    },
  },
  "saved-collection-deletion": {
    account: { profile: completeProfile },
    discovery: {
      ...emptyDiscovery,
      saved: expandedFavs.productIds,
      collections: [
        { ...expandedFavs, productIds: ["argan-liquid-combo", "rice-bundle"] },
      ],
    },
  },
  "profile-public": {
    account: { profile: completeProfile },
    discovery: {
      ...emptyDiscovery,
      saved: savedPair,
      collections: [
        {
          ...editedFavs,
          productIds: ["rice-bundle", "argan-liquid-combo", "shea-butter"],
          visibility: "Public" as const,
        },
      ],
    },
  },
  "following-empty": { discovery: { ...emptyDiscovery } },
  "following-pair": {
    discovery: { ...emptyDiscovery, followed: ["kitsch", "pura"] },
  },
  "cart-bag": {
    account: { profile: completeProfile },
    discovery: { ...emptyDiscovery, cart: [bagLine] },
  },
  "cart-later": {
    catalog: { unavailableVariants: ["shampoo-bag-default"] },
    account: { profile: completeProfile },
    discovery: { ...emptyDiscovery, later: [bagLine] },
  },
  checkout: {
    account: {
      profile: completeProfile,
      addresses: [{ ...shopSourceAddress, id: "address-source-alex" }],
      paymentCards: [sourceCard],
      orders: [sourceOrder],
    },
    discovery: { ...emptyDiscovery, cart: [bagLine] },
  },
  "cart-unavailable": {
    catalog: { unavailableVariants: ["shampoo-bag-default"] },
    account: { profile: completeProfile },
    discovery: { ...emptyDiscovery, cart: [bagLine] },
  },
  "orders-empty": { account: { orders: [] }, discovery: emptyDiscovery },
  "order-widgets": {
    account: {
      profile: completeProfile,
      orders: [
        { ...sourceOrder, status: "Ordered" },
        { ...manualOrder, status: "Delivered" },
      ],
    },
  },
  "orders-waiting": {
    account: {
      profile: completeProfile,
      orders: [{ ...sourceOrder, status: "Ordered" }],
    },
  },
  "orders-transit": {
    account: { profile: completeProfile, orders: [sourceOrder] },
  },
  "orders-transit-history": {
    account: {
      profile: completeProfile,
      orders: [
        sourceOrder,
        { ...manualOrder, status: "Delivered", archived: true },
      ],
    },
  },
  "orders-delivered-history": {
    account: {
      profile: completeProfile,
      orders: [
        { ...sourceOrder, status: "Delivered" },
        { ...manualOrder, status: "Delivered", archived: true },
      ],
    },
  },
  "orders-delivered": {
    account: {
      profile: completeProfile,
      orders: [{ ...sourceOrder, status: "Delivered" }],
    },
  },
  "orders-archived": {
    account: {
      profile: completeProfile,
      orders: [{ ...sourceOrder, archived: true }],
    },
  },
  "orders-manual": {
    account: { profile: completeProfile, orders: [sourceOrder, manualOrder] },
  },
  "orders-manual-delivered": {
    account: {
      profile: completeProfile,
      orders: [sourceOrder, { ...manualOrder, status: "Delivered" }],
    },
  },
  "onboarding-new": {
    account: {
      orders: [],
      paymentCards: [],
      addresses: [],
      hasPaymentProfile: false,
    },
    discovery: emptyDiscovery,
  },
  "returning-home": {
    account: { profile: completeProfile, orders: [sourceOrder] },
    discovery: emptyDiscovery,
  },
} satisfies Record<string, ReferenceScenario>;

export type ReferenceScenarioName = keyof typeof referenceScenarios;
export const referenceScenarioCookie = "shop-reference-scenario";
export function resolveReferenceScenario(
  name: string | undefined,
): ReferenceScenario | undefined {
  return name && Object.hasOwn(referenceScenarios, name)
    ? referenceScenarios[name as ReferenceScenarioName]
    : undefined;
}
