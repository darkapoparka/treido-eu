import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await context.addCookies([
    {
      name: "shop-preview-onboarded",
      value: "1",
      url: String(test.info().project.use.baseURL),
    },
  ]);
  await page.setViewportSize({ width: 427, height: 876 });
  await page.goto("/");
  await expect(page.locator(".android-home")).toBeVisible();
  await page
    .locator('[data-product-id="live-belle-11"] .product-media a')
    .click();
  await expect(
    page.getByRole("heading", {
      name: "BelleBox Limited Edition 11",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.locator('.floating-nav a[href="/search"]').click();
  await page.waitForURL((url) => url.pathname === "/search");
  await expect(page.locator(".android-search")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test("native Search matches measured shell and retains real recently viewed products", async ({
  page,
}) => {
  const rail = page.locator(".android-search > .product-rail");
  await expect(rail.locator('[data-recent-id="live-belle-11"]')).toBeVisible();
  const recent = await page.locator(".search-section-heading").boundingBox();
  const card = await rail.locator(".product-media").first().boundingBox();
  const composer = await page.getByRole("search").boundingBox();
  expect(recent?.y).toBeCloseTo(76, 0);
  expect(card?.y).toBeCloseTo(108, 0);
  expect(card?.width).toBe(124);
  expect(card?.height).toBe(124);
  expect(composer?.x).toBe(12);
  expect(composer?.y).toBe(740);
  expect(composer?.height).toBe(56);
  await expect(page.locator(".android-search")).toHaveCSS(
    "font-family",
    "ShopAndroidRoboto, Roboto, Arial, sans-serif",
  );
  await rail.getByRole("button", { name: /^Save / }).click();
  await expect(rail.getByRole("button", { name: /^Unsave / })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.getByRole("link", { name: "Close search", exact: true }).click();
  await expect(page.locator(".android-home")).toBeVisible();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(page.locator('[data-product-id="live-belle-11"]')).toBeVisible();
});

test("native suggestions keep the typed draft through a store excursion and cancel cleanly", async ({
  page,
}) => {
  const input = page.getByRole("textbox", { name: "Search products" });
  await input.fill("belle");
  const store = page
    .locator(".android-suggestion-store")
    .filter({ hasText: "belleboxbg" });
  await expect(store).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await store.click();
  await expect(page).toHaveURL(/stores\/live-belleboxbg$/);
  await page.goBack();
  await expect(input).toHaveValue("belle");
  await expect(store).toBeVisible();
  await page
    .getByRole("button", { name: "Close suggestions", exact: true })
    .click();
  await expect(input).toHaveValue("");
  await expect(page.locator(".android-search > .product-rail")).toBeVisible();
  await page.getByRole("button", { name: "Add photos", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Add photos", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add photos", exact: true }),
  ).toBeFocused();
});

for (const width of [320, 393, 427, 430]) {
  test(
    "native Search remains contained and keyboard-operable at " + width + "px",
    async ({ page }) => {
      await page.setViewportSize({ width, height: 568 });
      const search = page.getByRole("search");
      const bounds = await search.boundingBox();
      expect(bounds?.x).toBe(12);
      expect(bounds?.width).toBe(width - 24);
      await expect(
        page.getByRole("button", { name: "Add photos", exact: true }),
      ).toBeInViewport();
      await page
        .getByRole("textbox", { name: "Search products" })
        .fill("belle");
      await expect(page.locator(".android-suggestion-store")).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("textbox", { name: "Search products" }),
      ).toHaveValue("");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.screenshot({
        path: test.info().outputPath("search-" + width + ".png"),
      });
    },
  );
}
