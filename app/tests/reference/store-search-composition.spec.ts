import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("captured shampoo photographs preserve real product actions and responsive result geometry", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/stores/kitsch/search?q=shampoo");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  const ids = [
    "rice-shampoo",
    "rosemary-liquid",
    "rice-liquid",
    "detox-shampoo",
  ];
  const cards = page.locator(".product-grid .product-card");
  await expect(cards).toHaveCount(4);
  for (const id of ids) {
    const card = cards.filter({
      has: page.locator(`a[href="/products/${id}"]`),
    });
    await expect(card.locator(".product-media img")).toHaveAttribute(
      "src",
      `/api/reference-media/store-search-${id}-photo`,
    );
    await expect(card.locator(".save-button")).toBeEnabled();
    await expect(card.locator(".product-copy")).toHaveAttribute(
      "href",
      `/products/${id}`,
    );
  }
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await cards
      .locator("img")
      .evaluateAll((images) =>
        Promise.all(
          images.map((image) => (image as HTMLImageElement).decode()),
        ),
      );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    if (width === 393) {
      const rowTops = await cards.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().top),
      );
      expect(rowTops[0]).toBeCloseTo(136, 0);
      expect(rowTops[2]).toBeCloseTo(385.5, 0);
    }
  }
  const first = cards.first();
  const save = first.locator(".save-button");
  const saved = (await save.getAttribute("aria-pressed")) === "true";
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", String(!saved));
  // The isolated preview starts a fresh seed on a full reload. Verify the
  // real product navigation and browser Back within this buyer session.
  await first.locator(".product-copy").click();
  await expect(page).toHaveURL(/\/products\/rice-shampoo$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/stores\/kitsch\/search\?q=shampoo$/);
  await expect(cards).toHaveCount(4);
  await expect(save).toHaveAttribute("aria-pressed", String(!saved));
});
