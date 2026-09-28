import { expect, test } from "@playwright/test";

test("cold pages do not expose controls before their handlers are ready", async ({
  page,
}) => {
  let release!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/chunks/**", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/orders/REF-1001", { waitUntil: "commit" });
    const surface = page.locator("[data-shop-interactive]");
    await expect(surface).toHaveAttribute("inert", "");
    await expect(page.locator(".order-more")).toBeVisible();
    // Role discovery differs across browser versions; verify hit testing itself.
    await expect(
      page.locator(".order-more").click({ trial: true, timeout: 400 }),
    ).rejects.toThrow();
    release();
    await expect(surface).not.toHaveAttribute("inert", "");
    await page
      .getByRole("button", { name: "Order options", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Your order", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close Your order" }).click();
    await expect(
      page.getByRole("button", { name: "Order options", exact: true }),
    ).toBeFocused();
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
