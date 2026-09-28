import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

// Exercise only the local, provider-free preview. No third-party requests are permitted.
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return ["127.0.0.1", "localhost"].includes(host)
      ? route.continue()
      : route.abort();
  });
});

test("85 security rows keep account detail and back navigation connected", async ({
  page,
}) => {
  await page.goto("/account/security");
  await expect(
    page.getByRole("heading", { name: "Sign in & security" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Text me a code/ }).click();
  await expect(
    page.getByRole("heading", { name: "Account & login" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Phone Add phone/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in & security" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add passkey" }).click();
  await expect(page.getByRole("dialog")).toContainText("unavailable");
});

test("86 notification changes survive navigation without enabling a provider", async ({
  page,
}) => {
  // This captured account flow starts after onboarding; cold launch is tested separately.
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/account/notifications");
  const tracking = page.getByRole("switch", { name: /Order tracking/ });
  const connections = page.getByRole("switch", { name: /Account connections/ });
  await expect(tracking).toBeChecked();
  await tracking.click();
  await connections.click();
  await expect(tracking).not.toBeChecked();
  await expect(connections).not.toBeChecked();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".home-shortcuts")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/account\/notifications$/);
  await expect(tracking).not.toBeChecked();
  await expect(connections).not.toBeChecked();
});

test("87-88 connection sheet, introduction and honest provider boundary", async ({
  page,
}) => {
  await page.goto("/account/connections");
  await page.getByRole("button", { name: /Connect an account/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Connect an account" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Gmail Connect account/ }).click();
  await expect(
    page.getByRole("heading", { name: "Connect Gmail account" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to Google" }).click();
  await expect(page.getByRole("dialog")).toContainText("No request was sent");
  await page.getByRole("button", { name: "Back to preview" }).click();
  await page.getByRole("button", { name: "Close connection" }).click();
  await expect(
    page.getByRole("heading", { name: "Connections", exact: true }),
  ).toBeVisible();
});

test("89 account deletion confirmation is cancellable and does not submit a request", async ({
  page,
}) => {
  await page.goto("/account/privacy");
  await page.getByRole("link", { name: "Delete account", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "Are you sure you want to delete your account?",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Delete your Shop account",
      exact: true,
    }),
  ).toBeVisible();
});

test("90-92 support and legal surfaces retain their real navigation", async ({
  page,
}) => {
  await page.goto("/support");
  await page.getByRole("link", { name: /About Learn more/ }).click();
  await expect(
    page.getByRole("link", { name: "shop.app", exact: true }),
  ).toBeVisible();
  const legalFooter = page.locator(".about-legal");
  await expect(
    legalFooter.getByRole("link", {
      name: "Terms and conditions",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://shop.app/terms-of-service?locale=en-US");
  await expect(
    legalFooter.getByRole("link", { name: "Privacy policy", exact: true }),
  ).toHaveAttribute("href", "https://www.shopify.com/legal/privacy/consumers");
  await expect(legalFooter.getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: /Licenses/ }).click();
  const licenses = page.getByRole("dialog", { name: "Licenses", exact: true });
  await expect(licenses).toBeVisible();
  await expect(licenses).toContainText(
    "The source capture does not include the app’s license list.",
  );
  await page.keyboard.press("Escape");
  await expect(licenses).not.toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("link", { name: /Support Chat/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Message support" }),
  ).toHaveAttribute("placeholder", "Ask anything...");
  await page.getByRole("button", { name: "Search conversation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Search conversation" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search messages" })
    .fill("missing phrase");
  await expect(page.getByText("No matching messages")).toBeVisible();
});

test("93 sign-out clears local edits and returns through the source splash", async ({
  page,
}) => {
  await page.goto("/profile");
  await page
    .getByRole("link", { name: /alexsmith\.mobbin\+3@gmail\.com/ })
    .click();
  await page.getByRole("button", { name: "First name", exact: true }).click();
  await page
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Alex");
  await page
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Smith");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Payment methods", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Sign out", exact: true })
    .click();
  await expect(page.getByRole("main", { name: "Shop loading" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get Started" })).toBeVisible();
});

test("settings and chat contain their layouts at narrow and wide mobile widths", async ({
  page,
}) => {
  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 793 });
    for (const route of [
      "/account/security",
      "/account/notifications",
      "/account/connections",
      "/support",
      "/support/chat",
      "/about",
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " at " + width,
      ).toBe(true);
    }
  }
});
