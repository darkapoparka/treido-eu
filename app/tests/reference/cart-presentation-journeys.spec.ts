import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("cart keeps its original product context and restores scroll and focus after Back", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-bag");
  await page.goto("/products/shampoo-bag");
  await page.locator(".quantity").evaluate((element) => {
    window.scrollTo(
      0,
      window.scrollY + element.getBoundingClientRect().top - 10,
    );
  });
  const originalScroll = await page.evaluate(() => window.scrollY);
  const trigger = page.getByRole("button", { name: "Open cart", exact: true });
  await trigger.click();
  const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(cart).toBeVisible();
  const preview = page.locator(".product-underlay");
  await expect.poll(async () => (await preview.boundingBox())?.y).toBe(0);
  await expect
    .poll(() => preview.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(originalScroll);
  const hero = await preview.locator(".product-gallery").boundingBox();
  expect(hero?.y).toBeLessThan(0);
  await page.goBack();
  await expect(cart).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - originalScroll),
    )
    .toBeLessThan(2);
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeInViewport();
});

test("cart card, save-for-later controls and continuation stay inside narrow viewports", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-bag");
  for (const width of [320, 393, 430, 472]) {
    await page.setViewportSize({ width, height: 793 });
    await page.goto("/products/shampoo-bag");
    await page.getByRole("button", { name: "Open cart", exact: true }).click();
    const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
    await expect(cart).toBeVisible();
    const bounds = await cart.boundingBox();
    const cartLeft = Math.max(0, (width - 430) / 2);
    expect(bounds?.x).toBe(cartLeft);
    expect(
      (bounds?.x ?? -1) + (bounds?.width ?? width + 1),
    ).toBeLessThanOrEqual(width);
    const seller = await cart.locator(".seller-cart").boundingBox();
    expect(seller?.x).toBe(cartLeft + 8);
    expect(
      (seller?.x ?? -1) + (seller?.width ?? width + 1),
    ).toBeLessThanOrEqual(width - 8);
    await expect(
      cart.getByRole("link", { name: "Continue to checkout", exact: true }),
    ).toBeInViewport();
    expect(
      await cart.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await cart
      .getByRole("button", { name: "Save for later", exact: true })
      .click();
    await expect(
      cart.getByRole("heading", { name: "Saved for later", exact: true }),
    ).toBeVisible();
    await expect(cart.locator(".cart-later-store-logo")).toBeVisible();
    expect(
      await cart.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await cart
      .getByRole("button", { name: "Move to cart", exact: true })
      .click();
    await expect(
      cart.getByRole("link", { name: "Continue to checkout", exact: true }),
    ).toBeEnabled();
  }
});
