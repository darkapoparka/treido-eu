import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
  await page.goto("/profile");
});

test("guest Profile contains every observed settings row and connected Support return", async ({
  page,
}) => {
  const rows = page.locator(".guest-profile-settings a");
  await expect(rows).toHaveText([
    "Notifications",
    "Data & privacy",
    "Development mode",
    "Support",
  ]);
  const support = page.getByRole("link", { name: "Support", exact: true });
  await support.click();
  await page.waitForURL("**/support");
  await expect(page.locator(".android-support")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Support Chat/ }),
  ).toHaveAttribute("href", "/support/chat");
  await expect(page.getByRole("link", { name: /Help Center/ })).toHaveAttribute(
    "href",
    "https://help.shop.app/en/shop",
  );
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.waitForURL("**/profile");
  await expect(support).toBeFocused();
  await expect(support).toBeInViewport();
  await expect(page.locator(".profile-footer")).toContainText(
    "Version 3.4.0 (493466)",
  );
  await expect(
    page.locator(".profile-footer").getByRole("link", { name: "Licenses" }),
  ).toBeVisible();
});

test("development entry reproduces the disabled native switch and restores its actual opener", async ({
  page,
}) => {
  const opener = page.getByRole("link", {
    name: "Development mode",
    exact: true,
  });
  await opener.click();
  await page.waitForURL("**/account/development");
  const toggle = page.getByRole("switch", { name: "Shop Minis" });
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByText("Build your own Shop Mini.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.waitForURL("**/profile");
  await expect(opener).toBeFocused();
  await page.goForward();
  await page.waitForURL("**/account/development");
  await expect(toggle).toBeDisabled();
});

for (const width of [320, 393, 427, 430]) {
  test(`guest settings and footer are reachable at ${width}px and short height`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 });
    const support = page.getByRole("link", { name: "Support", exact: true });
    await support.scrollIntoViewIfNeeded();
    await expect(support).toBeInViewport();
    const license = page
      .locator(".profile-footer")
      .getByRole("link", { name: "Licenses" });
    await license.scrollIntoViewIfNeeded();
    await expect(license).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: test.info().outputPath(`profile-${width}.png`),
    });
  });
}
