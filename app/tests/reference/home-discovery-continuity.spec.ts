import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("Home mixed history uses the shared product save and recent-history navigation", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-recent-shops");
  await page.goto("/?feed=recent-stores");
  const history = page.getByRole("region", {
    name: "Recently viewed shops",
    exact: true,
  });
  await expect(history.locator("[data-recent-id]")).toHaveCount(4);
  const savedShortcut = page.getByRole("link", { name: "Saved", exact: true });
  await expect(savedShortcut).toHaveCSS("font-weight", "500");
  await expect(savedShortcut).toBeInViewport({ ratio: 1 });
  await expect(
    history.locator('[data-recent-id="shea-butter"] img'),
  ).toHaveAttribute("src", "/api/reference-media/shea");
  const drmtlgy = history.locator('[data-recent-id="drmtlgy"]');
  await expect(drmtlgy.locator("a > img")).toHaveAttribute(
    "src",
    "/api/reference-media/home-recent-drmtlgy-cover",
  );
  await expect(drmtlgy.locator('a > span[aria-hidden="true"]')).toHaveCount(0);
  const save = history.getByRole("button", {
    name: "Save Shea Butter Exfoliating Body Wash",
    exact: true,
  });
  await save.click();
  await expect(
    history.getByRole("button", {
      name: "Unsave Shea Butter Exfoliating Body Wash",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await history
    .getByRole("link", { name: "Recently viewed", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search\?view=recent$/);
  const expanded = page.locator(".recent-history-grid");
  await expect(expanded.locator("[data-recent-id]")).toHaveCount(4);
  await expect(
    expanded.getByRole("button", {
      name: "Unsave Shea Butter Exfoliating Body Wash",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(
    history.getByRole("button", {
      name: "Unsave Shea Butter Exfoliating Body Wash",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      history
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
});

test("Home campaign navigation restores the same campaign across Back and Forward", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/");
  const campaign = page.getByRole("region", {
    name: "KITSCH campaign",
    exact: true,
  });
  await campaign.evaluate((element) =>
    window.scrollTo(
      0,
      window.scrollY + element.getBoundingClientRect().top - 56,
    ),
  );
  await expect
    .poll(async () => Math.round((await campaign.boundingBox())?.y ?? -1))
    .toBe(56);
  const originalScroll = await page.evaluate(() => window.scrollY);
  const trigger = campaign.getByRole("link", {
    name: "Visit KITSCH",
    exact: true,
  });
  await trigger.click();
  await expect(page).toHaveURL(/\/stores\/kitsch$/);
  await expect(
    page.getByRole("heading", { name: "For you", exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("main.home-page")).toHaveAttribute(
    "data-feed",
    "recent-stores",
  );
  await expect
    .poll(async () => Math.round((await campaign.boundingBox())?.y ?? -1))
    .toBe(56);
  const restoredScroll = await page.evaluate(() => window.scrollY);
  expect(restoredScroll).toBeGreaterThan(originalScroll);
  await expect(trigger).toBeFocused();

  await page.goForward();
  await expect(page).toHaveURL(/\/stores\/kitsch$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(async () => Math.round((await campaign.boundingBox())?.y ?? -1))
    .toBe(56);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(restoredScroll);
});

test("Home campaign product navigation starts at the top and restores its product control", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/");
  const campaign = page.getByRole("region", {
    name: "KITSCH campaign",
    exact: true,
  });
  await campaign.evaluate((element) =>
    window.scrollTo(
      0,
      window.scrollY + element.getBoundingClientRect().top - 56,
    ),
  );
  await expect
    .poll(async () => Math.round((await campaign.boundingBox())?.y ?? -1))
    .toBe(56);
  const originalScroll = await page.evaluate(() => window.scrollY);
  const trigger = campaign.getByRole("link", {
    name: "Smoothing Air Dry Cream",
    exact: true,
  });
  await trigger.click();
  await expect(page).toHaveURL(/\/products\/home-air-dry-cream$/);
  await expect(
    page.getByRole("heading", {
      name: "Smoothing Air Dry Cream",
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("main.home-page")).toHaveAttribute(
    "data-feed",
    "recent-products",
  );
  await expect
    .poll(async () => Math.round((await campaign.boundingBox())?.y ?? -1))
    .toBe(56);
  const restoredScroll = await page.evaluate(() => window.scrollY);
  expect(restoredScroll).toBeGreaterThan(originalScroll);
  await expect(trigger).toBeFocused();

  await page.goForward();
  await expect(page).toHaveURL(/\/products\/home-air-dry-cream$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(async () => Math.round((await campaign.boundingBox())?.y ?? -1))
    .toBe(56);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(restoredScroll);
});

test("Deals categories remain reachable after feed scrolling and category Back navigation", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/");
  await page.getByRole("link", { name: "Deals", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Deals", exact: true }),
  ).toBeVisible();
  const filters = page.getByLabel("Deal categories", { exact: true });
  const thirdStore = page.locator(".deals-feed > section").nth(2);
  await thirdStore.evaluate((element) =>
    element.scrollIntoView({ block: "start" }),
  );
  await expect.poll(async () => (await filters.boundingBox())?.y).toBe(0);
  await filters.getByRole("link", { name: "Men", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=Men$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/deals$/);
  await expect(filters).toBeInViewport();
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("Home dock fade preserves navigation, feed geometry and sibling containment", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-recent-shops");
  await page.goto("/?feed=recent-stores");
  const dock = page.locator(".floating-dock");
  // React stages streamed Home in a hidden container before removing fallback.
  await expect(page.locator(".home-loading")).toHaveCount(0);
  await expect(dock).toHaveCount(1);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(dock).toBeVisible();
    const geometry = await dock.evaluate((element) => {
      const fade = getComputedStyle(element, "::before");
      const blur = getComputedStyle(element, "::after");
      return {
        bottom: element.getBoundingClientRect().bottom,
        fadeWidth: parseFloat(fade.width),
        fadeHeight: parseFloat(fade.height),
        pointerEvents: fade.pointerEvents,
        blurPointerEvents: blur.pointerEvents,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.bottom).toBe(761);
    expect(geometry.fadeWidth).toBe(width);
    expect(geometry.fadeHeight).toBe(128);
    expect(geometry.pointerEvents).toBe("none");
    expect(geometry.blurPointerEvents).toBe("none");
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 393, height: 793 });
  const panel = page.locator(".recent-stores-panel");
  const before = await panel.boundingBox();
  expect(before?.height).toBe(630);
  await page.getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect
    .poll(() =>
      dock.evaluate((element) => getComputedStyle(element, "::before").content),
    )
    .toBe("none");
  await expect
    .poll(() =>
      dock.evaluate((element) => getComputedStyle(element, "::after").content),
    )
    .toBe("none");
  await page.goBack();
  await expect(page).toHaveURL(/\/\?feed=recent-stores$/);
  await expect(panel).toBeVisible();
  expect(await panel.boundingBox()).toEqual(before);
  await panel
    .getByRole("link", { name: "Recently viewed", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search\?view=recent$/);
});
