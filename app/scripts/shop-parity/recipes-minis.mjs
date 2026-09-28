const top = { type: "scroll", y: 0 };
const click = (role, name) => ({ type: "click", role, name, exact: true });
const selectorClick = (selector) => ({ type: "clickSelector", selector });
const visible = (selector) => ({ type: "waitVisible", selector });
const heading = (name) => ({
  type: "waitVisible",
  role: "heading",
  name,
  exact: true,
});
const anchor = (selector, y = 24) => ({ type: "anchorSelector", selector, y });
const feature = (id) => `.mini-feature[href="/minis/${id}"]`;
const carousel = (x) => ({
  type: "scrollElement",
  selector: ".mini-carousel",
  x,
});
const names = {
  sol: "Sol: Browse by Voice",
  skin: "Skincare AI",
  look: "Get the Look",
};
// The source catalogue combines previous visits. Build those visits through
// actual links; never inject Mini history into the DOM or persistent store.
const visit = (id) => [
  selectorClick(feature(id)),
  ...(id === "sol" ? [click("button", "Agree")] : []),
  ...(id === "look"
    ? [click("button", "Dismiss Get the Look terms notice")]
    : []),
  click("link", `Close ${names[id]}`),
  heading("Minis"),
];
const history = (ids, x) => [...ids.flatMap(visit), carousel(x), top];
const minis = (state, actions = []) => ({ state, actions });
const sourceOwner = "apps/web/src/features/discovery/minis.tsx";

