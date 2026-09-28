import { expect, test } from "@playwright/test";
import { addShampooBag, useReferenceScenario } from "./helpers";

test("Explore's empty cart follows the categories section across viewport widths", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/explore");
  const cart = page.getByRole("button", { name: "Open cart", exact: true });
  for (const width of [393, 320, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await page.evaluate(() => scrollTo(0, 0));
    await expect(cart).toBeVisible();
    await page
      .locator(".explore-minis")
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await expect(cart).toHaveCount(0);
    await page.evaluate(() => scrollTo(0, 0));
    await expect(cart).toBeVisible();
  }
  await page.locator('.explore-categories a[href="/explore/Beauty"]').click();
  await expect(
    page.getByRole("heading", { name: "Beauty", exact: true }),
  ).toBeVisible();
  await expect(cart).toHaveCount(0);
  await page.goBack();
  await expect(cart).toBeVisible();
});

test("a populated Explore cart stays available below categories and restores focus", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await addShampooBag(page);
  await page.goto("/explore");
  const cart = page.getByRole("button", { name: "Open cart", exact: true });
  await expect(cart.locator(".dock-cart-count")).toHaveText("1");
  await page
    .locator(".explore-minis")
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect(cart).toBeVisible();
  await cart.click();
  const sheet = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(sheet).toBeVisible();
  await expect(
    sheet.getByText("Shampoo Bar Bag", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(cart).toBeFocused();
  await expect(cart.locator(".dock-cart-count")).toHaveText("1");
});
