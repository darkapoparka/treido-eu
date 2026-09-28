const owner = "apps/web/src/features/discovery/store.tsx";
const store = "/stores/kitsch";
const chemical = "/stores/chemical-guys";
const top = { type: "scroll", y: 0 };
const click = (role, name) => ({ type: "click", role, name, exact: true });
const selector = (value) => ({ type: "clickSelector", selector: value });
const heading = (name) => ({
  type: "waitVisible",
  role: "heading",
  name,
  exact: true,
});
const anchor = (selector, y) => ({ type: "anchorSelector", selector, y });
const recommendations = anchor(".store-recommendations", 79);
const allProducts = anchor(".store-grid-heading", 79);
const returning = {
  startUrl: store,
  scenario: "following-pair",
};
const storefront = () => ({
  state: "kitsch-default-storefront",
  actions: [heading("For you"), top],
});
const chemicalFrame = () => ({
  state: "chemical-guys-products-and-video-rail",
  notes:
    "The original captures only part of Chemical Guys inventory and Featured photos. Recovered photo interiors, native DOM controls and the compact header remain compared; the third product has only its recorded truncated title and no purchasable inventory.",
  actions: [heading("For you"), anchor(".store-recommendations", 153)],
});

// These recipes replay actual controls. Entry changes explicitly retain jumps
// between captured histories; Following does not fabricate a different cart,
// campaign photograph or recommendation list as a side effect.
export const storeRecipes = {
  14: {
    family: "store-collections",
    owner,
    startUrl: store,
    scenario: "following-pair",
    frames: [
      {
        state: "kitsch-scrolled-collections",
        actions: [heading("For you"), recommendations],
      },
      {
        state: "whats-new-collection",
        actions: [
          selector(
            '.store-collection-rail a[href="/stores/kitsch/collections/whats-new"]',
          ),
          heading("What's New"),
          top,
        ],
      },
      {
        state: "best-sellers-first-save-collection-prompt",
        entry: {
          startUrl: `${store}/collections/best-sellers`,
          scenario: "saved-empty",
        },
        overlay: "dialog",
        notes:
          "The source jumps from What's New to Best Sellers. This separate empty-Saved entry presses the real Rice bundle heart to trigger the first-collection suggestion; the jump is not an invented navigation transition.",
        actions: [
          heading("Best Sellers"),
          top,
          click("button", "Save Rice Water Shampoo & Conditioner Combo"),
          {
            type: "waitVisible",
            role: "dialog",
            name: "Start your first collection",
            exact: true,
          },
        ],
      },
    ],
  },
  15: {
    family: "store-video",
    owner,
    startUrl: chemical,
    scenario: "home-welcome",
    frames: [
      chemicalFrame(),
      {
        state: "chemical-guys-tire-trim-video-frame",
        notes:
          "The frozen flow contains two stills and no motion file. The recovered photo and DOM player controls expose the missing playback/audio boundary; the actual Tire+Trim product link works independently of unavailable motion.",
        actions: [
          selector(".store-video-rail a"),
          { type: "waitUrl", url: "**/stores/chemical-guys/video" },
          {
            type: "waitVisible",
            role: "link",
            name: "Close video",
            exact: true,
          },
          top,
        ],
      },
    ],
  },
  16: {
    family: "store-filters",
    owner: "apps/web/src/features/discovery/store-filter.tsx",
    startUrl: store,
    scenario: "following-pair",
    frames: [
      {
        state: "store-filter-default",
        overlay: "dialog",
        actions: [
          allProducts,
          click("button", "Filter store products"),
          heading("Filter"),
        ],
      },
      {
        state: "store-filter-on-sale-draft",
        overlay: "dialog",
        actions: [click("button", "On sale")],
      },
      {
        state: "store-price-default-range",
        overlay: "dialog",
        actions: [click("button", "Price"), heading("Price")],
      },
      {
        state: "store-price-maximum-380-draft",
        overlay: "dialog",
        notes:
          "The flow's checked-in recording confirms the final $380 range. Use the focused native slider's real keyboard interaction, not injected query state or DOM painting.",
        actions: [
          { type: "key", key: "Home" },
          ...Array.from({ length: 38 }, () => ({
            type: "key",
            key: "ArrowRight",
          })),
        ],
      },
      {
        state: "store-products-after-filter-done",
        notes:
          "The source shows the leading regular-price KITSCH grid after On sale plus a $380 maximum. Captured eligibility is recorded separately from compare-at prices, so no unshown discount or amount is invented.",
        actions: [
          click("button", "Done"),
          { type: "waitUrl", url: "**/stores/kitsch?**max=380**" },
          allProducts,
        ],
      },
    ],
  },
  40: {
    family: "store-search",
    owner,
    startUrl: store,
    scenario: "home-welcome",
    frames: [
      storefront(),
      {
        state: "store-search-empty",
        actions: [click("link", "Search store"), heading("Shop by"), top],
      },
      {
        state: "store-search-shampoo-suggestions",
        actions: [
          {
            type: "fill",
            role: "textbox",
            name: "Search KITSCH",
            value: "shampoo",
          },
          { type: "waitVisible", selector: ".store-search-suggestions" },
          top,
        ],
      },
      {
        state: "store-search-shampoo-results",
        actions: [
          { type: "key", key: "Enter" },
          { type: "waitUrl", url: "**/stores/kitsch/search?q=shampoo" },
          { type: "waitVisible", selector: ".store-search-count" },
          top,
        ],
      },
    ],
  },
  41: {
    family: "store-following",
    owner,
    startUrl: store,
    scenario: "home-welcome",
    frames: [
      storefront(),
      {
        state: "kitsch-returning-followed-storefront",
        entry: returning,
        notes:
          "This capture changes the hero, promotion, recommendations and cart as well as Follow. Use the existing returning history; the unacquired returning hero remains an unmasked visual obligation. Separate journey tests exercise the actual Follow transition.",
        actions: [heading("For you"), top],
      },
    ],
  },
  96: {
    family: "store-browsing",
    owner,
    startUrl: "/",
    scenario: "home-welcome",
    frames: [
      {
        state: "home-kitsch-campaign-before-store-visit",
        actions: [anchor(".campaign-kitsch", 56)],
      },
      {
        state: "kitsch-store-from-campaign",
        actions: [
          selector('.campaign-kitsch a[href="/stores/kitsch"]'),
          heading("For you"),
          top,
        ],
      },
      {
        state: "kitsch-expanded-promotions",
        actions: [selector(".store-promotion"), top],
      },
      {
        state: "kitsch-returning-recommendations-and-collections",
        entry: returning,
        notes:
          "The source changes to the returning recommendation history between frames.",
        actions: [heading("For you"), recommendations],
      },
      {
        ...chemicalFrame(),
        entry: { startUrl: chemical, scenario: "home-welcome" },
        notes:
          "A different storefront appears without a captured intervening navigation; retain it as an explicit source entry.",
      },
      {
        state: "kitsch-pinned-all-products",
        entry: { startUrl: store, scenario: "kitsch-product-arrival" },
        notes:
          "This distinct entry repeats the exact captured all-products snapshot in f017-001, including its unidentified lower photographs; no intervening navigation or product identity is inferred.",
        actions: [heading("For you"), anchor(".store-grid-heading", 77)],
      },
    ],
  },
  97: {
    family: "store-information",
    owner,
    startUrl: store,
    scenario: "home-welcome",
    frames: [
      storefront(),
      {
        state: "store-information-brand-and-categories",
        actions: [
          click("link", "Store information"),
          { type: "waitUrl", url: "**/stores/kitsch/info" },
          {
            type: "waitVisible",
            role: "link",
            name: "Close store information",
            exact: true,
          },
          top,
        ],
      },
      {
        state: "store-information-shop-all-and-reviews",
        actions: [anchor(".store-shop-all", 69)],
      },
      {
        state: "store-information-reviews-and-policies",
        actions: [
          {
            type: "anchor",
            role: "heading",
            name: "Reviews",
            exact: true,
            y: 90,
          },
        ],
      },
      {
        state: "store-information-policies-contact-and-report",
        actions: [
          {
            type: "anchor",
            role: "heading",
            name: "Policies",
            exact: true,
            y: 41,
          },
        ],
      },
    ],
  },
};
