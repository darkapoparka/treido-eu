const owner = "apps/web/src/features/commerce/checkout.tsx";
const bag = "/products/shampoo-bag";
const checkout = "/checkout?store=kitsch";
const click = (role, name) => ({
  type: "click",
  role,
  name,
  exact: typeof name === "string",
});
const fill = (name, value) => ({
  type: "fill",
  role: "textbox",
  name,
  value,
  exact: true,
});
const visible = (role, name) => ({
  type: "waitVisible",
  role,
  name,
  exact: typeof name === "string",
});
const anchor = (selector, y) => ({ type: "anchorSelector", selector, y });
const scrollSheet = (selector, y) => ({
  type: "scrollElement",
  selector: `${selector}[open]`,
  y,
});
const top = { type: "scroll", y: 0 };
const fullViewport = { type: "viewport", width: 393, height: 793 };
const keyboardViewport = { type: "viewport", width: 393, height: 487 };
const keyboardMask = [{ x: 0, y: 487, width: 393, height: 306 }];
const keyboardNote =
  "The source-owned content is compared at 393 pixels wide. Only the captured native iOS keyboard below y487 is excluded; the browser uses a reduced content viewport instead of painting an OS keyboard.";
const state = (name, actions = [], extra = {}) => ({
  state: name,
  actions,
  ...extra,
});
const quantity = anchor(".quantity", 10);
const openCart = [click("button", "Open cart"), visible("dialog", "Your cart")];
const addBag = [
  visible("heading", "Shampoo Bar Bag"),
  click("button", "Add to cart"),
  visible("button", "Added to cart"),
  {
    type: "waitVisible",
    selector: '.pdp-purchase-buttons [data-addition="idle"]',
  },
  click("button", "Open cart"),
  visible("dialog", /exclusive offer/),
  { ...click("button", /^Close /), withinDialog: true },
  quantity,
];
const enterCheckout = [
  click("link", "Continue to checkout"),
  visible("heading", "Review & Pay"),
  top,
];
const expandDelivery = [
  click("button", /^Ship to/),
  click("button", /^Shipping/),
  click("button", /^Plan/),
  top,
];
const expandPayment = [
  click("button", /^Payment/),
  anchor(".checkout-section:nth-child(3)", 189),
];
const recommendations = anchor(".checkout-recommendations header", 214);
const openAddress = [
  click("button", /Use a different address/),
  visible("dialog", "Add address"),
];
const selectAddress = [
  fill("Address", "1226 University Dr, Menlo"),
  { type: "clickSelector", selector: ".source-address-result" },
];
const saveAddress = [
  click("button", "Save address"),
  visible("button", /Use a different address/),
  top,
];
const initialCard = [
  fill("Card number", "4242424242424242"),
  fill("Expiry (MM/YY)", "12/30"),
  fill("CVV", "123"),
  fill("Name on card", "Alex Smith"),
  { type: "blur", role: "textbox", name: "Name on card", exact: true },
];
const redactedAddressNote =
  "The source redacts the newly entered street number. The isolated replay uses the already visible 1226 University Dr as a second local address; its text remains an explicit fixture difference, with no mask over app content.";
const redactedCardNote =
  "Card fields are redacted in the source. This replay enters public synthetic card values only, does not transmit or store them, and leaves the source redaction as an explicit visual difference instead of masking payment UI.";

