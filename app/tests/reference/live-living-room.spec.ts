import { expect, test, type Page } from "@playwright/test";
const route = "/explore/curations/living-room";
const productIds = [
  "silque",
  "barts",
  "papasan",
  "kobon",
  "olive",
  "lexi",
  "tray",
  "cushion",
  "jupiter",
  "bin",
];
async function ready(page: Page) {
  await expect(page.locator("[data-shop-interactive]").first()).toHaveAttribute(
    "data-shop-interactive",
    "true",
  );
  await page.evaluate(() => document.fonts.ready);
}
test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});
test("native Home connects its source hero, collection and editorial with restored focus", async ({
  page,
}) => {
  await page.goto("/explore/Home");
  await expect(page.locator(".native-home-categories a")).toHaveText([
    "Kitchen & dining",
    "Decor",
    "Bedding",
    "Plants",
    "Towels",
    "Household appliances",
    "Lighting",
    "Furniture",
  ]);
  const hero = page.locator(".native-home-hero");
  await expect(hero.locator("img")).toHaveAttribute(
    "src",
    "/api/reference-media/live-home-living-room",
  );
  await hero.click();
  await page.waitForURL(`**${route}`);
  await ready(page);
  await expect(page.locator("h1")).toHaveText("Living room glow up");
  await expect(page.locator(".native-curation-grid .product-card")).toHaveCount(
    10,
  );
  const share = page.getByRole("button", {
    name: "Share Living room glow up",
    exact: true,
  });
  await share.click();
  await expect(
    page.getByRole("dialog", { name: "Sharing link" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(share).toBeFocused();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.waitForURL("**/explore/Home");
  await expect(hero).toBeFocused();
  const editorial = page.locator(".native-home-editorial");
  await editorial.click();
  await page.waitForURL("**/explore/curations/cozy-edit");
  await page.goBack();
  await page.waitForURL("**/explore/Home");
  await expect(editorial).toBeFocused();
});
for (const id of productIds)
  test(`native living ${id} opens its own product and returns to the collection`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(route);
    await ready(page);
    const opener = page.locator(
      `[data-product-id="live-home-${id}"] .product-copy`,
    );
    await opener.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    await opener.click();
    await page.waitForURL(`**/products/live-home-${id}`);
    await ready(page);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(page.locator(".product-gallery img").first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".product-gallery img")
          .first()
          .evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.waitForURL(`**${route}`);
    await expect(opener).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
    expect(errors).toEqual([]);
  });
test("native unavailable moss is the entry selection, while olive sizes keep actual prices", async ({
  page,
}) => {
  await page.goto("/products/live-home-barts");
  await ready(page);
  await expect(page.locator(".native-product-colors legend")).toHaveText(
    "Color: moss",
  );
  await expect(page.locator(".product-price")).toHaveText("$136.85 Sold out");
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toHaveCount(0);
  await page.goto("/products/live-home-olive");
  await ready(page);
  await expect(page.locator(".product-price")).toHaveText("$240.00");
  await expect(
    page.getByRole("button", { name: "Colour: Olive", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Size: Large", exact: true }).click();
  await expect(page.locator(".product-price")).toHaveText("$260.00");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Size: Large", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".product-price")).toHaveText("$260.00");
});
for (const width of [320, 393, 427, 430])
  test(`native Home and living collection fit ${width}px and short height`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of [
      "/explore/Home",
      route,
      "/products/live-home-lexi",
      "/products/live-home-cushion",
    ]) {
      await page.goto(path);
      await ready(page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await expect(
        page.getByRole("button", { name: "Go back", exact: true }),
      ).toBeInViewport();
    }
  });
test("living collection decodes original media at three times device density", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 427, height: 876 },
    deviceScaleFactor: 3,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const page = await context.newPage();
    await page.goto(String(test.info().project.use.baseURL) + route);
    await ready(page);
    for (const id of productIds) {
      const image = page.locator(
        `[data-product-id="live-home-${id}"] .product-media img`,
      );
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (e: HTMLImageElement) => e.complete && e.naturalWidth > 0,
          ),
        )
        .toBe(true);
      expect(
        await image.evaluate((e: HTMLImageElement) => e.currentSrc),
      ).toContain("-3x");
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(427);
  } finally {
    await context.close();
  }
});
