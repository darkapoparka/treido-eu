const click = (role, name) => ({ type: "click", role, name, exact: true });
const heading = (name) => ({
  type: "waitVisible",
  role: "heading",
  name,
  exact: true,
});
const top = { type: "scroll", y: 0 };
const full = { type: "viewport", width: 393, height: 793 };
const keyboard = { type: "viewport", width: 393, height: 487 };
const providerChrome = [
  { x: 0, y: 0, width: 393, height: 80 },
  { x: 0, y: 704, width: 393, height: 89 },
];
const providerKeyboard = [
  { x: 0, y: 0, width: 393, height: 80 },
  { x: 0, y: 428, width: 393, height: 365 },
];
const codeUrl = "/login?screen=email-code&reference=captured&journey=new";
const entry = (startUrl, scenario = "onboarding-new") => ({
  startUrl,
  scenario,
});
const providerNote =
  "Only the captured native provider browser bars, keyboard and input accessory are excluded. Sign-in is a local captured example; no authentication provider is contacted.";
const discontinuity =
  "The ordered source export jumps between onboarding, authentication and Home. This explicit entry preserves its order without inventing an unrecorded transition.";

export const onboardingRecipes = {
  1: {
    family: "onboarding-new",
    owner: "apps/web/src/features/account/support.tsx",
    startUrl: "/onboarding?step=splash&journey=new&reference=captured",
    scenario: "onboarding-new",
    frames: [
      {
        state: "shop-purple-splash",
        actions: [{ type: "waitVisible", selector: ".shop-splash.purple" }],
      },
      {
        state: "shop-get-started",
        actions: [
          {
            type: "waitVisible",
            role: "link",
            name: "Get Started",
            exact: true,
          },
          top,
        ],
      },
      {
        state: "discover-next-brand",
        actions: [
          click("link", "Get Started"),
          heading("Discover your next favorite brand"),
          top,
        ],
      },
      {
        state: "email-sign-in-empty",
        actions: [
          click("link", "Continue to sign in"),
          heading("Sign in to Shop"),
          keyboard,
        ],
        masks: providerKeyboard,
        notes: providerNote,
        entry: entry(
          "/onboarding?step=discover&journey=new&reference=captured",
        ),
      },
      {
        state: "email-sign-in-filled",
        actions: [
          {
            type: "fill",
            role: "textbox",
            name: "Email",
            value: "alexsmith.mobbin+3@gmail.com",
          },
        ],
        masks: providerKeyboard,
        notes: providerNote,
      },
      {
        state: "email-code-empty",
        actions: [
          full,
          click("button", "Continue"),
          heading("Verify your email"),
          top,
        ],
        masks: providerChrome,
        notes: providerNote,
      },
      {
        state: "email-code-pending",
        actions: [
          {
            type: "fill",
            role: "textbox",
            name: "Verification code",
            value: "530547",
          },
          { type: "waitUrl", url: "**phase=pending" },
        ],
        masks: providerChrome,
        notes: providerNote,
      },
      {
        state: "captured-home-after-sign-in",
        actions: [
          { type: "waitVisible", role: "link", name: "Profile", exact: true },
          top,
        ],
        entry: entry("/", "home-welcome"),
        notes: discontinuity,
      },
      {
        state: "shopping-preferences-empty",
        actions: [heading("What are you shopping for?"), top],
        entry: entry(
          "/onboarding?step=preferences&reference=captured&journey=new",
        ),
        notes: discontinuity,
      },
      {
        state: "email-code-verified",
        actions: [heading("Verify your email")],
        entry: entry(`${codeUrl}&phase=verified`),
        masks: providerChrome,
        notes: `${discontinuity} ${providerNote}`,
      },
      {
        state: "tracking-introduction",
        actions: [heading("Track all of your orders in one place"), top],
        entry: entry(
          "/onboarding?step=tracking&reference=captured&journey=new",
        ),
        notes: discontinuity,
      },
      {
        state: "captured-signing-in",
        actions: [heading("Signing you in...")],
        entry: entry("/login?screen=signing-in&reference=captured&journey=new"),
        masks: providerChrome,
        notes: `${discontinuity} ${providerNote}`,
      },
      {
        state: "everything-preference-selected",
        actions: [
          heading("What are you shopping for?"),
          click("button", "Everything"),
          top,
        ],
        entry: entry(
          "/onboarding?step=preferences&reference=captured&journey=new",
        ),
        notes: discontinuity,
      },
      {
        state: "home-feed-loading",
        entry: entry("/onboarding?step=updates&reference=captured&journey=new"),
        actions: [
          heading("Follow your order every step of the way"),
          { type: "delayCatalog", url: "/", ms: 8000 },
          click("button", "Skip"),
          { type: "waitCatalogDelayed" },
          {
            type: "waitVisible",
            role: "main",
            name: "Loading home",
            exact: true,
          },
        ],
        captureGuard: { role: "main", name: "Loading home", exact: true },
        afterCapture: [
          {
            type: "waitVisible",
            role: "link",
            name: "Profile",
            exact: true,
            timeoutMs: 12000,
          },
        ],
        notes:
          "The ordered export jumps from shopping preferences into Home loading and back to tracking setup. This explicit tracking entry uses its real Skip navigation. Only that local RSC catalog read receives bounded latency; the existing Home Suspense fallback is captured and real Home continuation is required afterward. No response or UI is substituted.",
      },
      {
        state: "tracking-updates-introduction",
        actions: [heading("Follow your order every step of the way"), top],
        entry: entry("/onboarding?step=updates&reference=captured&journey=new"),
        notes: discontinuity,
      },
    ],
  },
  95: {
    family: "order-widgets",
    owner: "apps/web/src/features/discovery/widgets.tsx",
    startUrl: "/widgets",
    scenario: "order-widgets",
    frames: [
      {
        state: "large-medium-small-order-widgets",
        actions: [{ type: "waitVisible", selector: ".widget-large" }, top],
        notes:
          "The source's three widget sizes are rendered as functional web preview cards. Installing native home-screen widgets remains a named platform exception.",
      },
    ],
  },
};
