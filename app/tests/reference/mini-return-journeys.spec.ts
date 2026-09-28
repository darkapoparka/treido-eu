import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await useReferenceScenario(page, "home-welcome");
});

test("Explore Mini Close returns past outfit stages and a product excursion to its original entry", async ({
  page,
}) => {
  await page.goto("/explore");
  const entry = page.locator('.explore-minis a[href="/minis/look"]');
  await entry.scrollIntoViewIfNeeded();
  const sourceY = await page.evaluate(() => scrollY);
  await entry.click();
  await page
    .getByRole("button", {
      name: "Dismiss Get the Look terms notice",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Choose Photo", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Get the Look preview controls", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use reference outfit", exact: true })
    .click();
  await expect(page.locator('[data-look-phase="scanning"]')).toBeVisible();
  await page
    .getByRole("button", { name: "View captured matches", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Women’s Black Crew Neck T-shirt",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "View all matching pieces", exact: true })
    .click();
  const product = page.locator("#look-blazer .product-media > a").first();
  await product.click();
  await expect(page).toHaveURL(/\/products\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/minis\/look\?look=results&matches=shirt$/);
  await expect(product).toBeFocused();
  await page
    .getByRole("link", { name: "Close Get the Look", exact: true })
    .click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(entry).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(sourceY);
  await page.goForward();
  await expect(page).toHaveURL(/\/minis\/look$/);
});

test("Minis catalogue and consumed search launches restore their actual controls", async ({
  page,
}) => {
  await page.goto("/minis");
  const feature = page.locator('.mini-feature[data-mini-id="look"]');
  const carousel = page.locator(".mini-carousel");
  await feature.scrollIntoViewIfNeeded();
  const left = await carousel.evaluate((element) => element.scrollLeft);
  expect(left).toBeGreaterThan(500);
  await feature.click();
  await page
    .getByRole("button", {
      name: "Dismiss Get the Look terms notice",
      exact: true,
    })
    .click();
  await page
    .getByRole("link", { name: "Close Get the Look", exact: true })
    .click();
  await expect(page).toHaveURL(/\/minis$/);
  await expect(feature).toBeFocused();
  await expect
    .poll(() => carousel.evaluate((element) => element.scrollLeft))
    .toBe(left);
  const search = page.getByRole("button", {
    name: "Search Minis",
    exact: true,
  });
  await search.click();
  await page
    .getByRole("textbox", { name: "Search Minis", exact: true })
    .fill("Skin");
  await page
    .getByRole("dialog", { name: "Search Minis", exact: true })
    .getByRole("link", { name: /Skincare AI/ })
    .click();
  await expect(page).toHaveURL(/\/minis\/skin$/);
  await page
    .getByRole("link", { name: "Close Skincare AI", exact: true })
    .click();
  await expect(page).toHaveURL(/\/minis$/);
  await expect(search).toBeFocused();
  await expect(
    page.getByRole("dialog", { name: "Search Minis", exact: true }),
  ).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/\/minis\/skin$/);
  await page
    .getByRole("link", { name: "Close Skincare AI", exact: true })
    .click();
  await expect(search).toBeFocused();
});

test("a directly loaded Mini keeps the catalogue Close fallback", async ({
  page,
}) => {
  await page.goto("/minis/look?look=results");
  await page
    .getByRole("link", { name: "Close Get the Look", exact: true })
    .click();
  await expect(page).toHaveURL(/\/minis$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/minis\/look\?look=results$/);
});

test("Sol moves chosen-result focus to its heading without interrupting the message editor", async ({
  page,
}) => {
  await page.goto("/explore");
  const entry = page.locator('.explore-minis a[href="/minis/sol"]');
  await entry.click();
  await page
    .getByRole("dialog", { name: "Continue", exact: true })
    .getByRole("button", { name: "Agree", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sol preview controls", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue with text", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Message Sol", exact: true })
    .fill("sunglasses");
  await page
    .getByRole("button", { name: "Send local message", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Gold rimless glasses", exact: true })
    .click();
  const results = page.locator('[data-sol-phase="results"]');
  await expect(results).toBeVisible();
  await expect(results.getByRole("heading")).toBeFocused();
  await page
    .getByRole("link", { name: "Close Sol: Browse by Voice", exact: true })
    .click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(entry).toBeFocused();
  await page.goto(
    "/minis/sol?sol=choices&topic=glasses&mode=text&reference=captured",
  );
  await page
    .getByRole("button", { name: "Gold rimless glasses", exact: true })
    .click();
  const input = page.getByRole("textbox", { name: "Message Sol", exact: true });
  await input.fill("Keep this new question");
  await expect(results).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Keep this new question");
});
