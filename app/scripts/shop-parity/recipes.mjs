const paymentTop = {
  type: "anchor",
  role: "heading",
  name: "Payment methods",
  y: 27,
};

const prepareProfile = [
  { type: "click", role: "link", name: /alexsmith\.mobbin\+3@gmail\.com/ },
  { type: "waitUrl", url: "**/account" },
  { type: "waitVisible", role: "button", name: "First name", exact: true },
  { type: "click", role: "button", name: "First name", exact: true },
  { type: "waitVisible", role: "textbox", name: "First name", exact: true },
  { type: "fill", role: "textbox", name: "First name", value: "Alex" },
  { type: "fill", role: "textbox", name: "Last name", value: "Smith" },
  { type: "click", role: "button", name: "Save", exact: true },
  { type: "waitVisible", role: "button", name: "Alex", exact: true },
  { type: "click", role: "button", name: "Go back", exact: true },
  { type: "waitUrl", url: "**/profile" },
  {
    type: "waitVisible",
    role: "heading",
    name: "Payment methods",
    exact: true,
  },
  paymentTop,
];

export const flowRecipes = {
  80: {
    family: "account-payments",
    startUrl: "/profile",
    frames: [
      { state: "profile-payment-methods", actions: prepareProfile },
      {
        state: "add-card-empty",
        actions: [
          { type: "click", role: "link", name: "Add card", exact: true },
          {
            type: "waitVisible",
            role: "heading",
            name: "Add card",
            exact: true,
          },
          { type: "scroll", y: 0 },
        ],
      },
      {
        state: "add-card-number-valid",
        actions: [
          {
            type: "fill",
            role: "textbox",
            name: "Card number",
            value: "4242424242424263",
          },
        ],
      },
      {
        state: "add-card-number-error",
        actions: [
          { type: "fill", role: "textbox", name: "Card number", value: "8689" },
          { type: "fill", role: "textbox", name: "Expiry", value: "02/13" },
          { type: "fill", role: "textbox", name: "CVC", value: "123" },
          { type: "blur", role: "textbox", name: "Card number" },
        ],
      },
      {
        state: "add-card-details-complete",
        actions: [
          {
            type: "fill",
            role: "textbox",
            name: "Card number",
            value: "4242424242424263",
          },
          { type: "fill", role: "textbox", name: "Expiry", value: "12/30" },
          { type: "fill", role: "textbox", name: "CVC", value: "123" },
        ],
      },
      {
        state: "add-card-name-and-billing",
        actions: [
          {
            type: "fill",
            role: "textbox",
            name: "Name on card",
            value: "Sam Lee",
          },
          { type: "blur", role: "textbox", name: "Name on card" },
          { type: "scroll", y: 0 },
        ],
      },
      {
        state: "add-card-save-visible",
        actions: [
          { type: "blur", role: "textbox", name: "Name on card" },
          { type: "scroll", y: 230 },
        ],
      },
      {
        state: "profile-two-cards",
        actions: [
          { type: "click", role: "button", name: "Save card", exact: true },
          paymentTop,
        ],
      },
    ],
  },
  81: {
    family: "account-payments",
    startUrl: "/profile",
    frames: [
      { state: "profile-payment-methods", actions: prepareProfile },
      {
        state: "card-detail",
        actions: [
          { type: "clickSelector", selector: ".payment-card-button" },
          {
            type: "waitVisible",
            role: "heading",
            name: "Card details",
            exact: true,
          },
          { type: "scroll", y: 0 },
        ],
      },
    ],
  },
  82: {
    family: "account-payments",
    startUrl: "/profile",
    frames: [
      {
        state: "card-detail",
        actions: [
          ...prepareProfile,
          { type: "clickSelector", selector: ".payment-card-button" },
          {
            type: "waitVisible",
            role: "heading",
            name: "Card details",
            exact: true,
          },
          { type: "scroll", y: 0 },
        ],
      },
      {
        state: "delete-card-confirm",
        overlay: "dialog",
        actions: [
          { type: "click", role: "button", name: "Delete", exact: true },
        ],
      },
      {
        state: "profile-payment-methods-after-delete-dialog",
        actions: [
          {
            type: "click",
            role: "button",
            name: "Cancel",
            exact: true,
            withinDialog: true,
          },
          { type: "click", role: "button", name: "Go back", exact: true },
          paymentTop,
        ],
      },
    ],
  },
  83: {
    family: "account-addresses",
    startUrl: "/profile",
    frames: [
      { state: "profile-payment-methods", actions: prepareProfile },
      {
        state: "manage-addresses",
        actions: [
          { type: "click", role: "link", name: "Addresses", exact: true },
          {
            type: "waitVisible",
            role: "heading",
            name: "Manage addresses",
            exact: true,
          },
          { type: "scroll", y: 0 },
        ],
      },
    ],
  },
  84: {
    family: "account-addresses",
    startUrl: "/account/addresses",
    frames: [
      { state: "manage-addresses", actions: [{ type: "scroll", y: 0 }] },
      {
        state: "shipping-address-sam",
        actions: [
          { type: "click", role: "button", name: /Sam Lee/ },
          { type: "scroll", y: 0 },
        ],
      },
      {
        state: "delete-address-confirm",
        overlay: "dialog",
        actions: [{ type: "click", role: "button", name: "Delete address" }],
      },
      {
        state: "manage-addresses-after-delete",
        actions: [
          {
            type: "click",
            role: "button",
            name: "Delete",
            exact: true,
            withinDialog: true,
          },
          { type: "scroll", y: 0 },
        ],
      },
    ],
  },
};

