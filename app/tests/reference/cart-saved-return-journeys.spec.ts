import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const cart = (page: Page) =>
  page.getByRole("dialog", { name: "Your cart", exact: true });
const openCart = (page: Page) =>
  page.getByRole("button", { name: "Open cart", exact: true });
const back = (page: Page) =>
  page.getByRole("button", { name: "Go back", exact: true });

test("Saved collection returns to its stable tile and source scroll through dock and native history", async ({
  page,
}) => {
  await useReferenceScenario(page, "saved-library");
  await page.goto("/saved");
  const tile = page.getByRole("button", { name: "Private Favs", exact: true });
  await expect(tile).toBeVisible();
  await expect(tile).toBeEnabled();
  await tile.evaluate((element) => {
    window.scrollTo({ top: 100, behavior: "instant" });
    (element as HTMLElement).focus({ preventScroll: true });
  });
  const y = await page.evaluate(() => scrollY);
  await expect(tile).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/collection=source-favs/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await back(page).click();
  await expect(page).toHaveURL("/saved");
  await expect(tile).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Favs", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(tile).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Collection options", exact: true })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Collection options", exact: true }),
  ).toBeFocused();
  await page.goBack();
  await expect(tile).toBeFocused();
});

test("Saved collection return restores the selected tile in a horizontally scrolled rail", async ({
  page,
}) => {
  await useReferenceScenario(page, "saved-library");
  await page.goto("/saved");
  for (const name of ["Second collection", "Third collection"]) {
    await page
      .getByRole("button", { name: "Create collection", exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "Collection name", exact: true })
      .fill(name);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await back(page).click();
    await expect(page).toHaveURL("/saved");
  }
  const tile = page.getByRole("button", {
    name: "Private Third collection",
    exact: true,
  });
  await tile.scrollIntoViewIfNeeded();
  const x = await page
    .locator(".collection-rail")
    .evaluate((element) => element.scrollLeft);
  expect(x).toBeGreaterThan(0);
  await tile.click();
  await back(page).click();
  await expect(tile).toBeFocused();
  await expect
    .poll(() =>
      page
        .locator(".collection-rail")
        .evaluate((element) => element.scrollLeft),
    )
    .toBe(x);
});

test("Saved cart product and checkout navigation return to the actual cart opener with retained totals", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-bag");
  await page.goto("/saved");
  await openCart(page).click();
  await cart(page)
    .getByRole("link", { name: "Shampoo Bar Bag", exact: true })
    .click();
  await expect(page).toHaveURL("/products/shampoo-bag");
  await back(page).click();
  await expect(page).toHaveURL("/saved");
  await expect(openCart(page)).toBeFocused();
  await expect(cart(page)).not.toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL("/products/shampoo-bag");
  await page.goBack();
  await expect(openCart(page)).toBeFocused();
  await openCart(page).click();
  await expect(cart(page).locator(".cart-subtotal")).toContainText("$3.65");
  await cart(page)
    .getByRole("link", { name: "Continue to checkout", exact: true })
    .click();
  await expect(page).toHaveURL("/checkout?store=kitsch");
  await expect(
    page.getByRole("button", { name: "Pay now $10.82", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/saved");
  await expect(openCart(page)).toBeFocused();
  await openCart(page).click();
  await expect(cart(page).locator(".cart-stepper output")).toHaveText("1");
});

test("same-product Cart title dismisses exactly its sheet entry and next Back leaves the product", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-bag");
  await page.goto("/saved");
  await openCart(page).click();
  await cart(page)
    .getByRole("link", { name: "Shampoo Bar Bag", exact: true })
    .click();
  await expect(page).toHaveURL("/products/shampoo-bag");
  await page.locator(".quantity").scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await openCart(page).click();
  await cart(page)
    .getByRole("link", { name: "Shampoo Bar Bag", exact: true })
    .click();
  await expect(cart(page)).not.toBeVisible();
  await expect(page).toHaveURL("/products/shampoo-bag");
  await expect(openCart(page)).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  await back(page).click();
  await expect(page).toHaveURL("/saved");
  await expect(openCart(page)).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL("/products/shampoo-bag");
  await expect(cart(page)).not.toBeVisible();
});

test("Cart exact-origin comparison preserves query navigation and modifier clicks", async ({
  page,
  context,
}) => {
  await useReferenceScenario(page, "cart-bag");
  await page.goto("/products/shampoo-bag?entry=saved");
  await openCart(page).click();
  const length = await page.evaluate(() => history.length);
  const popupPromise = context.waitForEvent("page");
  await cart(page)
    .getByRole("link", { name: "Shampoo Bar Bag", exact: true })
    .click({ modifiers: ["Control"] });
  const popup = await popupPromise;
  await popup.waitForURL("**/products/shampoo-bag");
  await popup.close();
  await expect(cart(page)).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(length);
  await cart(page)
    .getByRole("link", { name: "Shampoo Bar Bag", exact: true })
    .click();
  await expect(page).toHaveURL("/products/shampoo-bag");
  await expect(cart(page)).not.toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/products/shampoo-bag?entry=saved");
  await expect(openCart(page)).toBeFocused();
});

test("nested cart offer closes back to its own trigger and standalone cart links retain their source", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-bag");
  await page.goto("/saved");
  await openCart(page).click();
  const addItems = cart(page).getByRole("button", {
    name: /Add .*exclusive offer Add items/,
  });
  await addItems.click();
  await expect(
    page.getByRole("dialog", { name: /exclusive offer/ }),
  ).toBeVisible();
  await page.goBack();
  await expect(cart(page)).toBeVisible();
  await expect(addItems).toBeFocused();
  await page.goBack();
  await expect(openCart(page)).toBeFocused();
  await page.goto("/cart");
  const product = page.getByRole("link", {
    name: "Shampoo Bar Bag",
    exact: true,
  });
  await product.click();
  await expect(page).toHaveURL("/products/shampoo-bag");
  await page.goBack();
  await expect(page).toHaveURL("/cart");
  await expect(product).toBeFocused();
});

test("Cart footer and its actual close control remain viewport-bound at every requested width", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-bag");
  for (const [width, height] of [
    [320, 793],
    [393, 793],
    [430, 793],
    [467, 853],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/products/shampoo-bag");
    await openCart(page).click();
    const close = cart(page).getByRole("button", {
      name: "Close cart",
      exact: true,
    });
    await expect(close).toBeInViewport();
    await expect
      .poll(async () => (await close.boundingBox())?.y)
      .toBe(height - 86);
    expect(
      await cart(page).evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await close.click();
    await expect(cart(page)).not.toBeVisible();
    await expect(openCart(page)).toBeFocused();
  }
});