// All 49 ordered definitions preserve manifest identities. Definitions are not
// completed captures or source acceptance. Disconnected seller/source histories
// use explicit entry checkpoints; the remaining frames follow actual controls.
export const checkoutRecipes = {
  21: {
    family: "checkout-purchase",
    owner,
    startUrl: bag,
    scenario: "home-welcome",
    frames: [
      state("bag-after-add-before-cart", addBag),
      state("bag-cart-discount-and-checkout", openCart, { overlay: "dialog" }),
      state("checkout-review-collapsed", enterCheckout),
      state("checkout-address-shipping-plan-expanded", expandDelivery),
      state("checkout-plan-and-payment-expanded", expandPayment),
      state(
        "white-rock-captured-shipping",
        [visible("heading", "Review & Pay"), top],
        {
          entry: {
            startUrl: "/checkout?store=white-rock",
            scenario: "checkout",
          },
          notes:
            "The source switches to a different seller/item without its preceding navigation. This named entry preserves that captured checkout; the bag is not given unsupported pickup eligibility.",
        },
      ),
      state("white-rock-captured-pickup", [click("tab", "Pickup")]),
      state(
        "kitsch-recommendations-and-total",
        [visible("heading", "Review & Pay"), recommendations],
        {
          entry: { startUrl: checkout, scenario: "checkout" },
          notes:
            "The source returns to the Kitsch bag after the disconnected White Rock checkout. The named checkout history restores that seller context.",
        },
      ),
      state(
        "kitsch-pay-processing",
        [
          { type: "pauseClock" },
          click("button", /Pay now \$10\.82/),
          { type: "advanceClock", ms: 800 },
          {
            type: "waitVisible",
            selector: '.source-checkout[aria-busy="true"]',
          },
          { type: "waitVisible", selector: '[data-processing-caption="true"]' },
        ],
        {
          captureGuard: { selector: '[data-processing-caption="true"]' },
          afterCapture: [{ type: "resumeClock" }],
        },
      ),
      state(
        "captured-order-confirmation",
        [
          // Isolated-frame replay did not take frame 9's screenshot, so its
          // afterCapture hook has not run. Resume in either replay mode.
          { type: "resumeClock" },
          visible("dialog", "Payment service is not connected"),
          click("link", "View captured source confirmation"),
          visible("heading", "Order confirmed"),
          { type: "waitVisible", selector: '[data-confirmation-stage="0"]' },
          top,
        ],
        {
          notes:
            "The live payment action stops at the unconnected-service boundary. Continuing opens a captured source confirmation; it does not create an order or charge a card.",
        },
      ),
    ],
  },
  22: {
    family: "cart-removal",
    owner: "apps/web/src/features/commerce/cart.tsx",
    startUrl: bag,
    scenario: "cart-bag",
    frames: [
      state(
        "bag-cart-before-removal",
        [visible("heading", "Shampoo Bar Bag"), quantity, ...openCart],
        { overlay: "dialog" },
      ),
      state(
        "cart-empty-after-removal",
        [
          click("button", "Remove Shampoo Bar Bag"),
          visible("heading", "Your cart is empty"),
        ],
        { overlay: "dialog" },
      ),
    ],
  },
  23: {
    family: "cart-save-for-later",
    owner: "apps/web/src/features/commerce/cart.tsx",
    startUrl: bag,
    scenario: "cart-unavailable",
    frames: [
      state(
        "captured-unavailable-bag-cart",
        [visible("heading", "Shampoo Bar Bag"), quantity, ...openCart],
        {
          overlay: "dialog",
          notes:
            "The source's post-save Move to cart action is disabled. This captured availability fixture establishes that state before the real save action; no stock change is fabricated at save time.",
        },
      ),
      state(
        "cart-empty-and-bag-saved-for-later",
        [
          click("button", "Save for later"),
          visible("heading", "Saved for later"),
        ],
        { overlay: "dialog" },
      ),
    ],
  },
  24: {
    family: "checkout-initial-phone",
    owner,
    startUrl: bag,
    scenario: "onboarding-new",
    frames: [
      state("new-buyer-cart-before-phone", [...addBag, ...openCart], {
        overlay: "dialog",
      }),
      state(
        "phone-number-empty",
        [
          click("link", "Continue to checkout"),
          visible("heading", "Add phone number"),
          keyboardViewport,
        ],
        { masks: keyboardMask, notes: keyboardNote },
      ),
      state("phone-number-entered", [fill("Phone number", "6502137552")], {
        masks: keyboardMask,
        notes: keyboardNote,
      }),
      state(
        "phone-security-code-empty",
        [click("button", "Next"), visible("heading", "Confirm it’s you")],
        { masks: keyboardMask, notes: keyboardNote },
      ),
      state("phone-security-code-processing", [
        fullViewport,
        fill("Security code", "469343"),
        { type: "waitVisible", selector: ".source-code-spinner" },
      ]),
      state(
        "captured-shipping-address-after-code",
        [
          visible("dialog", "Phone verification is not connected"),
          click("button", "Continue to captured shipping address"),
          visible("heading", "Shipping address"),
          top,
        ],
        {
          notes:
            "The six digits come from the frozen source. No OTP is sent or verified; the explicit local boundary leads to the captured address screen.",
        },
      ),
    ],
  },
  25: {
    family: "checkout-initial-address",
    owner,
    startUrl: `${checkout}&stage=address-search`,
    scenario: "checkout",
    frames: [
      state("initial-shipping-address-search-empty", [
        visible("heading", "Shipping address"),
        top,
      ]),
      state(
        "initial-shipping-address-suggestion",
        [keyboardViewport, fill("Search address", "1226 University Dr, Menlo")],
        { masks: keyboardMask, notes: keyboardNote },
      ),
      state("initial-selected-address-details-empty", [
        fullViewport,
        click("button", /^1226 University Dr/),
        visible("textbox", "First name"),
        top,
      ]),
      state("initial-address-edit-form", [
        fill("First name", "Alex"),
        fill("Last name", "Smith"),
        click("button", "Edit"),
        top,
      ]),
      state("initial-address-edit-locality", [
        anchor(".source-address-editor-initial .source-country-field", 80),
      ]),
      state("initial-payment-empty-after-address", [
        click("button", "Continue to payment details"),
        visible("heading", "Add a card"),
        top,
      ]),
    ],
  },
  26: {
    family: "checkout-initial-card",
    owner: "apps/web/src/features/commerce/initial-payment.tsx",
    startUrl: `${checkout}&stage=payment-setup`,
    scenario: "checkout",
    frames: [
      state("initial-card-empty", [visible("heading", "Add a card"), top]),
      state("initial-card-complete", initialCard, { notes: redactedCardNote }),
      state(
        "review-after-captured-card",
        [
          click("button", "Continue to review"),
          visible("dialog", "Payment service is not connected"),
          click("button", "Continue with saved payment method"),
          visible("heading", "Review & Pay"),
          { type: "waitVisible", selector: '[data-review-stage="0"]' },
          top,
        ],
        {
          notes:
            "Continue uses the existing captured payment method after the explicit unconnected-service boundary. No card was saved or charged.",
        },
      ),
    ],
  },
  27: {
    family: "checkout-review-address",
    owner,
    startUrl: checkout,
    scenario: "checkout",
    frames: [
      state("review-expanded-before-new-address", [
        visible("heading", "Review & Pay"),
        ...expandDelivery,
      ]),
      state("review-new-address-empty", openAddress, { overlay: "dialog" }),
      state(
        "review-address-suggestions-and-keyboard",
        [
          keyboardViewport,
          fill("Address", "1226 University Dr, Menlo"),
          scrollSheet(".source-address-sheet", 143),
        ],
        {
          overlay: "dialog",
          masks: [...keyboardMask, { x: 16, y: 429, width: 361, height: 48 }],
          notes: `${keyboardNote} The native input accessory with up/down/done controls at (16,429,361,48) is also excluded. ${redactedAddressNote}`,
        },
      ),
      state(
        "review-new-address-locality-filled",
        [
          fullViewport,
          { type: "clickSelector", selector: ".source-address-result" },
          scrollSheet(".source-address-sheet", 0),
        ],
        { overlay: "dialog", notes: redactedAddressNote },
      ),
      state(
        "review-new-address-save-visible",
        [scrollSheet(".source-address-sheet", 50)],
        { overlay: "dialog", notes: redactedAddressNote },
      ),
      state("review-new-address-selected", saveAddress, {
        notes: redactedAddressNote,
      }),
    ],
  },
  28: {
    family: "checkout-review-address-removal",
    owner,
    startUrl: checkout,
    scenario: "checkout",
    frames: [
      state(
        "review-two-addresses-before-removal",
        [
          visible("heading", "Review & Pay"),
          ...expandDelivery,
          ...openAddress,
          ...selectAddress,
          ...saveAddress,
        ],
        { notes: redactedAddressNote },
      ),
      state(
        "review-new-address-options",
        [
          {
            type: "clickSelector",
            selector:
              ".checkout-addresses .address-radio.selected .context-trigger",
          },
        ],
        { notes: redactedAddressNote },
      ),
      state(
        "review-delete-address-confirmation",
        [
          {
            type: "clickSelector",
            selector: ".checkout-context-menu .danger-text",
          },
          visible("dialog", "Delete address"),
        ],
        { overlay: "dialog", notes: redactedAddressNote },
      ),
      state("review-address-deleted-original-selected", [
        { ...click("button", "Delete"), withinDialog: true },
        visible("button", /Use a different address/),
        top,
      ]),
    ],
  },
  29: {
    family: "checkout-review-payment",
    owner,
    startUrl: checkout,
    scenario: "checkout",
    frames: [
      state("review-expanded-before-new-payment", [
        visible("heading", "Review & Pay"),
        ...expandDelivery,
        ...expandPayment,
      ]),
      state(
        "review-payment-method-editor-empty",
        [
          click("button", /Pay another way/),
          visible("dialog", "Payment methods"),
        ],
        { overlay: "dialog" },
      ),
      state(
        "review-payment-complete-billing-expanded",
        [
          fill("Card number", "4242424242424242"),
          fill("Expiration", "12/30"),
          fill("Security code", "123"),
          click("button", /^Bill to/),
          scrollSheet(".source-payment-sheet", 0),
        ],
        { overlay: "dialog", notes: redactedCardNote },
      ),
      state(
        "review-payment-billing-and-save",
        [scrollSheet(".source-payment-sheet", 60)],
        { overlay: "dialog", notes: redactedCardNote },
      ),
      state(
        "review-captured-second-payment-selected",
        [
          { ...click("button", "Save"), withinDialog: true },
          visible("button", "Preview captured post-save state"),
          click("button", "Preview captured post-save state"),
          visible("button", /Pay another way/),
          anchor(".checkout-section:nth-child(3)", 64),
        ],
        {
          notes:
            "A public synthetic form reaches the explicit unconnected-service boundary. The following local state uses a masked captured card, not the entered card number or a real saved payment method.",
        },
      ),
    ],
  },
  30: {
    family: "checkout-summary",
    owner,
    startUrl: checkout,
    scenario: "checkout",
    frames: [
      state("checkout-total-collapsed", [
        visible("heading", "Review & Pay"),
        recommendations,
      ]),
      state("checkout-order-summary-expanded", [
        click("button", /^Total/),
        anchor(".source-order-summary", 178),
      ]),
    ],
  },
  31: {
    family: "checkout-captured-receipt",
    owner: "apps/web/src/features/commerce/orders.tsx",
    startUrl: "/orders/REF-1001/confirmation",
    scenario: "checkout",
    frames: [
      state(
        "captured-confirmed-order-before-receipt",
        [visible("heading", "Order confirmed"), top],
        {
          notes:
            "A named captured-order fixture establishes this entry; no payment or new order is implied.",
        },
      ),
      state("captured-receipt-top", [
        click("link", "View order receipt"),
        visible("heading", "Receipt"),
        top,
      ]),
      state("captured-receipt-address-and-seller", [
        {
          type: "anchor",
          role: "heading",
          name: "Shipping address",
          exact: true,
          y: 136,
        },
      ]),
    ],
  },
};
