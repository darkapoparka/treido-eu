const top = { type: "scroll", y: 0 };
const click = (role, name) => ({ type: "click", role, name, exact: true });
const visible = (role, name) => ({
  type: "waitVisible",
  role,
  name,
  exact: true,
});
const fill = (name, value) => ({
  type: "fill",
  role: "textbox",
  name,
  exact: true,
  value,
});
const fullViewport = { type: "viewport", width: 393, height: 793 };
const keyboardViewport = { type: "viewport", width: 393, height: 486 };
const nativeKeyboard = [
  {
    x: 0,
    y: 486,
    width: 393,
    height: 307,
    reason:
      "Frozen iOS system keyboard in f044-002/f045-003/004. Browser content is captured at source width and the app-owned 486px above it is compared unchanged.",
  },
];
const searchHeading = visible("heading", "Search");
const resultsReady = {
  type: "waitVisible",
  selector: '[data-result-id="carpenter-jeans"]',
};
const answerReady = visible("dialog", "Jeans answer");
const answerEnd = {
  type: "scrollElement",
  selector: "dialog[open] .assistant-page",
  y: 100000,
};
const openAnswer = [click("button", "View answer for Jeans"), answerReady];
const openFilter = [click("button", "Filter"), visible("dialog", "Filter")];
const rootButton = (text) => ({
  type: "click",
  selector: `dialog[open]:has(> .sheet-header h2:text-is("Filter")) button:has-text("${text}")`,
});
const dialogDone = (title) => ({
  type: "click",
  selector: `dialog[open]:has(> .sheet-header h2:text-is("${title}")) .sheet-actions button:text-is("Done")`,
});

