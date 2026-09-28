import { expect, test } from "@playwright/test";
const item = "live-staud-davina-silk-top-pear";
const collection = "/explore/curations/staud";
test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});
test("native Staud carousel opens its full collection and restores the original rail", async ({
  page,
}) => {
  await page.goto("/explore");
  const opener = page.locator(".editorial-hero.staud-hero");
  await opener.scrollIntoViewIfNeeded();
  const offset = await opener.evaluate((e) => e.parentElement!.scrollLeft);
  await expect(opener).toContainText(
    "Timeless pieces with a contemporary touch.",
  );
  await opener.click();
  await page.waitForURL("**" + collection);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Brand Spotlight: Staud",
  );
  await expect(page.locator(".native-curation-grid .product-card")).toHaveCount(
    36,
  );
  await expect(
    page.locator(".native-curation-grid .product-copy strong").first(),
  ).toHaveText("DAVINA SILK TOP | PEAR");
  await expect(
    page.locator(".native-curation-grid .product-copy strong").last(),
  ).toHaveText("FELICITY DRESS | CIGAR");
  await expect(
    page.locator(".native-curation-grid .product-copy").first(),
  ).toContainText("€455.00");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.waitForURL("**/explore");
  await expect(opener).toBeFocused();
  await expect
    .poll(() => opener.evaluate((e) => e.parentElement!.scrollLeft))
    .toBeCloseTo(offset, 0);
});
test("Staud gallery, size, quantity and Save use real controls and retain their source return", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(collection);
  const opener = page.locator(`[data-product-id='${item}'] .product-copy`);
  await opener.click();
  await page.waitForURL("**/products/" + item);
  await expect(
    page.locator('.floating-nav [aria-current="page"]'),
  ).toHaveAttribute("aria-label", "Explore");
  await expect(page.locator(".product-gallery img")).toHaveCount(5);
  const first = page.getByRole("button", {
    name: "View product image 1",
    exact: true,
  });
  await first.click();
  const photos = page.getByRole("group", {
    name: "Product photos. Use Left and Right arrow keys to change photo.",
  });
  await photos.focus();
  await page.keyboard.press("End");
  await expect(photos.locator("img")).toHaveAttribute(
    "src",
    /davina-silk-top-pear-5$/,
  );
  await page.getByRole("button", { name: "Close product photos" }).click();
  await expect(
    page.getByRole("button", { name: "View product image 5", exact: true }),
  ).toBeFocused();
  await page
    .locator(".variants")
    .getByRole("button", { name: "2", exact: true })
    .click();
  await expect(
    page.locator(".variants").getByRole("button", { name: "2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".native-product-badge")).toHaveCount(0);
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.locator(".quantity output")).toHaveText("2");
  const save = page.getByRole("button", { name: "Save product", exact: true });
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.waitForURL("**" + collection);
  await expect(opener).toBeFocused();
  await expect(
    page.locator(`[data-product-id='${item}'] .save-button`),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
test("native Davina panels expose the captured copy without changing it into inventory facts", async ({
  page,
}) => {
  await page.goto("/products/" + item);
  await expect(page.locator(".pdp-delivery")).toContainText("Ship to 9000");
  const description = page.locator("details.pdp-description");
  const specifications = page.locator("details.native-product-specifications");
  await expect(description).not.toHaveAttribute("open", "");
  await expect(specifications).not.toHaveAttribute("open", "");
  await description.locator("summary").click();
  await expect(description.locator("p")).toContainText(
    "Returning in a silk update for the season",
  );
  await specifications.locator("summary").focus();
  await page.keyboard.press("Space");
  await expect(specifications).toHaveAttribute("open", "");
  await expect(specifications.locator("dt")).toHaveText([
    "Material",
    "Neckline",
    "Sleeve style",
    "Pattern",
    "Available sizes",
    "Care instructions",
  ]);
  await expect(specifications.locator("dd").first()).toHaveText(
    "70% acetate, 30% polyester (select variants: silk, lycra)",
  );
  await expect(specifications).toContainText("Summarized by Shop");
  await expect(specifications.locator(".native-summary-credit")).toHaveCSS(
    "display",
    "flex",
  );
  await expect(specifications.locator("dl > div").first()).toHaveCSS(
    "border-bottom-width",
    "1px",
  );
  await page
    .locator(".variants")
    .getByRole("button", { name: "4", exact: true })
    .click();
  await expect(description).toHaveAttribute("open", "");
  await expect(specifications).toHaveAttribute("open", "");
  await specifications.locator("summary").click();
  await expect(specifications).not.toHaveAttribute("open", "");
});
test("Staud Share is cancellable and category navigation returns to the same collection", async ({
  page,
}) => {
  await page.goto(collection);
  const share = page.getByRole("button", {
    name: "Share Brand Spotlight: Staud",
    exact: true,
  });
  await share.click();
  await expect(
    page.getByRole("dialog", { name: "Sharing link" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(share).toBeFocused();
  const category = page.locator(".native-curation-category");
  await category.click();
  await page.waitForURL("**/explore/Women");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Women");
  await page.goBack();
  await page.waitForURL("**" + collection);
  await expect(category).toBeFocused();
});
for (const width of [320, 393, 427, 430]) {
  test(`Staud collection and native variant panels stay usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(collection);
    await expect(
      page.locator(".native-curation-grid .product-card"),
    ).toHaveCount(36);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.locator(".native-curation-grid .product-copy").first().click();
    await page.waitForURL("**/products/" + item);
    await page
      .locator(".variants")
      .getByRole("button", { name: "16", exact: true })
      .click();
    await expect(
      page
        .locator(".variants")
        .getByRole("button", { name: "16", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.locator(".quantity output")).toHaveText("2");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: test.info().outputPath(`staud-${width}.png`),
    });
  });
}
test("Staud native PDP decodes its high-density originals and unknown media remains denied", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    viewport: { width: 427, height: 876 },
    deviceScaleFactor: 3,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const page = await context.newPage();
    await page.goto(
      String(test.info().project.use.baseURL) + "/products/" + item,
    );
    const image = page.locator(".product-gallery img").first();
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
    const pixels = await image.evaluate(async (e: HTMLImageElement) => {
      const bitmap = await createImageBitmap(
        await (await fetch(e.currentSrc)).blob(),
      );
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    });
    // Exact dimensions of the retained original; a 3x alias must not fabricate an upscale.
    expect(pixels).toEqual({ width: 955, height: 1433 });
    expect(
      (
        await request.get("/api/reference-media/live-staud-unknown-3x")
      ).status(),
    ).toBe(404);
  } finally {
    await context.close();
  }
});
