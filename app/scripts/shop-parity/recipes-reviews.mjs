const product = "/products/shea-butter/reviews";
const top = { type: "scroll", y: 0 };
const click = (role, name) => ({ type: "click", role, name, exact: true });
const visible = (role, name) => ({
  type: "waitVisible",
  role,
  name,
  exact: true,
});
const selector = (selector) => ({ type: "clickSelector", selector });
const start = () => ({
  state: "shea-reviews-summary-and-collapsed-reviews",
  actions: [visible("heading", "Reviews"), top],
});
const expandAndMarkHelpful = [
  selector(".review-card:first-of-type .read-more"),
  selector(".review-card:first-of-type .review-helpful"),
];
const common = {
  family: "product-reviews",
  owner: "apps/web/src/features/discovery/reviews.tsx",
  startUrl: product,
  scenario: "home-welcome",
};

// Every checkpoint is a real control/state, including expansion, helpful state,
// report validation and dismissal. Existing anonymized authors and the truthful
// local-only moderation message remain unmasked visual differences.
export const reviewRecipes = {
  33: {
    ...common,
    startUrl: "/products/shampoo-bag",
    frames: [
      {
        state: "bag-purchase-controls-and-review-preview",
        actions: [
          visible("heading", "Shampoo Bar Bag"),
          { type: "anchorSelector", selector: ".quantity", y: 10 },
        ],
      },
      {
        ...start(),
        entry: { startUrl: product, scenario: "home-welcome" },
        notes:
          "The source switches from the bag's 3.8K review preview to Shea's 3.3K reviews. Preserve the separate entry rather than sending the bag's Read all reviews control to the wrong product.",
      },
    ],
  },
  34: {
    ...common,
    family: "review-search",
    frames: [
      start(),
      {
        state: "shea-reviews-nice-search-results",
        actions: [
          {
            type: "fill",
            role: "searchbox",
            name: "Search reviews",
            value: "nice",
          },
          { type: "key", key: "Enter" },
          top,
        ],
      },
    ],
  },
  35: {
    ...common,
    family: "review-helpful",
    frames: [
      start(),
      {
        state: "first-review-expanded-and-marked-helpful",
        actions: [...expandAndMarkHelpful, top],
      },
    ],
  },
  36: {
    ...common,
    family: "review-reporting",
    frames: [
      start(),
      {
        state: "expanded-helpful-review-more-options",
        overlay: "dialog",
        actions: [
          ...expandAndMarkHelpful,
          click("button", "More options for Wes's review"),
          visible("dialog", "More options"),
        ],
      },
      {
        state: "review-report-reasons-unselected",
        overlay: "dialog",
        actions: [
          click("button", "Report this review"),
          visible("dialog", "Why are you reporting this review?"),
        ],
      },
      {
        state: "review-report-spam-selected",
        overlay: "dialog",
        actions: [
          { type: "check", role: "radio", name: "It’s spam", exact: true },
        ],
      },
      {
        state: "review-report-local-confirmation",
        overlay: "dialog",
        notes:
          "The source promises real moderation. This disconnected preview explicitly does not send a report; its confirmation text remains compared, not masked or misrepresented as a provider response.",
        actions: [
          click("button", "Report"),
          visible("dialog", "Thanks for reporting"),
        ],
      },
      {
        state: "reported-review-dimmed-and-marked",
        actions: [
          click("button", "Close"),
          { type: "waitVisible", selector: ".review-reported-label" },
          top,
        ],
      },
    ],
  },
  39: {
    family: "store-reviews",
    owner: "apps/web/src/features/discovery/store-reviews.tsx",
    startUrl: "/stores/kitsch/info",
    scenario: "home-welcome",
    frames: [
      {
        state: "store-information-shop-all-and-review-preview",
        actions: [
          visible("link", "Close store information"),
          { type: "anchorSelector", selector: ".store-shop-all", y: 69 },
        ],
      },
      {
        state: "store-review-list-and-rating-filters",
        actions: [
          click("link", "Reviews"),
          { type: "waitUrl", url: "**/stores/kitsch/reviews" },
          visible("heading", "Reviews"),
          top,
        ],
      },
    ],
  },
};
