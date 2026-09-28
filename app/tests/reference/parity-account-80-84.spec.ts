import { expect, test, type Page } from "@playwright/test";

async function prepareProfile(page: Page) {
  await page.goto("/profile");
  await page
    .getByRole("link", { name: /alexsmith\.mobbin\+3@gmail\.com/ })
    .click();
  await page.getByRole("button", { name: "First name", exact: true }).click();
  await page.getByRole("textbox", { name: "First name" }).fill("Alex");
  await page.getByRole("textbox", { name: "Last name" }).fill("Smith");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Payment methods", exact: true }),
  ).toBeVisible();
}

async function expectContained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("flow 80 adds a source-shaped local card and returns to profile", async ({
  page,
}) => {
  await prepareProfile(page);
  await expect(page.locator(".payment-card-button")).toHaveCount(1);
  await page.getByRole("link", { name: "Add card", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add card" })).toBeVisible();
  const number = page.getByRole("textbox", { name: "Card number" });
  await number.fill("8689");
  await number.blur();
  await expect(page.locator(".card-error")).toContainText(
    "Check your card number",
  );

  await number.fill("4242424242428689");
  await page.getByRole("textbox", { name: "Expiry" }).fill("12/30");
  await page.getByRole("textbox", { name: "CVC" }).fill("123");
  await page.getByPlaceholder("Name on card").fill("Sam Lee");
  await expect(
    page.getByRole("heading", { name: "Billing address", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save card", exact: true }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator(".payment-card-button")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Payment methods", exact: true }),
  ).toBeVisible();
  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expectContained(page);
  }
});

test("flows 81-82 keep card detail and delete confirmation in one history path", async ({
  page,
}) => {
  await prepareProfile(page);
  await page.locator(".payment-card-button").first().click();
  await expect(page.getByRole("heading", { name: /Visa.*4263/ })).toBeVisible();
  const receipts = page.getByRole("switch", { name: /In-store receipts/ });
  await expect(receipts).toBeChecked();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("dialog", {
    name: "Are you sure you want to delete this card?",
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirm).not.toBeVisible();
  await expect(receipts).toBeVisible();
  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expectContained(page);
  }
  await page.setViewportSize({ width: 393, height: 793 });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator(".payment-card-button")).toHaveCount(0);
});

test("flows 83-84 preserve address list, detail, confirmation and deletion", async ({
  page,
}) => {
  await prepareProfile(page);
  await page.getByRole("link", { name: "Addresses", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Manage addresses", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("75 Ayer Rajah Crescent")).toBeVisible();
  await page.getByRole("button", { name: /Sam Lee/ }).click();
  await expect(
    page.getByRole("heading", { name: "Shipping address", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete address" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete address" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(confirm).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Manage addresses", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("75 Ayer Rajah Crescent")).toHaveCount(0);

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expectContained(page);
  }
});
