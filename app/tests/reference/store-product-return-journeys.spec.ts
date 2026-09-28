import { expect, test, type Locator, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const back = (page: Page) =>
  page.getByRole("button", { name: "Go back", exact: true });

async function placeSource(page: Page, source: Locator) {
  await source.evaluate((element) => {
    element.scrollIntoView({ block: "center", behavior: "instant" });
    (element as HTMLElement).focus({ preventScroll: true });
  });
  return page.evaluate(() => scrollY);
}

for (const width of [320, 393, 430, 467]) {
  test(`Cart moves focus with its item between lists and after last removal at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 467 ? 853 : 793 });
    await useReferenceScenario(page, "cart-bag");
    await page.goto("/products/shampoo-bag");
    const opener = page.getByRole("button", { name: "Open cart", exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Your cart", exact: true });
    const save = dialog.getByRole("button", {
      name: "Save for later",
      exact: true,
    });
    const move = dialog.getByRole("button", {
      name: "Move to cart",
      exact: true,
    });
    await save.click();
    await expect(move).toBeFocused();
    await move.press("Enter");
    await expect(save).toBeFocused();
    await expect(dialog.locator(".cart-stepper output")).toHaveText("1");
    if (width === 320 || width === 430) {
      await dialog
        .getByRole("button", { name: "Remove Shampoo Bar Bag", exact: true })
        .click();
    } else {
      await save.press("Enter");
      await expect(move).toBeFocused();
      await dialog
        .getByRole("button", {
          name: "Remove saved Shampoo Bar Bag",
          exact: true,
        })
        .click();
    }
    await expect(
      dialog.getByRole("heading", { name: "Your cart is empty", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Close cart", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    // The PDP removes its cart shortcut when the final line is removed.
    await expect(opener).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Home", exact: true }),
    ).toBeFocused();
  });

  test(`collection promotion and merchant return preserve source at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 467 ? 853 : 793 });
    await page.goto("/stores/kitsch/collections/whats-new");
    const promotion = page.locator(".collection-promotion");
    await expect(promotion).toHaveAttribute("aria-expanded", "false");
    await promotion.click();
    await expect(promotion).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".promotion-offers")).toContainText(
      "Eligible products only.",
    );
    await expect(page.locator(".promotion-offers")).toContainText(
      "20% off your order",
    );
    await promotion.click();
    await expect(page.locator(".promotion-offers")).toHaveCount(0);
    const source = page.locator(".collection-store");
    const y = await placeSource(page, source);
    await source.click();
    await expect(page).toHaveURL("/stores/kitsch");
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await back(page).click();
    await expect(page).toHaveURL("/stores/kitsch/collections/whats-new");
    await expect(source).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
    await page.goForward();
    await expect(page).toHaveURL("/stores/kitsch");
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.goBack();
    await expect(source).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
    await page.goto("/stores/kitsch/collections/best-sellers");
    await expect(page.locator(".collection-promotion")).toHaveCount(0);
  });

  test(`Chemical video Close consumes its entry and restores store rail at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 467 ? 853 : 793 });
    await page.goto("/stores/chemical-guys");
    const source = page.getByRole("link", {
      name: "Open Tire and Trim video",
      exact: true,
    });
    const y = await placeSource(page, source);
    const rail = page.locator(".store-video-rail");
    await rail.evaluate((element) => {
      element.scrollLeft = 32;
    });
    await source.focus();
    const x = await rail.evaluate((element) => element.scrollLeft);
    await source.press("Enter");
    await expect(page).toHaveURL("/stores/chemical-guys/video");
    await page.getByRole("link", { name: "Close video", exact: true }).click();
    await expect(page).toHaveURL("/stores/chemical-guys");
    await expect(source).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
    await expect
      .poll(() => rail.evaluate((element) => element.scrollLeft))
      .toBe(x);
    await page.goForward();
    await expect(page).toHaveURL("/stores/chemical-guys/video");
    await page.goBack();
    await expect(source).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
    // Close must not push a second store entry in front of the video.
    await page.goBack();
    await expect(page).not.toHaveURL(/\/video$/);
  });

  test(`inline photos retain geometry and selected Close focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 467 ? 853 : 793 });
    await page.goto("/products/shea-butter");
    const rail = page.locator(".product-gallery");
    const first = page.getByRole("button", {
      name: "View product image 1",
      exact: true,
    });
    const bounds = await rail.boundingBox();
    expect(bounds?.x).toBe(0);
    expect(bounds?.width).toBe(width);
    const firstBounds = await first.boundingBox();
    expect(firstBounds?.x).toBe(16);
    expect(firstBounds?.width).toBe(width - 32);
    const y = await page.evaluate(() => scrollY);
    await first.click();
    await page
      .getByRole("button", { name: "Show photo 3", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close product photos", exact: true })
      .click();
    const selected = page.getByRole("button", {
      name: "View product image 3",
      exact: true,
    });
    await expect(selected).toBeFocused();
    await expect.poll(async () => (await selected.boundingBox())?.x).toBe(24);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
    const previous = await page
      .getByRole("button", { name: "View product image 2", exact: true })
      .boundingBox();
    expect(previous!.x + previous!.width).toBe(16);
    await selected.click();
    await page.goBack();
    await expect(selected).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  });
}

