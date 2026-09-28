import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator("img:visible").evaluateAll((images) =>
    Promise.all(
      images
        .filter((image) => {
          const box = image.getBoundingClientRect();
          return (
            box.right > 0 &&
            box.left < innerWidth &&
            box.bottom > 0 &&
            box.top < innerHeight
          );
        })
        .map((image) => (image as HTMLImageElement).decode()),
    ),
  );
}
test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});

test("native Home shelf contains the actual products and opens the native Home category", async ({
  page,
}) => {
  await page.goto("/explore");
  const shelf = page.locator(".explore-shelf").first();
  await expect(shelf.locator(".product-card")).toHaveCount(3);
  await expect(shelf.locator(".product-seller")).toHaveText([
    "Our Place",
    "Ruggable",
    "Cozy Earth",
  ]);
  await expect(shelf.locator(".product-copy > span:last-child")).toHaveText([
    "$149.00",
    "$89.00",
    "€282.95",
  ]);
  await expect(shelf.locator(".product-copy .rating")).toContainText([
    "8.8K",
    "4.4K",
    "589",
  ]);
  await expect(
    shelf
      .getByRole("link", { name: "Top rated in home", exact: false })
      .first(),
  ).toHaveAttribute("href", "/explore/Home");
  await ready(page);
  const box = await shelf.locator(".product-media").first().boundingBox();
  expect(box!.width).toBeCloseTo(189.5, 1);
  expect(box!.height).toBeCloseTo(189.5, 1);
  const heading = shelf.locator("h2").locator("..");
  await heading.click();
  await page.waitForURL("**/explore/Home");
  await expect(
    page.getByRole("heading", { name: "Home", exact: true, level: 1 }),
  ).toBeVisible();
  await page.goBack();
  await page.waitForURL("**/explore");
  await expect(heading).toBeFocused();
});

for (const id of ["perfect-pot", "verena-rug", "bubble-blanket"]) {
  test(`native ${id} returns to its shelf with focus, scroll and rail intact`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/explore");
    const opener = page.locator(
      `.explore-shelf [data-product-id="live-explore-${id}"] .product-media a`,
    );
    await opener.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    const rail = page.locator(".explore-shelf .product-rail").first();
    const offset = await rail.evaluate((element) => element.scrollLeft);
    await opener.click();
    await page.waitForURL(`**/products/live-explore-${id}`);
    await expect(
      page.locator('.floating-nav a[aria-current="page"]'),
    ).toHaveAttribute("aria-label", "Explore");
    await ready(page);
    await page.reload();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.waitForURL("**/explore");
    await expect(opener).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeCloseTo(scroll, 0);
    await expect
      .poll(() => rail.evaluate((element) => element.scrollLeft))
      .toBeCloseTo(offset, 0);
    expect(errors).toEqual([]);
  });
}

