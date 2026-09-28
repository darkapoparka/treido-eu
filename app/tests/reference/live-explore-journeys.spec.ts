import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});

test("live Explore preserves editorial geometry and connected More/Less categories", async ({
  page,
}) => {
  await page.goto("/explore");
  const hero = page.locator(".editorial-hero").first();
  await expect(hero).toContainText("Architectural Digest's cozy edit");
  await expect(
    page
      .locator(".floating-nav")
      .getByRole("link", { name: "Chat", exact: true }),
  ).toHaveAttribute("href", "/search");
  await expect(hero.locator("img")).toHaveJSProperty("complete", true);
  await expect(hero.locator("img")).toHaveJSProperty("naturalWidth", 1024);
  const box = await hero.boundingBox();
  expect(box?.x).toBeCloseTo(16, 0);
  expect(box?.y).toBeCloseTo(76, 0);
  expect(box?.width).toBeCloseTo(387, 0);
  expect(box?.height).toBeCloseTo(218, 0);
  await expect(page.locator(".explore-categories > a")).toHaveCount(6);
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page).toHaveURL(/categories=all/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.locator(".explore-categories > a")).toHaveCount(11);
  await expect(
    page.getByRole("button", { name: "Less", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "Baby & toddler", exact: true }).click();
  // The source already has an h3 with this label. Wait for the actual route
  // before Back, not the source heading while the destination is streaming.
  await expect(page).toHaveURL(
    (url) => decodeURIComponent(url.pathname) === "/explore/Baby & toddler",
  );
  await expect(
    page.getByRole("heading", {
      name: "Baby & toddler",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/categories=all/);
  await expect(page.locator(".explore-categories > a")).toHaveCount(11);
  await page.getByRole("button", { name: "Less", exact: true }).click();
  await expect(page.locator(".explore-categories > a")).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: "More", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.screenshot({ path: test.info().outputPath("live-explore.png") });
});

test("live editorial opens from Explore and restores its source after sharing", async ({
  page,
  context,
}) => {
  await page.goto("/explore");
  const hero = page.locator(".editorial-hero").first();
  await hero.click();
  await expect(page).toHaveURL(/\/explore\/curations\/cozy-edit$/);
  await expect(
    page.getByRole("heading", {
      name: "The cozy edit by Architectural Digest",
    }),
  ).toBeVisible();
  await expect(page.locator(".android-curation-photo-credit")).toContainText(
    "Chris Mottalini",
  );
  const share = page.getByRole("button", {
    name: "Share The cozy edit",
    exact: true,
  });
  await expect(share.locator("svg path")).toHaveAttribute("d", /^M21 5a3/);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await share.click();
  const dialog = page.getByRole("dialog", {
    name: "Sharing link",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Link to this edit")).toHaveValue(
    /\/explore\/curations\/cozy-edit$/,
  );
  await dialog.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    page.url(),
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(share).toBeFocused();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(hero).toBeInViewport();
});

test("editorial preserves all 18 products, source title fit, Save and product return", async ({
  page,
}) => {
  await page.goto("/explore/curations/cozy-edit");
  await expect(
    page.locator(".android-curation-products .product-card"),
  ).toHaveCount(18);
  const first = page.locator('[data-product-id="live-cozy-wake-light"]');
  await first.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const title = first.locator(".product-copy strong");
  await expect(title).toHaveText("Wake Sleep Light in Pebble White");
  expect(
    await title.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await expect(first.locator(".product-copy")).toContainText("$295.00");
  await expect(
    page.locator('[data-product-id="live-cozy-amber-glasses"] .product-copy'),
  ).toContainText("£28.00");
  await first
    .getByRole("button", {
      name: "Save Wake Sleep Light in Pebble White",
      exact: true,
    })
    .click();
  await expect(
    first.getByRole("button", {
      name: "Unsave Wake Sleep Light in Pebble White",
      exact: true,
    }),
  ).toBeVisible();
  const opener = first.locator(".product-copy");
  await opener.click();
  await expect(page).toHaveURL(/\/products\/live-cozy-wake-light$/);
  await expect(
    page.getByRole("heading", {
      name: "Wake Sleep Light in Pebble White",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/explore\/curations\/cozy-edit$/);
  await expect(opener).toBeFocused();
  await expect(opener).toBeInViewport();
  await expect(
    first.getByRole("button", {
      name: "Unsave Wake Sleep Light in Pebble White",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator(".android-curation-quote figcaption").nth(1),
  ).toHaveText("Abbey Stone, AD senior shopping director");
});

test("editorial requests only decodable recordings and preserves the verified bedroom still", async ({
  page,
  request,
}) => {
  const badRequests: string[] = [];
  page.on("requestfailed", (req) => {
    if (req.url().includes("/api/reference-video/"))
      badRequests.push(req.url());
  });
  await page.goto("/explore/curations/cozy-edit");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const id of ["living", "corner"]) {
    const video = page.locator(`video[data-video-key="live-cozy-film-${id}"]`);
    await video.scrollIntoViewIfNeeded();
    await expect(video).toHaveAttribute("data-video-ready", "true", {
      timeout: 12000,
    });
    expect(
      await video.evaluate(
        (element: HTMLVideoElement) =>
          Number.isFinite(element.duration) &&
          element.duration > 0 &&
          element.error === null,
      ),
    ).toBe(true);
    await expect
      .poll(
        () =>
          video.evaluate((element: HTMLVideoElement) => element.currentTime),
        { timeout: 12000 },
      )
      .toBeGreaterThan(0.05);
    const range = await request.get(
      `/api/reference-video/live-cozy-film-${id}`,
      { headers: { Range: "bytes=0-31" } },
    );
    expect(range.status()).toBe(206);
    expect(range.headers()["content-type"]).toBe("video/webm");
    expect((await range.body()).length).toBe(32);
  }
  const still = page.locator(
    '.android-curation-film[data-media-state="source-still"]',
  );
  await still.scrollIntoViewIfNeeded();
  await expect(still.locator("video")).toHaveCount(0);
  await expect(still.locator("img")).toHaveJSProperty("naturalWidth", 1185);
  expect(
    (await request.get("/api/reference-video/live-cozy-film-bedroom")).status(),
  ).toBe(404);
  await expect(
    page.locator('video[data-video-key="live-cozy-film-living"]'),
  ).toHaveJSProperty("paused", true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".android-curation-film video")).toHaveCount(0);
  await expect(page.locator(".android-curation-film img")).toHaveCount(3);
  expect(badRequests).toEqual([]);
});

for (const [width, height] of [
  [320, 568],
  [393, 793],
  [427, 876],
  [430, 568],
  [430, 932],
]) {
  test(`editorial content, fixed actions and source stills stay contained at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/explore/curations/cozy-edit");
    await page.evaluate(() => document.fonts.ready);
    for (const section of await page
      .locator(".android-curation-section")
      .all()) {
      await section.locator("h2").scrollIntoViewIfNeeded();
      const box = await section.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await expect(
      page.getByRole("button", { name: "Share The cozy edit", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Go back", exact: true }),
    ).toBeInViewport();
    const caption = page.locator(".android-curation-quote figcaption").last();
    await caption.scrollIntoViewIfNeeded();
    await expect(caption).toBeInViewport();
    await page.screenshot({
      path: test.info().outputPath(`editorial-tail-${width}-${height}.png`),
    });
  });
}

test("escaped category names render once-decoded labels and Search links", async ({
  page,
}) => {
  for (const category of [
    "Fitness & nutrition",
    "Food & drinks",
    "Sporting goods",
  ]) {
    await page.goto(`/explore/${encodeURIComponent(category)}`);
    await expect(
      page.getByRole("heading", { name: category, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(
      page
        .locator(".category-rail")
        .getByRole("link", { name: "Shop all", exact: true }),
    ).toHaveAttribute("href", `/search?q=${encodeURIComponent(category)}`);
  }
});

test("editorial native dock preserves Chat and recent-product Home behavior", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "shop-preview-onboarded",
      value: "1",
      url: String(test.info().project.use.baseURL),
    },
  ]);
  await page.goto("/explore/curations/cozy-edit");
  await page
    .locator('[data-product-id="live-cozy-wake-light"] .product-media a')
    .click();
  await expect(page).toHaveURL(/\/products\/live-cozy-wake-light$/);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/explore\/curations\/cozy-edit$/);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(
    nav.getByRole("link", { name: "Chat", exact: true }),
  ).toHaveAttribute("href", "/search");
  await expect(
    nav.getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("href", "/?home=recent");
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForURL(
    (url) => url.pathname === "/" && url.searchParams.get("home") === "recent",
  );
  await expect(page).toHaveURL(/\/\?home=recent$/);
  await expect(
    page
      .locator('.android-home [data-product-id="live-cozy-wake-light"]')
      .first(),
  ).toBeVisible();
});

test("high-density editorial product galleries decode their allowlisted 3x source", async ({
  browser,
  request,
}) => {
  const original = await request.get(
    "/api/reference-media/live-cozy-wake-light",
  );
  const retina = await request.get(
    "/api/reference-media/live-cozy-wake-light-3x",
  );
  expect(original.status()).toBe(200);
  expect(retina.status()).toBe(200);
  expect(await retina.body()).toEqual(await original.body());
  expect(
    (await request.get("/api/reference-media/live-cozy-unknown-3x")).status(),
  ).toBe(404);
  const context = await browser.newContext({
    viewport: { width: 427, height: 876 },
    deviceScaleFactor: 3,
    // A manually created context otherwise inherits the frozen project seed.
    storageState: { cookies: [], origins: [] },
  });
  try {
    const page = await context.newPage();
    await page.goto(
      String(test.info().project.use.baseURL) +
        "/products/live-cozy-wake-light",
    );
    const image = page.locator(".product-gallery img").first();
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBeGreaterThan(0);
    expect(
      await image.evaluate((element: HTMLImageElement) => element.currentSrc),
    ).toContain("live-cozy-wake-light-pdp-3x");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(427);
    await page.screenshot({
      path: test.info().outputPath("editorial-pdp-retina.png"),
    });
  } finally {
    await context.close();
  }
});
