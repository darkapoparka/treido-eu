import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await useReferenceScenario(page, "home-welcome");
});

async function visitMini(
  page: Page,
  id: "sol" | "skin" | "look",
  closeName: string,
) {
  await page.locator(`.mini-feature[data-mini-id="${id}"]`).click();
  if (id === "sol") {
    const access = page.getByRole("dialog", { name: "Continue", exact: true });
    await expect(access).toBeVisible();
    await access.getByRole("button", { name: "Agree", exact: true }).click();
  }
  if (id === "look") {
    await page
      .getByRole("button", {
        name: "Dismiss Get the Look terms notice",
        exact: true,
      })
      .click();
  }
  await page.getByRole("link", { name: closeName, exact: true }).click();
  await expect(page).toHaveURL(/\/minis$/);
  await expect(
    page.getByRole("heading", { name: "Minis", exact: true }),
  ).toBeVisible();
}

async function recentSources(page: Page) {
  return page
    .locator(".mini-recent img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("src")));
}

test("Minis catalogue preserves captured card geometry and natural visit history", async ({
  page,
}) => {
  await page.goto("/explore");
  await page.getByRole("link", { name: /Try something new/ }).click();
  await expect(page).toHaveURL(/\/minis$/);
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);

  const firstFeature = page.locator('.mini-feature[data-mini-id="sol"]');
  await expect(firstFeature).toBeVisible();
  const featureBounds = await firstFeature.boundingBox();
  expect(Math.round(featureBounds?.y ?? -1)).toBeGreaterThanOrEqual(60);
  expect(Math.round(featureBounds?.y ?? -1)).toBeLessThanOrEqual(62);
  expect(Math.round(featureBounds?.height ?? -1)).toBeGreaterThanOrEqual(253);
  expect(Math.round(featureBounds?.height ?? -1)).toBeLessThanOrEqual(256);
  const featureImageBounds = await firstFeature
    .locator(":scope > img")
    .boundingBox();
  expect(Math.round(featureImageBounds?.y ?? -1)).toBeGreaterThanOrEqual(68);
  expect(Math.round(featureImageBounds?.y ?? -1)).toBeLessThanOrEqual(70);
  const snapBounds = await page
    .getByRole("heading", { name: "Snap & Shop", exact: true })
    .boundingBox();
  expect(Math.round(snapBounds?.y ?? -1)).toBeGreaterThanOrEqual(351);
  expect(Math.round(snapBounds?.y ?? -1)).toBeLessThanOrEqual(353);

  await visitMini(page, "sol", "Close Sol: Browse by Voice");
  await expect(page.locator(".mini-recent a")).toHaveCount(1);
  expect(await recentSources(page)).toEqual([
    "/api/reference-media/mini-sol-icon",
  ]);

  await visitMini(page, "skin", "Close Skincare AI");
  expect(await recentSources(page)).toEqual([
    "/api/reference-media/mini-skin-icon",
    "/api/reference-media/mini-sol-icon",
  ]);

  await visitMini(page, "look", "Close Get the Look");
  expect(await recentSources(page)).toEqual([
    "/api/reference-media/mini-look-icon",
    "/api/reference-media/mini-skin-icon",
    "/api/reference-media/mini-sol-icon",
  ]);

  await page.getByRole("button", { name: /^Get that room/ }).click();
  const unavailable = page.getByRole("dialog", {
    name: "Get that room",
    exact: true,
  });
  const unavailableCopy =
    "This Mini has no captured detail flow and is unavailable in this reference preview.";
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toContainText(unavailableCopy);
  await page.keyboard.press("Escape");
  await expect(unavailable).not.toBeVisible();
  await expect(page).toHaveURL(/\/minis$/);

  await page
    .locator(".mini-recent")
    .getByRole("button", { name: "Get that room", exact: true })
    .click();
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toContainText(unavailableCopy);
  await expect(page).toHaveURL(/\/minis$/);
  await page.keyboard.press("Escape");
  await expect(unavailable).not.toBeVisible();
  await expect(page).toHaveURL(/\/minis$/);
  expect(await recentSources(page)).toEqual([
    "/api/reference-media/mini-room-icon",
    "/api/reference-media/mini-look-icon",
    "/api/reference-media/mini-skin-icon",
    "/api/reference-media/mini-sol-icon",
  ]);

  const carousel = page.locator(".mini-carousel");
  await carousel.evaluate((element) =>
    element.scrollTo({ left: element.scrollWidth, behavior: "instant" }),
  );
  await expect
    .poll(() => carousel.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(1000);
  const giftBounds = await page
    .locator('.mini-feature[data-mini-id="gift"]')
    .boundingBox();
  expect(Math.round(giftBounds?.x ?? -1)).toBeGreaterThanOrEqual(24);
  expect(Math.round(giftBounds?.x ?? -1)).toBeLessThanOrEqual(26);
  const giftRightGap = Math.round(
    393 -
      (giftBounds?.x ?? 0) -
      (giftBounds?.width ?? Number.POSITIVE_INFINITY),
  );
  expect(giftRightGap).toBeGreaterThanOrEqual(15);
  expect(giftRightGap).toBeLessThanOrEqual(17);

  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
