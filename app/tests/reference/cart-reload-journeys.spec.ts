import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

async function ready(page: Page) {
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
}

test("Buy now retains the exact product, quantity and checkout amount after reload", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/shampoo-bag");
  await ready(page);
  await page
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await page.getByRole("button", { name: "Buy now", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Pay now \$14\.47/ }),
  ).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(page).toHaveURL(/\/checkout\?store=kitsch$/);
  await expect(
    page.getByRole("button", { name: /Pay now \$14\.47/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Total/ }).click();
  await expect(page.locator(".source-summary-item")).toContainText(
    "Shampoo Bar Bag",
  );
  await expect(page.locator(".source-summary-item")).toContainText(
    "Quantity 2",
  );
  await expect(page.locator(".source-summary-item > strong")).toContainText(
    "$7.30",
  );
});

test("cart quantity, save for later, move and final removal survive reload without duplicate lines", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-bag");
  await page.goto("/cart");
  await ready(page);
  await page
    .getByRole("button", { name: "Increase Shampoo Bar Bag", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  await page.reload();
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Your cart is empty", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cart-later article")).toHaveCount(1);
  await page.getByRole("button", { name: "Move to cart", exact: true }).click();
  await page.reload();
  await ready(page);
  await expect(page.locator(".commerce-line")).toHaveCount(1);
  await expect(page.locator(".cart-stepper output")).toHaveText("2");
  await expect(page.locator(".cart-subtotal")).toContainText("$7.30");
  await page
    .getByRole("button", { name: "Decrease Shampoo Bar Bag", exact: true })
    .click();
  await expect(page.locator(".cart-stepper output")).toHaveText("1");
  await page
    .getByRole("button", { name: "Remove Shampoo Bar Bag", exact: true })
    .click();
  await page.reload();
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Your cart is empty", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".commerce-line")).toHaveCount(0);
});

test("scenario changes isolate cart edits and returning to that scenario restores them", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-bag");
  await page.goto("/cart");
  await ready(page);
  await page
    .getByRole("button", { name: "Increase Shampoo Bar Bag", exact: true })
    .click();
  await useReferenceScenario(page, "home-welcome");
  await page.reload();
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Your cart is empty", exact: true }),
  ).toBeVisible();
  await useReferenceScenario(page, "cart-bag");
  await page.reload();
  await ready(page);
  await expect(page.locator(".cart-stepper output")).toHaveText("2");
});

test("unavailable browser storage still permits ordinary in-tab cart and checkout actions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key: string) {
      if (key.startsWith("treido:reference:cart:"))
        throw new DOMException("Storage denied", "SecurityError");
      return originalGet.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("treido:reference:cart:"))
        throw new DOMException("Storage denied", "SecurityError");
      return originalSet.call(this, key, value);
    };
  });
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/shampoo-bag");
  await ready(page);
  await page.getByRole("button", { name: "Buy now", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Pay now \$10\.82/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Close checkout", exact: true }).click();
  await expect(page.locator(".commerce-line")).toHaveCount(1);
});
