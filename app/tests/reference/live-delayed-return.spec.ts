import { expect, test } from "@playwright/test";

test("a delayed native source return restores its control after the streamed page mounts", async ({
  context,
  page,
}) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
  await page.goto("/products/live-cozy-wake-light");
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.waitForURL("**/search");
  const opener = page
    .locator('[data-recent-id="live-cozy-wake-light"] .product-media a')
    .first();
  await opener.click();
  await page.waitForURL("**/products/live-cozy-wake-light");
  let delayed = 0;
  await page.route("**/search?*", async (route) => {
    // Exercise an uncached history return in production as well as development.
    if (route.request().headers()["next-router-prefetch"]) {
      await route.abort();
      return;
    }
    delayed += 1;
    await new Promise((resolve) => setTimeout(resolve, 4500));
    await route.continue();
  });
  await page.reload();
  await expect(
    page.locator('.floating-nav [aria-current="page"]'),
  ).toHaveAttribute("aria-label", "Chat");
  await page.goBack();
  await page.waitForURL("**/search");
  await page.locator(".android-search").waitFor();
  expect(delayed).toBeGreaterThan(0);
  await expect(opener).toBeFocused();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});
