const top = { type: "scroll", y: 0 };
const click = (role, name) => ({ type: "click", role, name, exact: true });
const clickSelector = (selector) => ({ type: "clickSelector", selector });
const visible = (selector) => ({ type: "waitVisible", selector });
const heading = (name) => ({
  type: "waitVisible",
  role: "heading",
  name,
  exact: true,
});
const fill = (label, value) => ({ type: "fill", label, value, exact: true });
const blur = (label) => ({ type: "blur", label, exact: true });
const anchor = (selector, y = 24) => ({ type: "anchorSelector", selector, y });
const entry = (startUrl, scenario) => ({ startUrl, scenario });
const detail = "/orders/REF-1001";
const manual = "/orders/REF-manual-shirt";
const waiting = `${detail}?state=waiting`;
const transit = `${detail}?state=in-transit`;
const delivered = `${detail}?state=delivered`;
const tracking = `${detail}?view=tracking`;
const transitMap = `${tracking}&state=in-transit&map=1`;
const deliveredMap = `${tracking}&state=delivered&map=1`;
const label = `${tracking}&progress=label`;
const owner = "apps/web/src/features/commerce/orders.tsx";
const trackingOwner = "apps/web/src/features/commerce/tracking.tsx";
const historyNote =
  "The ordered source contains a separate captured account or carrier history. This explicit local fixture entry does not simulate a live carrier update.";
const mapNote =
  "Map geography uses the matching frozen transit/delivered source. Native card, pin, route and panel pixels are excluded and rendered as DOM; hidden streets remain unavailable.";