const click = (role, name) => ({
  type: "click",
  role,
  name,
  exact: typeof name === "string",
});
const heading = (name) => ({
  type: "waitVisible",
  role: "heading",
  name,
  exact: true,
});
const top = { type: "scroll", y: 0 };
const supportChatGuard = { selector: ".support-chat-page" };
const profileFrame = () => ({
  state: "profile-payment-methods",
  actions: prepareProfile,
});
const settingsLink = (label, title = label) => [
  click("link", label),
  heading(title),
  top,
];
Object.assign(flowRecipes, {
  85: {
    family: "account-settings",
    startUrl: "/profile",
    frames: [
      profileFrame(),
      {
        state: "account-and-login",
        notes:
          "The source skips the transition between the two settings variants; replay enters the existing account detail from security.",
        actions: [
          ...settingsLink("Sign in & security"),
          click("button", /Text me a code/),
          heading("Account & login"),
        ],
      },
      {
        state: "sign-in-security",
        actions: [click("button", "Go back"), heading("Sign in & security")],
      },
    ],
  },
  86: {
    family: "account-settings",
    startUrl: "/profile",
    frames: [
      profileFrame(),
      {
        state: "notification-preferences-on",
        actions: settingsLink("Notifications"),
      },
      {
        state: "notification-tracking-connections-off",
        actions: [
          click("switch", /Order tracking/),
          click("switch", /Account connections/),
          top,
        ],
      },
    ],
  },
  87: {
    family: "account-settings",
    startUrl: "/profile",
    frames: [
      profileFrame(),
      { state: "connections", actions: settingsLink("Connections") },
    ],
  },
  88: {
    family: "account-settings",
    startUrl: "/account/connections",
    frames: [
      { state: "connections", actions: [heading("Connections")] },
      {
        state: "choose-connection-provider",
        overlay: "dialog",
        actions: [click("button", /Connect an account/)],
      },
      {
        state: "gmail-connection-introduction",
        actions: [
          click("button", /Gmail Connect account/),
          heading("Connect Gmail account"),
          top,
        ],
      },
    ],
  },
  89: {
    family: "account-privacy",
    startUrl: "/profile",
    frames: [
      profileFrame(),
      { state: "privacy-options", actions: settingsLink("Data & privacy") },
      {
        state: "delete-account-information",
        actions: settingsLink("Delete account", "Delete your Shop account"),
      },
      {
        state: "delete-account-confirmation",
        overlay: "dialog",
        actions: [click("button", "Delete account")],
      },
      {
        state: "delete-account-verification",
        actions: [
          { ...click("button", "Delete account"), withinDialog: true },
          heading("Enter the verification code sent to your email"),
        ],
      },
      {
        state: "delete-account-captured-processing",
        notes:
          "Explicit provider-outcome preview: no code was sent and no deletion request is submitted.",
        actions: [
          {
            type: "fill",
            role: "textbox",
            name: "Deletion verification code",
            value: "123456",
          },
          click("button", "View captured deletion example"),
          {
            type: "waitVisible",
            role: "status",
            name: "Captured deletion processing",
          },
        ],
      },
      {
        state: "delete-account-captured-received",
        notes:
          "Captured provider outcome reached only through explicit preview selection, not real account deletion.",
        actions: [heading("Your deletion request has been received")],
      },
    ],
  },
  90: {
    family: "account-support",
    startUrl: "/profile",
    frames: [
      profileFrame(),
      { state: "support-options", actions: settingsLink("Support") },
    ],
  },
  91: {
    family: "account-support",
    startUrl: "/support",
    frames: [
      { state: "support-options", actions: [heading("Support")] },
      {
        state: "support-chat-empty",
        actions: [
          click("link", /Support Chat/),
          { type: "waitUrl", url: "**/support/chat" },
          { type: "waitVisible", selector: ".support-chat-page" },
          heading("Support"),
          top,
        ],
        captureGuard: supportChatGuard,
      },
      {
        state: "support-chat-draft",
        actions: [
          {
            type: "fill",
            role: "textbox",
            name: "Message support",
            value: "Is it possible to cancel an order and request a refund?",
          },
        ],
        captureGuard: supportChatGuard,
      },
      {
        state: "support-chat-captured-reply-pending",
        actions: [
          click("button", "Send message"),
          {
            type: "waitVisible",
            role: "status",
            name: "Preparing captured reply",
          },
        ],
        captureGuard: supportChatGuard,
      },
      {
        state: "support-chat-captured-answer",
        actions: [{ type: "waitVisible", role: "link", name: /Go to orders/ }],
        captureGuard: supportChatGuard,
      },
    ],
  },
  92: {
    family: "account-support",
    startUrl: "/support",
    frames: [
      { state: "support-options", actions: [heading("Support")] },
      {
        state: "about-shop",
        actions: [
          click("link", /About Learn more/),
          { type: "waitVisible", role: "link", name: "shop.app", exact: true },
          top,
        ],
      },
    ],
  },
  93: {
    family: "account-support",
    startUrl: "/profile",
    frames: [
      {
        state: "profile-sign-out-footer",
        actions: [...prepareProfile, { type: "scroll", y: 100000 }],
      },
      {
        state: "sign-out-confirmation",
        overlay: "dialog",
        actions: [click("button", "Sign out")],
      },
      {
        state: "signed-out-splash",
        actions: [
          { ...click("link", "Sign out"), withinDialog: true },
          { type: "waitVisible", role: "main", name: "Shop loading" },
        ],
      },
      {
        state: "signed-out-introduction",
        actions: [{ type: "waitVisible", role: "link", name: "Get Started" }],
      },
    ],
  },
});

