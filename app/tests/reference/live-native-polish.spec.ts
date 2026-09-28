import { expect, test } from "@playwright/test";

// Native inputs are separate from the runner's explicit frozen default.
test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await context.addCookies([
    {
      name: "shop-preview-onboarded",
      value: "1",
      url: String(test.info().project.use.baseURL),
    },
  ]);
  await page.setViewportSize({ width: 427, height: 876 });
});

test("native Saved empty grid reserves no phantom row and keeps its real action at source height", async ({
  page,
}) => {
  await page.goto("/saved");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".saved-grid")).toBeHidden();
  const heading = await page
    .getByRole("heading", {
      name: "You haven’t saved any items yet",
      exact: true,
    })
    .boundingBox();
  const action = await page
    .getByRole("link", { name: "Go shopping", exact: true })
    .boundingBox();
  expect(heading?.y).toBe(296);
  expect(action?.y).toBe(378);
  expect(action?.height).toBe(44);
  await expect(page.locator(".saved-sock-card")).toHaveCSS("transform", "none");
  await expect(page.locator(".saved-sock-card")).toHaveCSS(
    "border-width",
    "0px",
  );
  await page.getByRole("link", { name: "Go shopping", exact: true }).click();
  await expect(page.locator(".android-home")).toBeVisible();
});

test("native product fade does not wash out Add to cart and never copies the frozen avatar ring", async ({
  page,
}) => {
  await page.goto("/products/live-belle-11");
  await expect(page.locator(".android-product")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const add = page.getByRole("button", { name: "Add to cart", exact: true });
  await expect(add).toHaveCSS("background-image", "none");
  await expect(add).toHaveCSS("background-color", "rgb(84, 51, 235)");
  await expect(page.locator(".product-underlay > .store-row img")).toHaveCSS(
    "outline-style",
    "none",
  );
  expect(
    await page
      .locator(".android-product")
      .evaluate((e) => getComputedStyle(e, "::after").height),
  ).toBe("64px");
  await add.click();
  await expect(
    page.getByRole("button", { name: "Added to cart", exact: true }),
  ).toBeVisible();
});

test("verified native brand and display faces do not replace body or frozen typography", async ({
  page,
  request,
}) => {
  for (const face of ["bold", "display"]) {
    const response = await request.get(`/api/reference-font/${face}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("font/otf");
    expect(response.headers()["cache-control"]).toContain("private");
    expect(response.headers()["x-robots-tag"]).toBe("noindex");
  }
  expect(
    (await request.get("/api/reference-font/not-allowlisted")).status(),
  ).toBe(404);
  await page.goto("/stores/live-belleboxbg");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".store-brand > span")).toHaveCSS(
    "font-family",
    "ShopAndroidBrand, ShopAndroidRoboto, Roboto, Arial, sans-serif",
  );
  await expect(
    page.locator(".product-copy .review-rating-stars-fill"),
  ).toHaveCSS("color", "rgb(0, 0, 0)");
  const secondRow = await page
    .locator('[data-product-id="live-belle-12"] .product-media')
    .boundingBox();
  expect(secondRow?.y).toBeCloseTo(585.5, 0);
  await page.goto("/orders");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".order-empty-source h2")).toHaveCSS(
    "font-family",
    "ShopAndroidDisplay, ShopAndroidRoboto, Roboto, Arial, sans-serif",
  );
  await expect(page.locator(".order-empty-source p")).toHaveCSS(
    "font-family",
    "ShopAndroidRoboto, Roboto, Arial, sans-serif",
  );
  await page.context().addCookies([
    {
      name: "shop-reference-scenario",
      value: "reference-default",
      url: String(test.info().project.use.baseURL),
    },
  ]);
  await page.goto("/stores/kitsch");
  await expect(page.locator(".android-store")).toHaveCount(0);
  expect(
    await page
      .locator(".store-page")
      .evaluate((e) => getComputedStyle(e).fontFamily),
  ).not.toContain("ShopAndroidBrand");
});
