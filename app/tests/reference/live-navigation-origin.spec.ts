import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});
const selected = (page: import("@playwright/test").Page) =>
  page.locator('.floating-nav [aria-current="page"]');

test("Explore product and merchant excursions preserve the actual native tab through history and reload", async ({
  page,
}) => {
  await page.goto("/explore/curations/cozy-edit");
  const opener = page.locator(
    '[data-product-id="live-cozy-wake-light"] .product-copy',
  );
  await opener.click();
  await page.waitForURL("**/products/live-cozy-wake-light");
  await expect(selected(page)).toHaveAttribute("aria-label", "Explore");
  await page.locator(".store-row-identity").click();
  await page.waitForURL("**/stores/live-cozy-store-tala-us");
  await expect(selected(page)).toHaveAttribute("aria-label", "Explore");
  await page.goBack();
  await page.waitForURL("**/products/live-cozy-wake-light");
  await expect(selected(page)).toHaveAttribute("aria-label", "Explore");
  await page.goForward();
  await page.waitForURL("**/stores/live-cozy-store-tala-us");
  await expect(selected(page)).toHaveAttribute("aria-label", "Explore");
  await page.reload();
  await expect(selected(page)).toHaveAttribute("aria-label", "Explore");
  await page.goBack();
  await page.waitForURL("**/products/live-cozy-wake-light");
  await page.goBack();
  await page.waitForURL("**/explore/curations/cozy-edit");
  await expect(opener).toBeFocused();
});

test("direct native product entry keeps Home selected", async ({ page }) => {
  await page.goto("/products/live-cozy-wake-light");
  await expect(selected(page)).toHaveAttribute("aria-label", "Home");
  await page.locator(".store-row-identity").click();
  await page.waitForURL("**/stores/live-cozy-store-tala-us");
  await expect(selected(page)).toHaveAttribute("aria-label", "Home");
});

test("Chat product returns preserve Chat", async ({ page }) => {
  await page.goto("/products/live-cozy-wake-light");
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.waitForURL("**/search");
  const result = page
    .locator('[data-recent-id="live-cozy-wake-light"] .product-media a')
    .first();
  await result.click();
  await page.waitForURL("**/products/live-cozy-wake-light");
  await expect(selected(page)).toHaveAttribute("aria-label", "Chat");
  await page.reload();
  await expect(selected(page)).toHaveAttribute("aria-label", "Chat");
  await page.goBack();
  await page.waitForURL("**/search");
  await page.locator(".android-search").waitFor();
  await expect(result).toBeFocused();
});

for (const width of [320, 393, 427, 430]) {
  test(`native PDP disclosures retain flat surfaces and measured review rhythm at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 876 });
    await page.goto("/products/live-cozy-wake-light");
    const reviews = page.locator(".pdp-review-preview");
    await reviews.scrollIntoViewIfNeeded();
    await expect(reviews).toHaveCSS("border-radius", "0px");
    await expect(reviews).toHaveCSS("box-shadow", "none");
    await expect(reviews).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".pdp-delivery")).toHaveCSS("box-shadow", "none");
    await expect(page.locator(".pdp-preview-reviewer")).toHaveCSS(
      "padding-top",
      "0px",
    );
    for (const bar of await page.locator(".rating-bars > div").all())
      await expect(bar).toHaveCSS("height", "12px");
    const summary = reviews.locator("summary");
    await summary.click();
    await expect(reviews).not.toHaveAttribute("open", "");
    await summary.press("Enter");
    await expect(reviews).toHaveAttribute("open", "");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