// Returning-login source replay is explicitly isolated from real authentication.
const nativeProviderChrome = [
  { x: 0, y: 0, width: 393, height: 80, reason: "Native web-view header" },
  { x: 0, y: 704, width: 393, height: 89, reason: "Native browser toolbar" },
];
flowRecipes[94] = {
  family: "account-authentication",
  startUrl: "/onboarding?reference=captured",
  frames: [
    {
      state: "returning-introduction",
      actions: [{ type: "waitVisible", role: "link", name: "Get Started" }],
    },
    {
      state: "track-recent-order",
      actions: [
        click("link", "Get Started"),
        heading("Let’s track your recent order"),
        top,
      ],
    },
    {
      state: "phone-code-empty",
      masks: nativeProviderChrome,
      actions: [
        click("button", "Track my order"),
        heading("Confirm it’s you"),
        top,
      ],
    },
    {
      state: "captured-code-pending",
      masks: nativeProviderChrome,
      notes:
        "Captured test scenario only; no code is sent or verified by a provider.",
      actions: [
        {
          type: "fill",
          role: "textbox",
          name: "Verification code",
          value: "840125",
        },
        { type: "waitUrl", url: "**phase=pending" },
      ],
    },
    {
      state: "captured-code-complete",
      masks: nativeProviderChrome,
      actions: [{ type: "waitUrl", url: "**phase=verified" }],
    },
    {
      state: "captured-passkey-introduction",
      masks: nativeProviderChrome,
      actions: [heading("Sign in faster with a passkey")],
    },
    {
      state: "captured-sign-in-animation",
      masks: nativeProviderChrome,
      actions: [heading("Signing you in...")],
    },
    {
      state: "returning-tracking-introduction",
      actions: [heading("Track all of your orders in one place"), top],
    },
    {
      state: "returning-home",
      actions: [
        click("button", "Skip"),
        { type: "waitVisible", role: "link", name: "Profile", exact: true },
        top,
      ],
    },
  ],
};

import { accountRecipes } from "./recipes-account.mjs";
import { homeRecipes } from "./recipes-home.mjs";
import { savedRecipes } from "./recipes-saved.mjs";
import { storeRecipes } from "./recipes-store.mjs";
import { productRecipes } from "./recipes-product.mjs";
import { reviewRecipes } from "./recipes-reviews.mjs";
import { searchRecipes } from "./recipes-search.mjs";
import { miniRecipes } from "./recipes-minis.mjs";
import { checkoutRecipes } from "./recipes-checkout.mjs";
import { onboardingRecipes } from "./recipes-onboarding.mjs";
import { orderRecipes } from "./recipes-orders.mjs";
Object.assign(
  flowRecipes,
  accountRecipes,
  homeRecipes,
  savedRecipes,
  storeRecipes,
  productRecipes,
  reviewRecipes,
  searchRecipes,
  miniRecipes,
  checkoutRecipes,
  onboardingRecipes,
  orderRecipes,
);