test("PDP merchant links return to their own source instead of another merchant control", async ({
  page,
}) => {
  await useReferenceScenario(page, "kitsch-shea-following");
  await page.goto("/products/shea-butter");
  for (const selector of [".pdp-delivery > a", ".pdp-store-card > a"]) {
    const source = page.locator(selector);
    const y = await placeSource(page, source);
    await source.click();
    await expect(page).toHaveURL("/stores/kitsch");
    await back(page).click();
    await expect(source).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  }
});

test("expanded collection offers belong to their entry across merchant return, Forward and reload", async ({
  page,
}) => {
  await page.goto("/stores/kitsch/collections/whats-new");
  const promotion = page.locator(".collection-promotion");
  await promotion.click();
  const source = page.locator(".collection-store");
  const y = await placeSource(page, source);
  await source.click();
  await expect(page).toHaveURL("/stores/kitsch");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await back(page).click();
  await expect(promotion).toHaveAttribute("aria-expanded", "true");
  await expect(source).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  await page.goForward();
  await expect(page).toHaveURL("/stores/kitsch");
  await page.goBack();
  await expect(promotion).toHaveAttribute("aria-expanded", "true");
  await expect(source).toBeFocused();
  await page.reload();
  await expect(promotion).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL("/stores/kitsch/collections/whats-new");
  await page.goto("/stores/kitsch");
  await page
    .locator('.store-collection-rail a[data-store-collection="whats-new"]')
    .click();
  await expect(promotion).toHaveAttribute("aria-expanded", "false");
});

test("expanded storefront offers survive product return without leaking into a fresh store entry", async ({
  page,
}) => {
  await page.goto("/stores/kitsch");
  const promotion = page.locator(".store-promotion");
  await promotion.click();
  const source = page
    .locator(".store-recommendations .product-media a")
    .first();
  const y = await placeSource(page, source);
  await source.click();
  await expect(page).toHaveURL(/\/products\//);
  await page.goBack();
  await expect(promotion).toHaveAttribute("aria-expanded", "true");
  await expect(source).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  await page.goForward();
  await expect(page).toHaveURL(/\/products\//);
  await page.goBack();
  await expect(promotion).toHaveAttribute("aria-expanded", "true");
  await page.reload();
  await expect(promotion).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("link", { name: "Store information", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL("/stores/kitsch/info");
  await page.locator(".store-shop-all").click();
  await expect(promotion).toHaveAttribute("aria-expanded", "false");
});

test("StoreInfo category and Shop all returns preserve their actual control", async ({
  page,
}) => {
  await page.goto("/stores/kitsch/info");
  for (const selector of [
    '.store-info-categories a[href$="/whats-new"]',
    ".store-shop-all",
  ]) {
    const source = page.locator(selector);
    const y = await placeSource(page, source);
    await source.click();
    await expect(page).not.toHaveURL(/\/info$/);
    await back(page).click();
    await expect(page).toHaveURL("/stores/kitsch/info");
    await expect(source).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  }
});

test("a merchant destination reload preserves native source scroll on Back", async ({
  page,
}) => {
  await page.goto("/products/shea-butter");
  const source = page.locator(".pdp-delivery > a");
  const y = await placeSource(page, source);
  expect(y).toBeGreaterThan(500);
  await source.click();
  await expect(page).toHaveURL("/stores/kitsch");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.reload();
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.goBack();
  await expect(page).toHaveURL("/products/shea-butter");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
});

test("modified merchant navigation preserves the current page and scroll entry", async ({
  page,
}) => {
  await page.goto("/products/shea-butter");
  // Capture the interactive entry, after Next initializes router history.
  // The SSR entry can still be null while its merchant link is inert.
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  const source = page.locator(".pdp-delivery > a");
  const y = await placeSource(page, source);
  const history = await page.evaluate(() =>
    JSON.stringify(window.history.state),
  );
  await source.click({ modifiers: ["Control"] });
  await expect(page).toHaveURL("/products/shea-butter");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  expect(await page.evaluate(() => JSON.stringify(window.history.state))).toBe(
    history,
  );
});

test("Chemical video product and merchant returns keep its Close origin", async ({
  page,
}) => {
  await page.goto("/stores/chemical-guys");
  const source = page.getByRole("link", {
    name: "Open Tire and Trim video",
    exact: true,
  });
  const y = await placeSource(page, source);
  await source.click();
  await expect(page).toHaveURL("/stores/chemical-guys/video");
  for (const href of ["/products/order-tire-trim", "/stores/chemical-guys"]) {
    const link = page.locator(`.video-bottom a[href="${href}"]`);
    await link.click();
    await expect(page).toHaveURL(href);
    await page.goBack();
    await expect(link).toBeFocused();
  }
  await page.getByRole("link", { name: "Close video", exact: true }).click();
  await expect(source).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
});

test("unavailable saved cart item remains disabled with an isolated text layer", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-unavailable");
  await page.goto("/products/shampoo-bag");
  await page.getByRole("button", { name: "Open cart", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your cart", exact: true });
  await dialog
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  const move = dialog.getByRole("button", {
    name: "Move to cart",
    exact: true,
  });
  await expect(move).toBeDisabled();
  await expect(move).toHaveCSS("opacity", "1");
  await expect(move.locator("span")).toHaveCSS("opacity", "0.999");
  await expect(
    dialog.getByRole("button", {
      name: "Remove saved Shampoo Bar Bag",
      exact: true,
    }),
  ).toBeFocused();
  await expect(
    dialog.getByRole("heading", { name: "Your cart is empty", exact: true }),
  ).toBeVisible();
});