export const orderRecipes = {
  60: {
    family: "orders-list",
    owner,
    startUrl: "/",
    scenario: "home-welcome",
    frames: [
      { state: "home-before-orders", actions: [top] },
      {
        state: "orders-empty",
        entry: entry("/orders", "orders-empty"),
        notes: historyNote,
        actions: [heading("Orders"), top],
      },
      {
        state: "orders-waiting",
        entry: entry("/orders?view=waiting", "orders-waiting"),
        notes: historyNote,
        actions: [visible(".tracking-card"), top],
      },
      {
        state: "orders-label-created-with-past-package",
        entry: entry("/orders?progress=label", "orders-transit-history"),
        notes: historyNote,
        actions: [visible(".orders-past"), top],
      },
      {
        state: "orders-in-transit-with-past-package",
        entry: entry("/orders", "orders-transit-history"),
        notes: historyNote,
        actions: [visible(".orders-past"), top],
      },
      {
        state: "orders-delivered-review-invitation",
        entry: entry("/orders", "orders-delivered-history"),
        notes: historyNote,
        actions: [visible(".review-stars"), top],
      },
    ],
  },
  61: {
    family: "orders-detail-tracking",
    owner,
    startUrl: "/orders?view=waiting",
    scenario: "orders-waiting",
    frames: [
      { state: "orders-waiting-before-detail", actions: [top] },
      {
        state: "order-detail-waiting",
        actions: [clickSelector(".tracking-card"), visible(".order-hero"), top],
      },
      {
        state: "order-detail-in-transit",
        entry: entry(transit, "orders-transit"),
        notes: historyNote,
        actions: [visible(".order-status"), top],
      },
      {
        state: "order-detail-delivered",
        entry: entry(delivered, "orders-delivered"),
        notes: historyNote,
        actions: [visible(".review-invitation"), top],
      },
      {
        state: "order-tracking-waiting",
        entry: entry(waiting, "orders-waiting"),
        notes: historyNote,
        actions: [
          clickSelector(".order-status"),
          visible(".tracking-order-card"),
          top,
        ],
      },
      {
        state: "manual-package-label-created",
        entry: entry(manual, "orders-manual"),
        notes: historyNote,
        actions: [heading("No delivery updates"), top],
      },
      {
        state: "order-tracking-label-created",
        entry: entry(label, "orders-transit"),
        notes: historyNote,
        actions: [visible(".tracking-carrier"), top],
      },
      {
        state: "order-tracking-map-in-transit",
        entry: entry(tracking, "orders-transit"),
        notes: `${historyNote} ${mapNote}`,
        actions: [
          clickSelector(".tracking-status-card"),
          visible(".tracking-map"),
          top,
        ],
      },
      {
        state: "order-tracking-map-delivered",
        entry: entry(deliveredMap, "orders-delivered"),
        notes: `${historyNote} ${mapNote}`,
        actions: [visible(".tracking-map"), top],
      },
      {
        state: "order-label-created-delivery-progress",
        entry: entry(label, "orders-transit"),
        notes: historyNote,
        actions: [anchor(".delivery-preview", 12)],
      },
      {
        state: "order-in-transit-delivery-progress",
        entry: entry(transitMap, "orders-transit"),
        notes: `${historyNote} ${mapNote}`,
        actions: [anchor(".delivery-preview", 33)],
      },
    ],
  },
  62: {
    family: "order-copy-number",
    owner,
    startUrl: waiting,
    scenario: "orders-waiting",
    frames: [
      { state: "order-detail-before-menu", actions: [top] },
      {
        state: "order-actions",
        overlay: "dialog",
        actions: [
          click("button", "Order options"),
          visible(".source-order-menu[open]"),
        ],
      },
      {
        state: "order-number-copied",
        actions: [
          click("button", "Copy order number"),
          visible(".order-action-toast"),
          top,
        ],
      },
    ],
  },
  63: {
    family: "manual-order-delivered",
    owner: trackingOwner,
    startUrl: manual,
    scenario: "orders-manual",
    frames: [
      { state: "manual-package-before-mark-delivered", actions: [top] },
      {
        state: "manual-package-marked-delivered",
        actions: [
          click("button", "Mark as delivered"),
          heading("Delivered today"),
          visible(".delivery-confetti"),
          top,
        ],
      },
      {
        state: "manual-package-delivered-later-history",
        entry: entry(
          `${manual}?history=delivered-later`,
          "orders-manual-delivered",
        ),
        notes: historyNote,
        actions: [heading("Delivered today"), top],
      },
    ],
  },
  64: {
    family: "order-delivery-activity",
    owner: trackingOwner,
    startUrl: transitMap,
    scenario: "orders-transit",
    frames: [
      {
        state: "order-delivery-progress-preview",
        actions: [anchor(".delivery-preview", 33)],
      },
      {
        state: "delivered-order-full-activity",
        entry: entry(deliveredMap, "orders-delivered"),
        overlay: "dialog",
        notes: `${historyNote} The source's full activity is captured after delivery, whereas its preceding frame shows in-transit history.`,
        actions: [
          anchor(".delivery-preview", 33),
          click("button", "View all activity"),
          visible(".full-activity-sheet[open]"),
        ],
      },
      {
        state: "full-delivery-activity-earliest-events",
        overlay: "dialog",
        actions: [
          {
            type: "scrollElement",
            selector: ".full-activity-sheet[open]",
            y: 460,
          },
        ],
      },
    ],
  },
  65: {
    family: "order-edit-tracking",
    owner,
    startUrl: transitMap,
    scenario: "orders-transit",
    frames: [
      {
        state: "order-delivery-preview-before-edit",
        actions: [anchor(".delivery-preview", 33)],
      },
      {
        state: "tracking-editor-unchanged",
        overlay: "dialog",
        actions: [
          click("button", "Edit tracking details"),
          visible(".tracking-edit-sheet[open]"),
        ],
      },
      {
        state: "tracking-editor-name-changed",
        overlay: "dialog",
        actions: [
          fill("Package name", "Shampoo Bar Bag KITSCH"),
          blur("Package name"),
        ],
      },
      {
        state: "tracking-details-saved",
        actions: [
          click("button", "Update tracking details"),
          visible(".order-action-toast"),
          anchor(".delivery-preview", 33),
        ],
      },
    ],
  },
  66: {
    family: "order-archive",
    owner,
    startUrl: "/orders?view=waiting",
    scenario: "orders-waiting",
    frames: [
      { state: "orders-before-archive", actions: [top] },
      {
        state: "order-archive-empty",
        actions: [
          click("link", "View archived orders"),
          heading("Archived"),
          top,
        ],
      },
      {
        state: "order-archive-one-order",
        entry: entry(waiting, "orders-waiting"),
        notes:
          "The source's next history has one archived order. Replay the local Archive action before navigating to the archive.",
        actions: [
          click("button", "Order options"),
          click("button", "Archive order"),
          click("link", "Orders"),
          click("button", "More order options"),
          click("link", "View order archive"),
          visible(".archive-order-row"),
          top,
        ],
      },
    ],
  },
  67: {
    family: "order-review",
    owner,
    startUrl: "/orders",
    scenario: "orders-delivered-history",
    frames: [
      { state: "orders-before-review", actions: [top] },
      {
        state: "order-review-five-stars",
        actions: [
          clickSelector(".tracking-card"),
          visible(".order-review-page"),
          heading("Review your order"),
          top,
        ],
      },
      {
        state: "order-review-written",
        actions: [
          fill("Tell us about the product", "Love it"),
          blur("Tell us about the product"),
          top,
        ],
      },
      {
        state: "order-review-saved-locally",
        notes:
          "Review submission updates isolated local state. The nonvisual status announces that no review publishing provider is connected without adding content absent from the captured screen.",
        actions: [click("button", "Submit"), heading("Edit your review"), top],
      },
    ],
  },
  68: {
    family: "order-add-manually",
    owner,
    startUrl: "/orders",
    scenario: "orders-delivered-history",
    frames: [
      { state: "orders-before-manual-add", actions: [top] },
      {
        state: "orders-more-options",
        entry: entry("/orders?view=manual", "orders-waiting"),
        overlay: "dialog",
        notes: `${historyNote} The menu source uses the waiting order and Buy again history.`,
        actions: [
          click("button", "More order options"),
          heading("More options"),
        ],
      },
      {
        state: "manual-order-empty",
        notes:
          "The captured forwarding address is display-only; its controls open an unavailable-service boundary and cannot send email.",
        actions: [
          click("link", "Add order manually"),
          heading("Add order manually"),
          top,
        ],
      },
      {
        state: "manual-order-carrier-search",
        actions: [
          fill("Tracking number", "68448512123"),
          fill("Package name", "Loose Fit Printed T-Shirt"),
          fill("Carrier", "DHL"),
          heading("Recommended carriers"),
          top,
        ],
      },
      {
        state: "manual-order-carrier-selected",
        actions: [
          click("button", "DHL eCommerce"),
          visible(
            'button[type="submit"], .account-form > .form-submit:not([hidden])',
          ),
          top,
        ],
      },
      {
        state: "manual-order-added-locally",
        actions: [
          click("button", "Add order"),
          heading("Orders"),
          visible(".orders-buy-again"),
          top,
        ],
      },
    ],
  },
  79: {
    family: "profile-order-history",
    owner,
    startUrl: "/profile",
    scenario: "profile-complete",
    frames: [
      { state: "profile-before-order-history", actions: [top] },
      {
        state: "profile-order-history",
        actions: [
          click("link", "Order history ›"),
          heading("Order history"),
          visible(".history-connect-banner"),
          top,
        ],
      },
    ],
  },
};
