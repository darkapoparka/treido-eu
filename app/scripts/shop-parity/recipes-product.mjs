const owner = "apps/web/src/features/discovery/product.tsx";
const shea = "/products/shea-butter";
const bag = "/products/shampoo-bag";
const top = { type: "scroll", y: 0 };
const click = (role, name) => ({ type: "click", role, name, exact: true });
const visible = (role, name) => ({
  type: "waitVisible",
  role,
  name,
  exact: true,
});
const anchor = (selector, y) => ({ type: "anchorSelector", selector, y });
const sheaHeading = visible("heading", "Shea Butter Exfoliating Body Wash");
const quantity = anchor(".quantity", 10);
const productTop = () => ({
  state: "shea-product-detail-top",
  actions: [sheaHeading, top],
});
const options = [
  sheaHeading,
  top,
  click("button", "More options"),
  visible("dialog", "More options"),
];
const offer = {
  type: "waitVisible",
  role: "dialog",
  name: /exclusive offer/,
};

// App-owned checkpoints, not accepted screens. The original
// sequence contains changed products and promotion histories; those differences
// remain explicit. Named entries retain the source's unrelated apparel and bag
// snapshots without inventing navigation from the Shea product to those items.
export const productRecipes = {
  17: {
    family: "product-detail",
    owner,
    startUrl: "/stores/kitsch",
    scenario: "kitsch-product-arrival",
    frames: [
      {
        state: "store-all-products-before-shea",
        notes:
          "The initial source has no compact coupon strip or side cart. This named $15 snapshot retains the real store-to-product transition without asserting its unrecorded Follow state.",
        actions: [
          { type: "waitVisible", selector: "#all-products" },
          anchor(".store-grid-heading", 77),
        ],
      },
      {
        state: "shea-first-arrival",
        actions: [
          {
            type: "clickSelector",
            selector: '#all-products a[href="/products/shea-butter"]',
          },
          sheaHeading,
          top,
          { type: "waitVisible", selector: ".product-price-alert-tip" },
        ],
        notes:
          "Actual prior-store history shows the save tip on the first product visit. This captured entry retains Save15 and 194.9K even after the tip expires; no timer or action changes the offer.",
      },
      {
        ...productTop(),
        state: "shea-settled-detail",
        entry: { startUrl: shea, scenario: "kitsch-product-settled" },
        notes:
          "The recording changes both Save15/194.9K to Save20/195K between frames002 and003 without showing the cause. This distinct named snapshot does not attribute that change to tip dismissal. The following gallery gesture remains in this entry.",
        actions: [
          sheaHeading,
          {
            type: "waitVisible",
            selector: '.product-page[data-price-tip="dismissed"]',
          },
          top,
        ],
      },
      {
        state: "shea-benefits-photo-in-inline-gallery",
        actions: [
          { type: "scrollElement", selector: ".product-gallery", x: 738 },
        ],
      },
      {
        state: "captured-midi-shirtdress-variants",
        entry: {
          startUrl: "/products/midi-shirtdress",
          scenario: "home-welcome",
        },
        actions: [
          visible(
            "heading",
            "Midi Shirtdress in Ultrasoft Cotton | Estate Blue/Open Air/White",
          ),
          top,
        ],
        notes:
          "The source changes seller/product without showing a transition. Preserve this distinct captured detail and its unknown seller/photo boundary.",
      },
      {
        state: "shea-purchase-options-description-and-reviews",
        entry: { startUrl: shea, scenario: "home-welcome" },
        actions: [sheaHeading, quantity],
      },
      {
        state: "bag-purchase-description-and-reviews",
        entry: { startUrl: bag, scenario: "home-welcome" },
        actions: [visible("heading", "Shampoo Bar Bag"), quantity],
      },
      {
        state: "shea-store-card-and-recommendations",
        entry: { startUrl: shea, scenario: "kitsch-shea-following" },
        notes:
          "The source already shows Following with no cart in this distinct Shea entry. Preserve that snapshot without inventing a follow action between unrelated product entries.",
        actions: [sheaHeading, anchor(".pdp-store-card", 14)],
      },
      {
        state: "bag-delivery-store-and-recommendations",
        entry: { startUrl: bag, scenario: "kitsch-bag-following-cart" },
        actions: [
          visible("heading", "Shampoo Bar Bag"),
          anchor(".pdp-delivery", 17),
        ],
        notes:
          "This distinct captured bag history already contains a followed Kitsch shop and one Shampoo Bar Bag in the cart. The entry reproduces only that evidenced state; it does not attribute either change to an unrecorded action in the preceding unrelated product snapshots.",
      },
    ],
  },
  18: {
    family: "product-gallery",
    owner,
    startUrl: shea,
    scenario: "home-welcome",
    frames: [
      productTop(),
      {
        state: "shea-fullscreen-first-photo",
        overlay: "dialog",
        actions: [
          click("button", "View product image 1"),
          visible("dialog", "Product photos"),
        ],
      },
      {
        state: "shea-fullscreen-testimonial-photo",
        overlay: "dialog",
        notes:
          "The source has two fullscreen stills and no recording. The real carousel's keyboard control selects photo 2; gesture and transition fidelity remain separate obligations.",
        actions: [{ type: "key", key: "ArrowRight" }],
      },
    ],
  },
  19: {
    family: "product-saving",
    owner,
    startUrl: shea,
    scenario: "kitsch-product-settled",
    frames: [
      productTop(),
      {
        state: "shea-saved-collection-picker",
        overlay: "dialog",
        entry: { startUrl: shea, scenario: "kitsch-product-saving-offer" },
        notes:
          "Frame002 changes the catalog to 195.2K, a Sun Aug2 arrival estimate and a 20%-off checkout offer without showing the cause. This explicit later snapshot precedes the real Save action; saving does not change the offer, delivery label or cart math. Frame003 continues this same entry.",
        actions: [
          sheaHeading,
          top,
          click("button", "Save product"),
          visible("dialog", "Save to collection"),
        ],
      },
      {
        state: "shea-item-saved-toast",
        actions: [
          click("button", "Saved"),
          { type: "waitVisible", selector: ".product-saved-toast" },
        ],
      },
    ],
  },
  20: {
    family: "product-add-to-cart",
    owner,
    startUrl: bag,
    scenario: "home-welcome",
    frames: [
      {
        state: "bag-purchase-controls-description-reviews",
        actions: [visible("heading", "Shampoo Bar Bag"), quantity],
      },
      {
        state: "bag-added-quantity-and-disabled-buy-now",
        notes:
          "The 11.0167-second recording shows a photograph flight and temporary Added to cart label before this settled state. This replay now observes the real confirmation and its reset without opening/dismissing an offer to manufacture the underlay. Reduced-motion capture suppresses only the flight; a separate no-preference journey records that animation.",
        actions: [
          click("button", "Add to cart"),
          visible("button", "Added to cart"),
          {
            type: "waitVisible",
            selector: '.pdp-purchase-buttons [data-addition="idle"]',
          },
          visible("button", "Open cart"),
          quantity,
        ],
      },
      {
        state: "bag-exclusive-offer-and-cart-summary",
        overlay: "dialog",
        notes:
          "Continue the same added cart through its visible control. The recording establishes ordering, but does not expose pointer events to prove whether its later offer was automatic; this web implementation deliberately requires the cart action rather than inventing a delayed focus-stealing popup.",
        actions: [click("button", "Open cart"), offer],
      },
    ],
  },
  32: {
    family: "product-description",
    owner,
    startUrl: bag,
    scenario: "home-welcome",
    frames: [
      {
        state: "bag-description-preview",
        actions: [visible("heading", "Shampoo Bar Bag"), quantity],
      },
      {
        state: "shea-full-description-and-ingredients",
        entry: { startUrl: shea, scenario: "home-welcome" },
        overlay: "dialog",
        notes:
          "The source switches from the bag's mesh description to Shea's ingredients. Enter Shea explicitly; do not replace the bag's real description to manufacture continuity.",
        actions: [
          sheaHeading,
          anchor(".pdp-description", 14),
          click("button", "Read more"),
          visible("dialog", "Description"),
        ],
      },
    ],
  },
  37: {
    family: "product-contact",
    owner: "apps/web/src/features/discovery/reviews.tsx",
    startUrl: shea,
    scenario: "home-welcome",
    frames: [
      productTop(),
      {
        state: "shea-product-more-options",
        overlay: "dialog",
        actions: [
          click("button", "More options"),
          visible("dialog", "More options"),
        ],
      },
      {
        state: "kitsch-contact-links-and-address",
        overlay: "dialog",
        notes:
          "Only the app-owned contact panel is replayed. No website, social account, phone call, email or clipboard operation is executed by this capture.",
        actions: [
          click("button", "Contact KITSCH"),
          visible("dialog", "Contact KITSCH"),
        ],
      },
    ],
  },
  38: {
    family: "product-reporting",
    owner: "apps/web/src/features/discovery/reviews.tsx",
    startUrl: shea,
    scenario: "product-reporting",
    frames: [
      {
        state: "shea-more-options-before-report",
        overlay: "dialog",
        actions: options,
      },
      {
        state: "product-report-no-reason",
        overlay: "dialog",
        actions: [
          click("button", "Report"),
          visible("dialog", "Report product"),
        ],
      },
      {
        state: "product-report-other-selected",
        overlay: "dialog",
        actions: [{ type: "check", role: "radio", name: "Other", exact: true }],
      },
      {
        state: "product-report-optional-notes-empty",
        overlay: "dialog",
        actions: [click("button", "Next"), visible("textbox", "Tell us more")],
      },
      {
        state: "product-report-optional-notes-testing",
        overlay: "dialog",
        actions: [
          {
            type: "fill",
            role: "textbox",
            name: "Tell us more",
            value: "testing",
          },
          { type: "blur", role: "textbox", name: "Tell us more" },
        ],
      },
      {
        state: "store-reported-product-concealed-and-confirmed",
        notes:
          "Submission remains local to the isolated preview. The source-visible confirmation, saved Rice bundle and cart-free dock are reconstructed without claiming a remote moderation response.",
        actions: [
          click("button", "Report"),
          {
            type: "waitUrl",
            url: "**/stores/kitsch?reported=shea-butter#all-products",
          },
          {
            type: "waitVisible",
            selector:
              '#all-products .product-card:has(a[href="/products/shea-butter"]) .product-reported-mark',
          },
          anchor(".store-grid-heading", 98),
        ],
      },
    ],
  },
};
