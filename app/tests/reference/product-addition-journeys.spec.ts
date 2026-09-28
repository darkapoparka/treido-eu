import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const product = "/products/shampoo-bag";

test("bag addition commits once, shows its flight and confirmation, then opens the offer through the cart", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 393, height: 793 });
  await useReferenceScenario(page, "home-welcome");
  await page.goto(product);
  const add = page.locator(".pdp-purchase-buttons .primary");
  const purchase = page.locator(".pdp-purchase-buttons");
  await expect(purchase).toHaveCSS("margin-top", "25px");
  await add.scrollIntoViewIfNeeded();
  await add.click({ trial: true });
  const scroll = await page.evaluate(() => scrollY);
  await add.click();
  await expect(page.locator(".dock-cart-count")).toHaveText("1");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const flight = page.locator(".product-addition-flight");
  await expect(flight).toBeVisible();
  await expect(flight).toHaveAttribute("aria-hidden", "true");
  await page.screenshot({
    path: test.info().outputPath("cart-flight.png"),
    animations: "allow",
  });
  await expect(add).toHaveAttribute("data-addition", "confirmed");
  await expect(add).toHaveText("Added to cart");
  await expect(page.getByRole("button", { name: "Buy now" })).toBeDisabled();
  await expect(purchase).toHaveCSS("margin-top", "29px");
  await expect(add).toHaveAttribute("data-addition", "idle");
  await expect(add).toHaveText("Add to cart");
  await expect(flight).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await expect(page.locator(".dock-cart-count")).toHaveText("1");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const cart = page.getByRole("button", { name: "Open cart", exact: true });
  await cart.click();
  const offer = page.getByRole("dialog", { name: /exclusive offer/ });
  await expect(offer).toBeVisible();
  await page.goBack();
  await expect(offer).not.toBeVisible();
  await expect(page).toHaveURL(/\/products\/shampoo-bag$/);
  await expect(cart).toBeFocused();
  await cart.click();
  await expect(
    page.getByRole("dialog", { name: "Your cart", exact: true }),
  ).toBeVisible();
});

test("reduced-motion keyboard additions announce the actual quantity without a flying image", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await useReferenceScenario(page, "home-welcome");
  await page.goto(product);
  // Unlike click(), focus()/press() do not wait for an inert hydration boundary
  // to become interactive. Establish a real keyboard starting position first.
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  const add = page.locator(".pdp-purchase-buttons .primary");
  await expect(add).toBeEnabled();
  await add.focus();
  await expect(add).toBeFocused();
  await add.press("Enter");
  await expect(add).toHaveAttribute("data-addition", "confirmed");
  await expect(page.locator(".product-addition-flight")).toHaveCount(0);
  await expect(page.locator(".dock-cart-count")).toHaveText("1");
  const announcement = page.locator('.product-page > [aria-live="polite"]');
  await expect(announcement).toHaveText("1 Shampoo Bar Bag added to cart");
  await expect(announcement.locator("span")).toHaveAttribute(
    "data-addition-announcement",
    "1",
  );
  await expect(add).toHaveAttribute("data-addition", "idle");
  await add.press("Enter");
  await expect(page.locator(".dock-cart-count")).toHaveText("2");
  await expect(announcement.locator("span")).toHaveAttribute(
    "data-addition-announcement",
    "2",
  );
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(add).toBeFocused();
});

test("leaving during a product flight removes its artwork and never opens a delayed offer on another page", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await useReferenceScenario(page, "home-welcome");
  await page.goto(product);
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.locator(".dock-cart-count")).toHaveText("1");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".product-addition-flight")).toHaveCount(0);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Shampoo Bar Bag" }),
  ).toBeVisible();
  await expect(page.locator(".dock-cart-count")).toHaveText("1");
  await expect(page.locator(".product-addition-flight")).toHaveCount(0);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("bag added purchase spacing remains contained at mobile widths", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await useReferenceScenario(page, "home-welcome");
    await page.goto(product);
    const purchase = page.locator(".pdp-purchase-buttons");
    await expect(purchase).toHaveCSS("margin-top", "25px");
    await page
      .getByRole("button", { name: "Add to cart", exact: true })
      .click();
    await expect(purchase).toHaveCSS("margin-top", "29px");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