export const miniRecipes = {
  50: {
    family: "explore",
    owner: "apps/web/src/features/discovery/explore.tsx",
    startUrl: "/",
    scenario: "home-welcome",
    frames: [
      { state: "home-before-explore", actions: [top] },
      {
        state: "explore-categories",
        actions: [click("link", "Explore"), heading("Explore"), top],
      },
      {
        state: "explore-minis-and-home-shelf",
        actions: [anchor(".explore-minis", 26)],
      },
      {
        state: "explore-menswear-beauty-womenswear",
        actions: [anchor(".explore-shelf:nth-of-type(3)", 18)],
      },
    ],
  },
  51: {
    family: "explore-beauty",
    owner: "apps/web/src/features/discovery/explore.tsx",
    startUrl: "/explore",
    scenario: "home-welcome",
    frames: [
      { state: "explore-categories", actions: [top] },
      {
        state: "beauty-categories-curls-top-rated",
        actions: [
          selectorClick('.explore-categories a[href="/explore/Beauty"]'),
          { type: "waitUrl", url: "**/explore/Beauty" },
          heading("Beauty"),
          top,
        ],
      },
      {
        state: "beauty-new-starter-set",
        actions: [anchor(".explore-shelf:nth-of-type(2)", 18)],
      },
      {
        state: "beauty-scent-and-favorites",
        actions: [anchor(".beauty-section:has(.beauty-category-grid)", 25)],
      },
      {
        state: "beauty-favorites-grid",
        actions: [anchor(".beauty-section:has(.beauty-brand-grid)", 32)],
      },
      {
        state: "beauty-sweet-deals-and-nails",
        actions: [anchor(".beauty-section:has(.beauty-deals)", 175)],
      },
    ],
  },
  52: {
    family: "minis-catalogue",
    owner: sourceOwner,
    startUrl: "/explore",
    scenario: "home-welcome",
    frames: [
      minis("explore-minis-entry", [anchor(".explore-minis", 26)]),
      minis("minis-sol-card", [
        click("link", "Try something new"),
        heading("Minis"),
        top,
      ]),
      minis("minis-sol-recently-viewed", [...visit("sol"), carousel(0), top]),
      minis("minis-skincare-card", [carousel(368)]),
      minis("minis-look-card-and-skin-history", [
        ...visit("skin"),
        carousel(736),
        top,
      ]),
      minis("minis-gift-card-and-look-history", [
        ...visit("look"),
        carousel(1104),
        top,
      ]),
    ],
  },
  53: {
    family: "minis-sol-setup",
    owner: "apps/web/src/features/discovery/sol.tsx",
    startUrl: "/minis",
    scenario: "home-welcome",
    frames: [
      minis("minis-sol-entry", [top]),
      {
        state: "sol-mini-access",
        overlay: "dialog",
        notes:
          "Local access disclosure is retained; no profile or saved products are sent to the Mini.",
        actions: [
          selectorClick(feature("sol")),
          visible("dialog[open].mini-access"),
        ],
      },
      minis("sol-welcome", [click("button", "Agree"), heading("Hi, I’m Sol")]),
      {
        state: "sol-microphone-permission-preview",
        overlay: "dialog",
        notes:
          "Recorded permission adapted to a web dialog. No operating-system microphone permission is requested.",
        actions: [
          click("button", "Allow & Continue ›"),
          heading("Allow access to your microphone?"),
        ],
      },
      minis("sol-connecting", [
        click("button", "Share"),
        visible('[data-sol-phase="connecting"]'),
      ]),
      minis("sol-greeting", [visible('[data-sol-phase="greeting"]')]),
    ],
  },
  54: {
    family: "minis-sol-voice",
    owner: "apps/web/src/features/discovery/sol.tsx",
    startUrl: "/minis/sol?sol=greeting",
    scenario: "home-welcome",
    notes:
      "Continues the greeting at the end of flow 53. The preview control selects the recorded voice example without acquiring audio.",
    frames: [
      minis("sol-greeting", [visible('[data-sol-phase="greeting"]')]),
      minis("sol-sunglasses-response", [
        click("button", "Sol preview controls"),
        click("button", "Use captured sunglasses voice example"),
        visible('[data-sol-phase="response"]'),
      ]),
      minis("sol-glasses-choices", [visible('[data-sol-phase="choices"]')]),
      minis("sol-gold-glasses-selected", [
        click("button", "Gold rimless glasses"),
        visible('[data-sol-phase="selected"]'),
      ]),
      minis("sol-glasses-recommendations", [
        visible('[data-sol-phase="results"]'),
      ]),
    ],
  },
  55: {
    family: "minis-sol-text",
    owner: "apps/web/src/features/discovery/sol.tsx",
    startUrl: "/minis/sol?sol=greeting",
    scenario: "home-welcome",
    frames: [
      minis("sol-greeting", [visible('[data-sol-phase="greeting"]')]),
      minis("sol-text-empty", [
        click("button", "Type instead"),
        visible('input[aria-label="Message Sol"]'),
      ]),
      minis("sol-text-cap-draft", [
        {
          type: "fill",
          role: "textbox",
          name: "Message Sol",
          value: "Baseball cap",
        },
      ]),
      minis("sol-cap-choices", [
        click("button", "Send local message"),
        visible('[data-sol-phase="choices"][data-sol-topic="caps"]'),
      ]),
    ],
  },
  56: {
    family: "minis-sol-mute",
    owner: "apps/web/src/features/discovery/sol.tsx",
    startUrl: "/minis/sol?sol=greeting",
    scenario: "home-welcome",
    frames: [
      minis("sol-microphone-on-preview", [
        visible('[data-sol-phase="greeting"]'),
      ]),
      minis("sol-microphone-muted-preview", [
        click("button", "Mute microphone preview"),
      ]),
    ],
  },
  57: {
    family: "minis-skin",
    owner: sourceOwner,
    startUrl: "/minis",
    scenario: "home-welcome",
    frames: [
      minis("minis-skincare-entry", history(["sol"], 368)),
      minis("skincare-welcome", [
        selectorClick(feature("skin")),
        visible('[data-skin-phase="welcome"]'),
      ]),
      {
        state: "skincare-camera-permission-preview",
        overlay: "dialog",
        notes: "Web permission preview; camera access is not requested.",
        actions: [
          click("button", "Analyze My Skin"),
          heading("Allow access to your camera?"),
        ],
      },
      {
        state: "skincare-photo-choice-web-adaptation",
        overlay: "dialog",
        notes:
          "An anchored frosted web dialog preserves the three recorded choices. All choices use local file inputs; Take Photo delegates to the device capture picker. The operating-system picker itself remains platform-specific.",
        actions: [
          click("button", "Share"),
          visible("dialog[open] button[data-photo-option]"),
        ],
      },
      minis("skincare-recorded-analysis", [
        { type: "key", key: "Escape" },
        click("button", "Skincare AI preview controls"),
        click("button", "View reference example"),
        visible('[data-skin-phase="analyzing"]'),
      ]),
      {
        state: "skincare-recorded-summary",
        notes:
          "Visible recorded-example disclosure is retained. Skin analysis is not connected.",
        actions: [visible('[data-skin-phase="results"]'), top],
      },
      minis("skincare-cleanser-grid", [
        anchor('[data-skin-phase="results"] > h2', 37),
      ]),
    ],
  },
  58: {
    family: "minis-get-look",
    owner: sourceOwner,
    startUrl: "/minis",
    scenario: "home-welcome",
    frames: [
      minis("minis-get-look-entry", history(["sol", "skin"], 736)),
      minis("get-look-terms-notice", [
        selectorClick(feature("look")),
        visible('aside[aria-label="Get the Look terms notice"]'),
      ]),
      minis("get-look-welcome", [
        click("button", "Dismiss Get the Look terms notice"),
      ]),
      {
        state: "get-look-photo-choice-web-adaptation",
        overlay: "dialog",
        notes:
          "An anchored frosted web dialog preserves Photo Library, Take Photo and Choose File as real local inputs; the device picker remains platform-specific. The captured outfit is explicitly available from the Mini preview controls.",
        actions: [
          click("button", "Choose Photo"),
          visible("dialog[open] button[data-photo-option]"),
        ],
      },
      minis("get-look-recorded-scan", [
        { type: "key", key: "Escape" },
        click("button", "Get the Look preview controls"),
        click("button", "Use reference outfit"),
        visible('[data-look-phase="scanning"]'),
      ]),
      minis("get-look-outfit-hotspots", [
        visible('[data-look-phase="results"]'),
        top,
      ]),
      minis("get-look-selected-shirt", [
        click("button", "Women’s Black Crew Neck T-shirt"),
      ]),
      {
        state: "get-look-all-matching-pieces",
        notes:
          "Each recorded rail exposes two complete recommendations and only a bounded third-card continuation. Preserve that continuation without inventing an unseen product identity, destination, or lower skirt-card extent.",
        actions: [
          click("button", "View all matching pieces"),
          { type: "waitUrl", url: "**/minis/look?look=results&matches=shirt" },
          visible("#look-blazer"),
        ],
      },
    ],
  },
};

