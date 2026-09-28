import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
});

test("authentication does not turn an arbitrary code into a signed-in account", async ({
  page,
}) => {
  await page.goto("/login?screen=phone-code");
  await page.getByRole("textbox", { name: "Verification code" }).fill("123456");
  const boundary = page.getByRole("dialog", {
    name: "Authentication is not connected",
  });
  await expect(boundary).toContainText(
    "No code was sent and no account was signed in.",
  );
  await expect(
    page.getByRole("heading", { name: "Signing you in..." }),
  ).not.toBeVisible();
  await boundary
    .getByRole("button", { name: "Replay captured sign-in" })
    .click();
  await page.getByRole("textbox", { name: "Verification code" }).fill("840125");
  await expect(page.locator(".auth-phase-verified")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sign in faster with a passkey" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Signing you in..." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Track all of your orders in one place",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page).toHaveURL(/journey=returning/);
  await expect(
    page.getByRole("link", { name: "Profile", exact: true }),
  ).toBeVisible();
});

test("support preserves the captured conversation without claiming a live response", async ({
  page,
}) => {
  await page.goto("/support/chat");
  await page
    .getByRole("textbox", { name: "Message support" })
    .fill("Please contact the seller for me.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your message was not sent.",
  );
  await page
    .getByRole("button", { name: "View captured example conversation" })
    .click();
  await expect(
    page.getByRole("status", { name: "Preparing captured reply" }),
  ).toBeVisible();
  await expect(page.getByLabel("Captured example response")).toContainText(
    "contact the store directly",
  );
  await page.getByRole("button", { name: "Search conversation" }).click();
  await page
    .getByRole("textbox", { name: "Search messages" })
    .fill("Orders tab");
  await expect(
    page.getByRole("dialog", { name: "Search conversation" }),
  ).toContainText("Orders tab of the Shop app");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: /Go to orders/ }).click();
  await expect(page).toHaveURL(/\/orders$/);
});

test("captured deletion is an opt-in visual preview, not a submitted request", async ({
  page,
}) => {
  await page.goto("/account/delete?stage=code");
  await page
    .getByRole("textbox", { name: "Deletion verification code" })
    .fill("123456");
  await expect(page.getByRole("dialog")).toContainText(
    "no deletion request was submitted",
  );
  await page
    .getByRole("button", { name: "View captured deletion example" })
    .click();
  await expect(
    page.getByRole("status", { name: "Captured deletion processing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Your deletion request has been received",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Captured reference example. No deletion request was submitted.",
    ),
  ).toBeAttached();
  await page
    .getByRole("link", { name: "Close captured deletion example" })
    .click();
  await expect(page).toHaveURL(/\/account\/privacy$/);
});
