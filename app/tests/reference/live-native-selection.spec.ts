import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});

test("native Jordan uses its six clean photographs and all 26 observed sizes", async ({
  page,
}) => {
  await page.goto("/explore");
  const shelf = page.locator('[data-product-id="live-explore-jordan-legend"]');
  await expect(shelf.locator(".product-copy")).toContainText("€311.00");
  await shelf.locator(".product-copy").click();
  await page.waitForURL("**/products/live-explore-jordan-legend");
  await expect(page.locator(".product-price")).toHaveText("$363.87");
  await expect(page.locator(".product-gallery img")).toHaveCount(6);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.evaluate(() => document.fonts.ready);
  const heading = await page.locator(".product-heading h1").boundingBox();
  const suffix = await page
    .locator(".native-product-title-suffix")
    .boundingBox();
  expect(suffix!.y - heading!.y).toBeGreaterThan(14);
  const sizeWidth = await page
    .locator('[data-option-name="Size"] .native-options-pills > button')
    .first()
    .boundingBox();
  expect(sizeWidth!.width).toBeCloseTo(189.5, 0);
  await expect(page.locator(".native-product-title-suffix")).toHaveText(
    "CT8012-104",
  );
  await expect(
    page.getByRole("button", { name: "Increase quantity" }),
  ).toBeDisabled();
  const more = page.getByRole("button", {
    name: "View 23 more Size options",
    exact: true,
  });
  await more.click();
  const sheet = page.getByRole("dialog", { name: "Size", exact: true });
  await expect(sheet.locator(".native-color-list > button")).toHaveCount(26);
  const target = sheet.getByRole("button", {
    name: "Men's US 11 / Women's US 12.5 / UK 10 / EU 45 / JP 29",
    exact: true,
  });
  await target.click();
  await expect(sheet).not.toBeVisible();
  await expect(page.locator(".product-price")).toHaveText("$272.61");
  const visible = page.getByRole("button", {
    name: "Size: Men's US 11 / Women's US 12.5 / UK 10 / EU 45 / JP 29",
    exact: true,
  });
  await expect(visible).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(visible).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".product-price")).toHaveText("$272.61");
  await page
    .getByRole("button", { name: "View product image 1", exact: true })
    .click();
  const photos = page.getByRole("group", {
    name: "Product photos. Use Left and Right arrow keys to change photo.",
  });
  await photos.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect(photos.locator("img")).toHaveAttribute(
    "src",
    "/api/reference-media/live-lower-jordan-6",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "View product image 6", exact: true }),
  ).toBeFocused();
});

test("native Tide remains selectable while purchase actions are absent", async ({
  page,
}) => {
  await page.goto("/products/live-explore-bubble-blanket");
  await page.getByRole("button", { name: "Color: Tide", exact: true }).click();
  await expect(page.locator(".native-product-colors legend")).toHaveText(
    "Color: Tide",
  );
  await expect(page.locator(".product-price")).toHaveText("€282.95 Sold out");
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Increase quantity" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Add to saved items", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Color: Creme", exact: true }).click();
  await expect(page.locator(".product-price")).toHaveText("€282.95");
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeEnabled();
});

test("native option state follows Back and Forward rather than stale local selection", async ({
  page,
}) => {
  await page.goto("/products/live-explore-perfect-pot");
  await page.getByRole("button", { name: "Color: Char", exact: true }).click();
  // A shared/direct-link history entry must produce the same selected option.
  await page.evaluate(() =>
    window.history.pushState(null, "", "?variant=live-explore-pot-clay"),
  );
  await expect(page.locator(".native-product-colors legend")).toHaveText(
    "Color: Clay",
  );
  await expect(page.locator(".product-price strong")).toHaveText("Sold out");
  await page.goBack();
  await expect(page.locator(".native-product-colors legend")).toHaveText(
    "Color: Char",
  );
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeEnabled();
  await page.goForward();
  await expect(page.locator(".native-product-colors legend")).toHaveText(
    "Color: Clay",
  );
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toHaveCount(0);
});
