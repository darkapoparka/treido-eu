import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("collapsed checkout retains source dividers and responsive editable sections", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  const sections = page.locator(".checkout-section-toggle");
  const bottoms = await sections.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().bottom),
  );
  expect(bottoms).toEqual([207, 293, 358, 411]);
  await expect(page.locator(".checkout-shipping-status")).toHaveCSS(
    "color",
    "rgb(139, 139, 139)",
  );
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    for (let index = 0; index < 4; index++) {
      const toggle = sections.nth(index);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});

test("photo preferences keep source-sized rows and keyboard focus after a local answer boundary", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo");
  await expect(
    page.locator(".photo-assistant > p").first().locator("strong"),
  ).toHaveText("Mobbin");
  await expect(page.locator(".photo-assistant > p").first()).toContainText(
    '"lived-in"',
  );
  const choices = page.locator(
    ".photo-assistant .assistant-preferences button",
  );
  await expect(choices).toHaveCount(3);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await choices.evaluateAll((items) =>
        items.map((item) => item.getBoundingClientRect().height),
      ),
    ).toEqual([40, 40, 40]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  const relaxed = choices.first();
  await relaxed.scrollIntoViewIfNeeded();
  await relaxed.focus();
  await relaxed.press("Enter");
  const boundary = page.getByRole("dialog", {
    name: "Assistant is not connected",
    exact: true,
  });
  await expect(boundary).toBeVisible();
  await boundary.getByRole("button", { name: /^Close / }).click();
  await expect(relaxed).toBeFocused();
  await expect(relaxed).toHaveAttribute("aria-pressed", "true");
});

test("marking and unmarking a manual package keeps its delivered continuation connected", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-manual");
  await page.goto("/orders/REF-manual-shirt");
  const picked = page.getByRole("heading", {
    name: "Picked for you",
    exact: true,
  });
  await expect(picked).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mark as delivered", exact: true })
    .click();
  await expect(picked).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Delivered today", exact: true }),
  ).toBeVisible();
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const ratings = await page
      .locator(".product-copy > .rating")
      .evaluateAll((items) =>
        items.map((item) => ({
          height: item.getBoundingClientRect().height,
          fill:
            item.querySelector(".review-rating-stars")?.getBoundingClientRect()
              .height ?? 0,
        })),
      );
    for (const rating of ratings) {
      expect(rating.height).toBe(16);
      expect(rating.fill).toBeGreaterThan(0);
      expect(rating.fill).toBeLessThanOrEqual(16);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page
    .getByRole("button", { name: "Unmark as delivered", exact: true })
    .click();
  await expect(picked).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mark as delivered", exact: true }),
  ).toBeVisible();
});

test("Minis exposes only the captured neighboring icons and retains genuine featured destinations", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/minis");
  await expect(page.locator(".mini-feature")).toHaveCount(4);
  const continuation = page.locator(
    '[aria-label="Captured Snap and Shop continuation"]',
  );
  await expect(continuation.getByRole("button")).toHaveCount(2);
  await expect(
    continuation.getByRole("link", { name: "Get the Look", exact: true }),
  ).toHaveAttribute("href", "/minis/look");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await continuation.evaluate((item) => item.getBoundingClientRect().width),
    ).toBe(31);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  const partial = continuation.getByRole("button").first();
  await partial.focus();
  await partial.press("Enter");
  const boundary = page.getByRole("dialog", {
    name: "Mini details unavailable",
    exact: true,
  });
  await expect(boundary).toBeVisible();
  await boundary.getByRole("button", { name: /^Close / }).click();
  await expect(partial).toBeFocused();
  expect(new URL(page.url()).pathname).toBe("/minis");
  const failedImages = await page.locator(".minis-page img").evaluateAll(
    (images) =>
      images.filter((image) => {
        const img = image as HTMLImageElement;
        return img.complete && img.naturalWidth === 0;
      }).length,
  );
  expect(failedImages).toBe(0);
});

test("source-bounded store photography preserves width instead of enlarging a partial image", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/stores/kitsch/info");
  const partials = page.locator('.store-info-categories img[src$="partial"]');
  await expect(partials).toHaveCount(2);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    for (const image of await partials.all()) {
      await expect(image).toHaveCSS("object-fit", "contain");
      await expect(image).toHaveCSS("object-position", "50% 0%");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});

test("outfit hotspots retain their source anchor and selected state without trapping keyboard users", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/minis/look?look=results");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  const pins = page.locator(".look-photo > button");
  await expect(pins).toHaveCount(4);
  const shirt = pins.nth(1);
  expect(
    await shirt.evaluate((pin) => pin.getBoundingClientRect().height),
  ).toBe(24);
  const before = await shirt.boundingBox();
  expect(before!.y + before!.height / 2).toBeCloseTo(325, 0);
  await shirt.focus();
  await shirt.press("Enter");
  await expect(shirt).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('.look-photo > span[aria-hidden="true"]'),
  ).toHaveCount(1);
  await expect(pins.first().locator("span").first()).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await shirt.focus();
  await shirt.press("Enter");
  await expect(shirt).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.locator('.look-photo > span[aria-hidden="true"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Selected outfit piece", exact: true }),
  ).toHaveCount(0);
  const image = page.locator(".look-photo > img");
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBe(898);
});