miniRecipes[59] = {
  family: "minis-gift-sense",
  owner: sourceOwner,
  startUrl: "/minis",
  scenario: "profile-named",
  frames: [
    minis("minis-gift-entry", history(["sol", "skin", "look"], 1104)),
    minis("gift-welcome", [
      selectorClick(feature("gift")),
      visible('[data-gift-phase="welcome"]'),
    ]),
    minis("gift-recipient-question", [click("button", "Let’s Begin")]),
    {
      state: "gift-personality-question",
      notes:
        "The captured recipient bubble reads Support. Replay this literal custom answer rather than substituting Friend or inferring a relationship.",
      actions: [
        {
          type: "fill",
          role: "textbox",
          name: "Gift answer",
          value: "Support",
          exact: true,
        },
        click("button", "Continue gift questions"),
        visible('[data-gift-phase="personality"]'),
      ],
    },
    minis("gift-personality-selected", [
      ...["Creative", "Thoughtful", "Tech-Savvy", "Homebody"].map((name) =>
        click("button", name),
      ),
    ]),
    minis("gift-budget-selected-notes-empty", [
      click("button", "Continue"),
      click("button", "Under $25"),
      visible('[data-gift-phase="notes"]'),
    ]),
    minis("gift-notes-draft", [
      {
        type: "fill",
        role: "textbox",
        name: "Optional gift notes",
        value: "He likes black color",
        exact: true,
      },
    ]),
    {
      state: "gift-local-profile-consent",
      overlay: "dialog",
      notes:
        "Visible recorded-preview disclosure is retained. No answers, profile or saved products are shared with a gift service.",
      actions: [
        click("button", "Continue gift questions"),
        visible("dialog[open].mini-access"),
      ],
    },
    minis("gift-recorded-finding", [
      click("button", "Agree"),
      visible('[data-gift-phase="finding"]'),
    ]),
    {
      state: "gift-results-loading-artwork",
      notes:
        "Recorded product media placeholders are a separate local playback state, matching source f059-010 before the artwork has appeared.",
      actions: [visible('[data-gift-phase="results-loading"]')],
    },
    minis("gift-results-loaded", [
      visible('[data-gift-phase="results"]'),
      { type: "scrollElement", selector: ".gift-conversation", y: 10000 },
    ]),
  ],
};