test("pot colors use the native sheet, cancel cleanly, and retain the selected photograph after reload", async ({
  page,
}) => {
  await page.goto("/products/live-explore-perfect-pot");
  const more = page.getByRole("button", {
    name: "View 4 more colors",
    exact: true,
  });
  await expect(page.locator(".native-color-grid > button")).toHaveCount(16);
  await expect(
    page.getByRole("button", { name: "Color: Clay", exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole("button", { name: "Color: Clay", exact: true })
      .locator("span"),
  ).toHaveAttribute("data-unavailable", "true");
  await more.click();
  const sheet = page.getByRole("dialog", { name: "Color", exact: true });
  await expect(sheet.locator(".native-color-list > button")).toHaveCount(19);
  await expect(
    sheet.getByRole("button", { name: "Spice", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await expect(page.locator(".native-product-colors legend")).toHaveText(
    "Color: Spice",
  );
  await more.click();
  await sheet.getByRole("button", { name: "Char", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(page).toHaveURL(/variant=live-explore-pot-char/);
  await expect(page.locator(".product-gallery img").first()).toHaveAttribute(
    "src",
    "/api/reference-media/live-shelf-pot-photo-1",
  );
  await expect(page.locator(".product-gallery img").nth(1)).toHaveAttribute(
    "src",
    "/api/reference-media/live-shelf-pot-photo-2",
  );
  await page.reload();
  await expect(page.locator(".native-product-colors legend")).toHaveText(
    "Color: Char",
  );
  const save = page.getByRole("button", { name: "Save product", exact: true });
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "false");
});

test("rug sizes preserve pad choice, native price and selected-image order", async ({
  page,
}) => {
  await page.goto("/products/live-explore-verena-rug");
  await page
    .getByRole("button", { name: "View 6 more Size options", exact: true })
    .click();
  const sheet = page.getByRole("dialog", { name: "Size", exact: true });
  await expect(sheet.locator(".native-color-list > button")).toHaveCount(13);
  await sheet.getByRole("button", { name: "2.5'x7'", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(page.locator(".product-price")).toHaveText("$159.00");
  await expect(
    page.getByRole("button", { name: "Rug: Rug + Pad System", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".product-gallery img").first()).toHaveAttribute(
    "src",
    "/api/reference-media/live-shelf-rug-photo-10",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Size: 2.5'x7'", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".product-price")).toHaveText("$159.00");
});

test("blanket keeps color, size, quantity, photograph and euro subtotal together", async ({
  page,
}) => {
  await page.goto("/products/live-explore-bubble-blanket");
  await page
    .getByRole("button", { name: 'Size: Large: 60" x 80"', exact: true })
    .click();
  await expect(page.locator(".product-price")).toHaveText("€344.95");
  await page
    .getByRole("button", { name: "Color: Walnut", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: 'Size: Large: 60" x 80"', exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Color: Tide", exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole("button", { name: "Color: Tide", exact: true })
      .locator("span"),
  ).toHaveAttribute("data-unavailable", "true");
  await page
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await expect(page.locator(".quantity output")).toHaveText("2");
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.goto("/cart");
  const line = page.locator(
    '[data-cart-line="live-explore-bubble-blanket|live-explore-blanket-43644160573620"]',
  );
  await expect(line).toBeVisible();
  await expect(line.locator("img").first()).toHaveAttribute(
    "src",
    "/api/reference-media/live-shelf-blanket-photo-10",
  );
  await expect(line.locator(".cart-variant")).toHaveText(
    'Walnut / Large: 60" x 80"',
  );
  await expect(page.locator(".seller-cart")).toContainText("€689.90");
  await page.reload();
  await expect(page.locator(".seller-cart")).toContainText("€689.90");
});

for (const width of [320, 393, 430]) {
  test(`native shelf and option controls remain contained at ${width}px and short height`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const id of ["perfect-pot", "verena-rug", "bubble-blanket"]) {
      await page.goto(`/products/live-explore-${id}`);
      await ready(page);
      const action = page.getByRole("button", {
        name: "Add to cart",
        exact: true,
      });
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.screenshot({
      path: test.info().outputPath(`shelf-product-${width}.png`),
    });
  });
}

test("native shelf originals decode at 3x without borrowing shelf screenshots", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 427, height: 876 },
    deviceScaleFactor: 3,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const page = await context.newPage();
    for (const id of ["perfect-pot", "verena-rug", "bubble-blanket"]) {
      await page.goto(
        `${test.info().project.use.baseURL}/products/live-explore-${id}`,
      );
      await ready(page);
      const image = page.locator(".product-gallery img").first();
      const pixels = await image.evaluate(async (element) => {
        const response = await fetch((element as HTMLImageElement).currentSrc);
        const bitmap = await createImageBitmap(await response.blob());
        const result = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return result;
      });
      expect(pixels.width).toBeGreaterThanOrEqual(1000);
      expect(pixels.height).toBeGreaterThanOrEqual(1000);
      await page.screenshot({
        path: test.info().outputPath(`${id}-retina.png`),
      });
    }
  } finally {
    await context.close();
  }
});
