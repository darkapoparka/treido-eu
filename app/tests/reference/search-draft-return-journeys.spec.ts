import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test.beforeEach(async ({ page }) => {
  await useReferenceScenario(page, "home-welcome");
});

test("merchant suggestion return retains the Search editor, while Cancel and submit retire it", async ({
  page,
}) => {
  await page.goto("/search");
  const input = page.getByRole("textbox", {
    name: "Search products",
    exact: true,
  });
  const merchant = page.locator(
    '.suggestion-store[href="/stores/jeans-warehouse"]',
  );
  await input.fill("Jeans");
  await merchant.click();
  await expect(page).toHaveURL(/\/stores\/jeans-warehouse$/);
  for (let visit = 0; visit < 2; visit += 1) {
    await page.goBack();
    await expect(input).toHaveValue("Jeans");
    await expect(page.locator(".search-suggestions-surface")).toBeVisible();
    await expect(merchant).toBeFocused();
    if (visit === 0) {
      await page.goForward();
      await expect(page).toHaveURL(/\/stores\/jeans-warehouse$/);
    }
  }
  await page
    .getByRole("button", { name: "Close suggestions", exact: true })
    .click();
  await expect(input).toBeEmpty();
  await expect(
    page.getByRole("search", { name: "Search products", exact: true }),
  ).toBeFocused();
  await input.fill("discard this draft");
  await input.press("Escape");
  await expect(input).toBeEmpty();
  await expect(
    page.getByRole("search", { name: "Search products", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".search-suggestions-surface")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Explore", exact: true })
    .click();
  await expect(page).toHaveURL(/\/explore$/);
  await page.goBack();
  await expect(input).toBeEmpty();
  await expect(page.locator(".search-suggestions-surface")).toHaveCount(0);
  await input.fill("Jeans");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Jeans$/);
  await expect(page.locator(".search-suggestions-surface")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/search$/);
  await expect(input).toBeEmpty();
  await expect(page.locator(".search-suggestions-surface")).toHaveCount(0);
  await page.goForward();
  await expect(input).toHaveValue("Jeans");
  await expect(page.locator(".search-suggestions-surface")).toHaveCount(0);
});

test("unsubmitted StoreSearch survives product Back and Forward and Clear keeps an empty editor", async ({
  page,
}) => {
  await page.goto("/stores/kitsch/search");
  const input = page.getByRole("textbox", {
    name: "Search KITSCH",
    exact: true,
  });
  const product = page.locator(
    '.store-search-suggestions a[href="/products/rice-shampoo"]',
  );
  await input.fill("shampoo");
  await product.click();
  await expect(page).toHaveURL(/\/products\/rice-shampoo$/);
  for (let visit = 0; visit < 2; visit += 1) {
    await page.goBack();
    await expect(input).toHaveValue("shampoo");
    await expect(page.locator(".store-search-suggestions a")).toHaveCount(3);
    await expect(product).toBeFocused();
    if (visit === 0) {
      await page.goForward();
      await expect(page).toHaveURL(/\/products\/rice-shampoo$/);
    }
  }
  const clear = page.getByRole("button", { name: "Clear search", exact: true });
  await clear.focus();
  await clear.press("Enter");
  await expect(input).toBeEmpty();
  await expect(input).toBeFocused();
  await page.locator(".store-search-categories a").first().click();
  await expect(page).not.toHaveURL(/\/stores\/kitsch\/search$/);
  await page.goBack();
  await expect(input).toBeEmpty();
  await expect(page.locator("main.store-search-editing")).toBeVisible();
  await expect(page.locator(".store-search-suggestions")).toHaveCount(0);
});

test("StoreSearch keeps an edited committed query through product history without reviving it after Cancel or submit", async ({
  page,
}) => {
  await page.goto("/stores/kitsch/search?q=shampoo");
  const input = page.getByRole("textbox", {
    name: "Search KITSCH",
    exact: true,
  });
  const product = page.locator(
    '.store-search-suggestions a[href="/products/rice-liquid"]',
  );
  await input.fill("rice");
  await product.click();
  await expect(page).toHaveURL(/\/products\/rice-liquid$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/stores\/kitsch\/search\?q=shampoo$/);
  await expect(input).toHaveValue("rice");
  await expect(product).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/products\/rice-liquid$/);
  await page.goBack();
  await expect(input).toHaveValue("rice");
  await expect(product).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(input).toHaveValue("shampoo");
  await expect(
    page.getByRole("search", { name: "Search KITSCH", exact: true }),
  ).toBeFocused();
  await input.fill("discard this draft");
  await input.press("Escape");
  await expect(input).toHaveValue("shampoo");
  await expect(
    page.getByRole("search", { name: "Search KITSCH", exact: true }),
  ).toBeFocused();
  await expect(page.locator("main.store-search-results")).toBeVisible();
  const result = page.locator(
    '.product-grid .product-media > a[href="/products/rice-shampoo"]',
  );
  await result.click();
  await expect(page).toHaveURL(/\/products\/rice-shampoo$/);
  await page.goBack();
  await expect(input).toHaveValue("shampoo");
  await expect(page.locator("main.store-search-results")).toBeVisible();
  await input.fill("rice");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/stores\/kitsch\/search\?q=rice$/);
  await expect(page.locator("main.store-search-results")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/stores\/kitsch\/search\?q=shampoo$/);
  await expect(input).toHaveValue("shampoo");
  await expect(page.locator("main.store-search-results")).toBeVisible();
  await page.goForward();
  await expect(input).toHaveValue("rice");
  await expect(page.locator("main.store-search-results")).toBeVisible();
});
