import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

async function ready(page: Page) {
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.locator("main img").evaluateAll(async (images) => {
    await document.fonts.ready;
    await Promise.all(
      images.map((image) =>
        (image as HTMLImageElement).decode().catch(() => undefined),
      ),
    );
  });
}

const paths = [
  {
    name: "Home compact product",
    scenario: "home-recent-products",
    url: "/?feed=recent-products",
    selector:
      '.recent-panel [data-product-id="round-sunglasses"] .product-media a',
  },
  {
    name: "Home merchant identity",
    scenario: "home-recent-products",
    url: "/?feed=recent-products",
    selector: ".store-row-identity",
  },
  {
    name: "Following product",
    scenario: "following-pair",
    url: "/following",
    selector: '[data-product-id="following-black-bow"] .product-media a',
  },
  {
    name: "Following merchant identity",
    scenario: "following-pair",
    url: "/following",
    selector: '[data-following-post="kitsch"] .following-post-identity',
  },
  {
    name: "Saved product title",
    scenario: "saved-pair",
    url: "/saved",
    selector: '[data-product-id="shea-butter"] .saved-item-title',
  },
  {
    name: "Store recommendation rail",
    scenario: "home-welcome",
    url: "/stores/kitsch",
    selector:
      '.store-recommendations .product-rail [data-product-id="rice-shampoo"] .product-media a',
  },
  {
    name: "Search product",
    scenario: "search-entry",
    url: "/search?q=Jeans",
    selector: ".search-results .product-media a",
  },
] as const;

for (const path of paths) {
  test(`${path.name} restores its exact control through dock Back and repeated native history`, async ({
    page,
  }) => {
    await useReferenceScenario(page, path.scenario);
    await page.goto(path.url);
    await ready(page);
    const source = page.locator(path.selector).first();
    await source.scrollIntoViewIfNeeded();
    await source.focus();
    const before = await source.evaluate((element) => ({
      y: scrollY,
      railX: element.closest(".product-rail")?.scrollLeft,
    }));
    const destination = await source.getAttribute("href");
    await source.click();
    await expect(page).toHaveURL(destination!);
    await ready(page);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    for (let visit = 0; visit < 2; visit += 1) {
      await expect(page).toHaveURL(path.url);
      await expect(source).toBeFocused();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(before.y);
      if (path.name === "Store recommendation rail")
        await expect
          .poll(() =>
            source.evaluate(
              (element) => element.closest(".product-rail")?.scrollLeft,
            ),
          )
          .toBe(before.railX);
      if (visit === 0) {
        await page.goForward();
        await expect(page).toHaveURL(destination!);
        await page.goBack();
      }
    }
  });
}

test("rail return preserves a partially visible product and exact page scroll", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/stores/kitsch");
  await ready(page);
  const source = page.locator(
    '.store-recommendations .product-rail [data-product-id="rice-shampoo"] .product-copy',
  );
  const before = await source.evaluate((element) => {
    const rail = element.closest<HTMLElement>(".product-rail")!;
    rail.scrollLeft = 175;
    window.scrollTo({ top: 80, behavior: "instant" });
    (element as HTMLElement).focus({ preventScroll: true });
    const card = element.getBoundingClientRect();
    const bounds = rail.getBoundingClientRect();
    return {
      y: scrollY,
      x: rail.scrollLeft,
      partiallyVisible: card.left < bounds.right && card.right > bounds.right,
    };
  });
  expect(before.partiallyVisible).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/products/rice-shampoo");
  await page.goBack();
  await expect(source).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before.y);
  await expect
    .poll(() =>
      source.evaluate(
        (element) => element.closest(".product-rail")?.scrollLeft,
      ),
    )
    .toBe(before.x);
});

test("a reordered recent product remains reachable without reverting the real viewing history", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-entry");
  await page.goto("/search");
  await ready(page);
  const source = page.locator('[data-recent-id="terracotta"] .product-media a');
  await source.scrollIntoViewIfNeeded();
  await source.focus();
  const before = await source.evaluate((element) => ({
    y: scrollY,
    x: element.closest(".product-rail")!.scrollLeft,
  }));
  expect(before.x).toBeGreaterThan(112);
  await source.click();
  await expect(page).toHaveURL("/products/terracotta");
  await page.goBack();
  await expect(source).toBeFocused();
  await expect(page.locator("[data-recent-id]").first()).toHaveAttribute(
    "data-recent-id",
    "terracotta",
  );
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before.y);
  await expect
    .poll(() =>
      source.evaluate((element) => {
        const rail = element.closest<HTMLElement>(".product-rail")!;
        return (
          element.getBoundingClientRect().left -
          rail.getBoundingClientRect().left -
          rail.clientLeft
        );
      }),
    )
    .toBe(0);
  expect(
    await source.evaluate(
      (element) => element.closest(".product-rail")!.scrollLeft,
    ),
  ).toBeLessThan(before.x);
  await expect(source).toBeInViewport();
});