// Source family 43-49 contains 37 ordered stills. These recipes retain that
// sequence, including real navigation loading with a held RSC request. Registration
// is replay coverage only, never visual/owner acceptance or a provider claim.
export const searchRecipes = {
  43: {
    family: "search",
    owner: "apps/web/src/features/discovery/search.tsx",
    startUrl: "/",
    scenario: "search-entry",
    frames: [
      { state: "home-before-search", actions: [top] },
      {
        state: "search-with-kitsch-history",
        actions: [click("link", "Search"), searchHeading, top],
        notes:
          "Captured entry contains product/store history and no prior conversation. Keep shopping appears only after a captured answer has been visited.",
      },
      {
        state: "search-with-returning-answer-history",
        entry: { startUrl: "/search", scenario: "search-recent" },
        actions: [searchHeading, top],
        notes:
          "Captured returning history is seeded with KITSCH first and a Jeans answer marked Just now; actual answer visits use the same history state.",
      },
    ],
  },
  44: {
    family: "search-results",
    owner: "apps/web/src/features/discovery/search.tsx",
    startUrl: "/search",
    scenario: "search-entry",
    frames: [
      { state: "search-entry", actions: [searchHeading, top] },
      {
        state: "jeans-suggestions-with-keyboard",
        masks: nativeKeyboard,
        actions: [
          { type: "holdRsc", url: "/search?q=Jeans" },
          fill("Search products", "Jeans"),
          visible("heading", "Suggestions"),
          keyboardViewport,
          top,
        ],
      },
      {
        state: "navigation-loading",
        notes:
          "Source says Thinking; the current real route loader truthfully says Loading results. No AI-provider activity is fabricated.",
        actions: [
          fullViewport,
          click("button", "Submit search"),
          { type: "waitRscHeld" },
          {
            type: "waitVisible",
            selector: '[aria-label="Loading search results"]',
          },
        ],
        captureGuard: { selector: '[aria-label="Loading search results"]' },
        afterCapture: [{ type: "releaseRsc" }, resultsReady],
      },
      {
        state: "products-loaded-before-answer",
        actions: [
          { type: "releaseRsc" },
          resultsReady,
          {
            type: "waitVisible",
            selector: '[data-search-progress="comparing"]',
          },
          top,
        ],
        captureGuard: { selector: '[data-search-progress="comparing"]' },
        notes:
          "A deliberate Jeans submit plays the recorded local answer-preview phases. Capture the real Comparing products phase after results resolve; direct result entries remain immediate and no provider activity is claimed.",
      },
      {
        state: "jeans-results-with-answer-teaser",
        actions: [visible("button", "View answer for Jeans"), top],
      },
      {
        state: "related-jeans-searches",
        actions: [
          {
            type: "anchorSelector",
            selector: '[class*="relatedSearches"]',
            y: 98,
          },
        ],
        notes:
          "The captured X721 Dusted Skinny Denim and Tough Love rows now continue directly below Related searches using source-bounded listing fixtures and extracted photography. Their uncaptured detail destinations remain explicitly unavailable rather than invented.",
      },
    ],
  },
  45: {
    family: "search-photo-assistant",
    owner: "apps/web/src/features/discovery/assistant.tsx",
    startUrl: "/search",
    scenario: "search-entry",
    frames: [
      { state: "search-before-photo", actions: [searchHeading, top] },
      {
        state: "add-photo-chooser",
        entry: { startUrl: "/search", scenario: "search-photo" },
        actions: [
          searchHeading,
          click("button", "Add photos"),
          visible("dialog", "Add photos"),
        ],
        notes:
          "The source-specific sunglasses and Jeans history is seeded, including only the evidenced partial fourth recent card. The initial sheet viewport matches the two captured library/camera rows; the explicit local captured-example path remains reachable by scrolling below them.",
      },
      {
        state: "captured-photo-selected-empty-draft",
        masks: nativeKeyboard,
        actions: [
          click("button", "Use captured cap example"),
          visible("img", "Selected photo"),
          keyboardViewport,
          top,
        ],
      },
      {
        state: "captured-photo-with-question",
        masks: nativeKeyboard,
        actions: [
          fill("Search products", "Find me a baseball cap like this"),
          top,
        ],
      },
      {
        state: "captured-photo-answer",
        actions: [
          fullViewport,
          click("button", "Submit search"),
          { type: "waitUrl", url: "**/assistant?example=photo" },
          visible("heading", "Find me a baseball cap like this"),
          top,
        ],
        notes:
          "The answer belongs to the explicitly chosen captured cap, never to an arbitrary uploaded photograph. The first rail includes only the two complete captured cards plus the evidenced partial third card; its unseen seller, title, destination, variants, and inventory remain unavailable rather than invented.",
      },
      {
        state: "photo-answer-steps-expanded",
        actions: [
          { type: "click", role: "button", name: /^Assistant steps/ },
          top,
        ],
      },
      {
        state: "photo-answer-comparison-cards",
        actions: [
          {
            type: "anchorSelector",
            selector: ".photo-assistant .assistant-answer-card",
            y: 236,
          },
        ],
      },
      {
        state: "photo-answer-preferences-and-feedback",
        actions: [{ type: "scroll", y: 100000 }],
      },
    ],
  },
  46: {
    family: "search-answer",
    owner: "apps/web/src/features/discovery/assistant.tsx",
    startUrl: "/search?q=Jeans",
    scenario: "search-entry",
    frames: [
      { state: "jeans-results-before-answer", actions: [resultsReady, top] },
      {
        state: "jeans-answer-sheet-top",
        overlay: "Jeans answer",
        actions: openAnswer,
      },
      {
        state: "jeans-answer-sheet-end",
        overlay: "Jeans answer",
        actions: [answerEnd],
        notes:
          "The source title remains in the scrollable answer while the edit/compose actions remain reachable. Exact inner scroll and image crops need source/live review.",
      },
    ],
  },
  47: {
    family: "search-answer-feedback",
    owner: "apps/web/src/features/discovery/assistant.tsx",
    startUrl: "/search?q=Jeans",
    scenario: "search-entry",
    frames: [
      {
        state: "answer-before-feedback",
        overlay: "Jeans answer",
        actions: [resultsReady, ...openAnswer, answerEnd],
      },
      {
        state: "answer-feedback-open",
        overlay: "Feedback over Jeans answer",
        actions: [
          click("button", "Give positive feedback"),
          visible("dialog", "Feedback"),
        ],
      },
      {
        state: "answer-product-feedback-selected",
        overlay: "Feedback over Jeans answer",
        actions: [
          { type: "click", role: "button", name: /^Like URBAN STRAIGHT/ },
        ],
      },
      {
        state: "answer-feedback-note-entered",
        overlay: "Feedback over Jeans answer",
        actions: [
          fill("Share any thoughts about the entire response", "Nice response"),
        ],
      },
      {
        state: "answer-feedback-confirmed-locally",
        overlay: "Jeans answer",
        actions: [
          click("button", "Submit"),
          visible(
            "button",
            "Thanks for your feedback — saved in this local example",
          ),
        ],
        notes:
          "Feedback updates this captured example locally. No feedback service or persistent account claim is made.",
      },
    ],
  },
  48: {
    family: "search-filters",
    owner: "apps/web/src/features/discovery/filters.tsx",
    startUrl: "/search?q=Jeans",
    scenario: "search-entry",
    frames: [
      { state: "jeans-results-before-filters", actions: [resultsReady, top] },
      { state: "root-search-filter", overlay: "Filter", actions: openFilter },
      {
        state: "search-filter-deals-selected",
        overlay: "Filter",
        actions: [
          { type: "check", role: "checkbox", name: "Your deals", exact: true },
        ],
      },
      {
        state: "search-filter-sort",
        overlay: "Sort by over Filter",
        actions: [rootButton("Sort by"), visible("dialog", "Sort by")],
      },
      {
        state: "search-filter-highest-price",
        overlay: "Sort by over Filter",
        actions: [click("button", "Highest → Lowest Price")],
      },
      {
        state: "search-filter-sort-returned",
        overlay: "Filter",
        actions: [dialogDone("Sort by"), visible("dialog", "Filter")],
      },
      {
        state: "search-filter-category",
        overlay: "Category over Filter",
        actions: [rootButton("Category"), visible("dialog", "Category")],
      },
      {
        state: "search-filter-women-category",
        overlay: "Women over Category over Filter",
        actions: [click("button", "Women"), visible("dialog", "Women")],
      },
      {
        state: "search-filter-pants-selected",
        overlay: "Women over Category over Filter",
        actions: [click("button", "Pants")],
      },
      {
        state: "filtered-deal-jeans-highest-price-results",
        actions: [
          dialogDone("Women"),
          dialogDone("Category"),
          dialogDone("Filter"),
          top,
        ],
        notes:
          "The source's Arrow Twenty Two / American Blues rail and Valentino / Givenchy result products require exact catalog and artwork entries. Applied facets, ordering and navigation are real local catalog behavior; unrelated products must not be relabeled to claim these results.",
      },
    ],
  },
  49: {
    family: "search-recent",
    owner: "apps/web/src/features/discovery/search-recent.tsx",
    startUrl: "/search",
    scenario: "search-entry",
    frames: [
      { state: "search-before-recent-history", actions: [searchHeading, top] },
      {
        state: "expanded-recent-store-product-history",
        entry: { startUrl: "/search", scenario: "search-recent" },
        actions: [
          click("link", "Recently viewed"),
          { type: "waitUrl", url: "**view=recent" },
          visible("heading", "Recently viewed"),
          top,
        ],
        notes:
          "Source switches ordering between compact and expanded histories. All eight entries are identified, including The Loaded Tea Shop from the matching full Home logo/title. Only the upper DRMTLGY photograph is visible before the captured dock; it remains a partial source asset.",
      },
    ],
  },
};
