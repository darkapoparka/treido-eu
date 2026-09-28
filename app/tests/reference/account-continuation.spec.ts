import { openBagCart, useReferenceScenario } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { capturedLineAmount } from "../../apps/web/src/features/commerce/pricing";
async function checkout(page: Page) {
  await openBagCart(page);
  await page.getByRole("link", { name: "Continue to checkout" }).click();
}
test("captured discount is limited to its exact product variant", () => {
  expect(
    capturedLineAmount(
      { productId: "shampoo-bag", variantId: "shampoo-bag-default" },
      500,
    ),
  ).toBe(365);
  expect(
    capturedLineAmount(
      { productId: "shampoo-bag", variantId: "another-variant" },
      500,
    ),
  ).toBe(500);
  expect(
    capturedLineAmount(
      { productId: "another-item", variantId: "shampoo-bag-default" },
      500,
    ),
  ).toBe(500);
});
test("cart later preserves quantity and captured subtotal without double discount", async ({
  page,
}) => {
  await openBagCart(page);
  await page.getByRole("button", { name: "Increase Shampoo Bar Bag" }).click();
  await expect(page.locator(".cart-subtotal")).toContainText("$7.30");
  await expect(page.locator(".cart-discount")).toContainText("-$2.70");
  await page
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your cart is empty" }),
  ).toBeVisible();
  await expect(page.locator(".cart-later")).toContainText("Shampoo Bar Bag");
  await page.getByRole("button", { name: "Move to cart", exact: true }).click();
  await expect(page.locator(".cart-later")).toHaveCount(0);
  await expect(page.locator(".cart-stepper output")).toHaveText("2");
  await expect(page.locator(".cart-subtotal")).toContainText("$7.30");
});
test("privacy confirmation reaches code and Back returns once to deletion page", async ({
  page,
}) => {
  await page.goto("/account/privacy");
  await page.getByRole("link", { name: "Delete account", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Are you sure you want to delete your account?",
  });
  await expect(confirm).toBeVisible();
  await confirm
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(page).toHaveURL(/stage=code/);
  await expect(
    page.getByRole("textbox", { name: "Deletion verification code" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/account\/delete$/);
  await expect(
    page.getByRole("button", { name: "Delete account", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/account\/privacy$/);
});
test("Gmail explanation precedes provider boundary and Outlook never shows Google identity", async ({
  page,
}) => {
  await page.goto("/account/connections");
  await page.getByRole("button", { name: /Connect an account/ }).click();
  await page.getByRole("button", { name: /Gmail Connect account/ }).click();
  await expect(
    page.getByRole("heading", { name: "Connect Gmail account" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Shop will scan your Gmail inbox for order information from your emails",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to Google" }).click();
  await expect(
    page.getByRole("dialog", { name: "Account connection unavailable" }),
  ).toBeVisible();
  await page.goto("/account/connections?provider=outlook");
  await expect(
    page.getByRole("dialog", { name: "Outlook connection unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue to Google" }),
  ).toHaveCount(0);
});
test("delivery activity supports full history, local status and tracking edit", async ({
  page,
}) => {
  await page.goto("/orders/REF-1001?view=tracking");
  await page.getByRole("button", { name: "View all activity" }).click();
  const activity = page.getByRole("dialog", { name: "Delivery progress" });
  await expect(
    activity.getByText("Departure from transport hub", { exact: true }).first(),
  ).toBeVisible();
  await page.goBack();
  await expect(activity).not.toBeVisible();
  await page
    .getByRole("button", { name: "Mark as delivered", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unmark as delivered", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Unmark as delivered", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit tracking details", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit tracking details" });
  await editor
    .getByRole("textbox", { name: "Package name" })
    .fill("Synthetic tracked parcel");
  await editor.getByRole("button", { name: "Update tracking details" }).click();
  await expect(editor).not.toBeVisible();
  await page
    .getByRole("button", { name: "Edit tracking details", exact: true })
    .click();
  await expect(
    editor.getByRole("textbox", { name: "Package name" }),
  ).toHaveValue("Synthetic tracked parcel");
  await page.goBack();
  await page
    .getByRole("button", { name: "Mark as delivered", exact: true })
    .click();
  await expect(page.getByText("Synthetic tracked parcel KITSCH")).toBeVisible();
});
test("White Rock pickup is separate from KITSCH and retains ready time and selected location", async ({
  page,
}) => {
  await page.goto("/checkout?store=white-rock");
  await expect(
    page.getByRole("tab", { name: "Ship", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Pickup", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "White Rock Soap Gallery" }),
  ).toBeChecked();
  await expect(page.getByText("Usually ready in 24 hours")).toBeVisible();
  await expect(page.locator(".pickup-total")).toContainText("$3.80");
  await page.getByRole("button", { name: /Pay now/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Payment unavailable" }),
  ).toBeVisible();
  await checkout(page);
  await expect(
    page.getByRole("tab", { name: "Pickup", exact: true }),
  ).toHaveCount(0);
});
test("initial checkout card validates numeric input and retains an independent billing address", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-bag");
  await page.goto("/checkout?store=kitsch&stage=phone");
  await page
    .getByRole("textbox", { name: "Phone number", exact: true })
    .fill("2025550100");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Security code", exact: true })
    .fill("123456");
  await expect(
    page.getByRole("dialog", { name: "Phone verification is not connected" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue to captured shipping address" })
    .click();
  await page
    .getByRole("textbox", { name: "Search address" })
    .fill("1226 University");
  await page.getByRole("button", { name: /1226 University Dr/ }).click();
  await page
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Alex");
  await page
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Smith");
  await page
    .getByRole("button", { name: "Continue to payment details", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Add a card", exact: true }),
  ).toBeVisible();
  const number = page.getByRole("textbox", {
    name: "Card number",
    exact: true,
  });
  await number.fill("abcdefghijkl");
  expect(
    await number.evaluate((e: HTMLInputElement) => e.checkValidity()),
  ).toBe(false);
  await number.fill("4242424242424242");
  await page.getByRole("textbox", { name: "Expiry (MM/YY)" }).fill("12/30");
  await page.getByRole("textbox", { name: "CVV", exact: true }).fill("123");
  await page
    .getByRole("textbox", { name: "Name on card" })
    .fill("Mira Example");
  await page
    .getByRole("checkbox", { name: /Billing address same as shipping/ })
    .uncheck();
  const billing = page.getByRole("dialog", {
    name: "Billing address",
    exact: true,
  });
  await billing
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Billing");
  await billing
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Example");
  await billing
    .getByRole("textbox", { name: "Address", exact: true })
    .fill("200 Billing Lane");
  await billing
    .getByRole("textbox", { name: "City", exact: true })
    .fill("Example City");
  await billing
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("CA");
  await billing
    .getByRole("textbox", { name: "ZIP code", exact: true })
    .fill("00000");
  await billing.getByRole("button", { name: "Save", exact: true }).click();
  await expect(billing).not.toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Billing address same as shipping/ }),
  ).not.toBeChecked();
  await expect(page.locator(".initial-billing-selection")).toContainText(
    "200 Billing Lane",
  );
  await expect(number).toHaveValue("4242424242424242");
  await page
    .getByRole("button", { name: "Continue to review", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Payment service is not connected" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your card has not been saved or charged."),
  ).toBeVisible();
});
