import { expect, test, type Locator, type Page } from "@playwright/test";

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
}
async function settledDialog(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
}

test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
  await page.goto("/onboarding?step=preferences&journey=new");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".home-merchant-shelves")).toBeVisible();
  await settle(page);
});

test("live guest Home has source merchant geometry and decoded photographs", async ({
  page,
}) => {
  const cards = page.locator(".home-merchant-shelves > section");
  await expect(cards).toHaveCount(4);
  await expect(cards.locator(".product-card")).toHaveCount(12);
  await expect(page.locator(".email-card, .home-keep-going")).toHaveCount(0);
  await expect(cards.first()).toHaveAttribute(
    "data-merchant-id",
    "live-belleboxbg",
  );
  const card = await cards.first().boundingBox();
  expect(card).toMatchObject({ x: 16, y: 56, width: 395, height: 358 });
  const photo = await cards
    .first()
    .locator(".product-media")
    .first()
    .boundingBox();
  expect(photo).toMatchObject({ x: 32, y: 164, width: 150, height: 150 });
  expect((await cards.nth(1).boundingBox())?.y).toBe(430);
  await expect(cards.first().locator(".price-badge").first()).toHaveText(
    "€17.99",
  );
  await expect(cards.first().locator(".price-badge del")).toHaveCount(0);
  await expect(cards.nth(3).locator(".price-badge del").first()).toHaveText(
    "€9.00",
  );
  expect(
    await page.evaluate(() => document.fonts.check("14px ShopAndroidRoboto")),
  ).toBe(true);
  await expect(page.locator(".android-home")).toHaveCSS(
    "font-family",
    /ShopAndroidRoboto/,
  );
  await page.screenshot({ path: test.info().outputPath("android-home.png") });
});

test("Android merchant options preserve anchor, staged dismissal, Hide and Undo", async ({
  page,
}) => {
  const card = page.locator('[data-merchant-id="live-belleboxbg"]');
  const trigger = card.getByRole("button", {
    name: "More options",
    exact: true,
  });
  await trigger.click();
  let dialog = page.getByRole("dialog", { name: "belleboxbg", exact: true });
  await settledDialog(dialog);
  const bounds = await dialog.boundingBox();
  expect(bounds?.width).toBe(240);
  expect(bounds?.height).toBe(208);
  expect(bounds?.x).toBeCloseTo(155, 0);
  await expect(
    dialog.getByRole("link", { name: "Visit shop", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("button", { name: "Not interested", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Not interested", exact: true });
  await settledDialog(dialog);
  expect(await dialog.boundingBox()).toMatchObject({
    x: 8,
    y: 576,
    width: 411,
    height: 300,
  });
  await dialog
    .getByRole("button", { name: "Products are too expensive", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    card.getByText("We’ll show you less like this", { exact: true }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(card.locator(".product-card")).toHaveCount(3);
  await trigger.click();
  await settledDialog(
    page.getByRole("dialog", { name: "belleboxbg", exact: true }),
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Back restores the merchant rail; a deliberate Home tab opens recent products", async ({
  page,
}) => {
  const card = page.locator('[data-merchant-id="live-belleboxbg"]');
  const rail = card.locator(".product-rail");
  await rail.evaluate((element) => {
    element.scrollLeft = 158;
  });
  await page.evaluate(() => window.scrollTo(0, 100));
  const scroll = await page.evaluate(() => window.scrollY);
  const railScroll = await rail.evaluate((element) => element.scrollLeft);
  const link = card.locator(
    '[data-product-id="live-belle-11"] .product-media a',
  );
  await link.click();
  await expect(page).toHaveURL(/\/products\/live-belle-11$/);
  await expect(
    page.getByRole("heading", {
      name: "BelleBox Limited Edition 11",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".android-recent-panel")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
  await expect
    .poll(() => rail.evaluate((element) => element.scrollLeft))
    .toBe(railScroll);
  await expect(link).toBeFocused();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page).toHaveURL(/\?home=recent$/);
  await expect(page.locator(".android-recent-panel")).toContainText(
    "Recently viewed",
  );
  await expect(
    page.locator('.android-recent-panel [data-product-id="live-belle-11"]'),
  ).toBeVisible();
});

test("native storefront and product keep Follow, filter, quantity and Save connected", async ({
  page,
}) => {
  await page
    .getByRole("link", { name: "Shop all at belleboxbg", exact: true })
    .click();
  await expect(page).toHaveURL(/\/stores\/live-belleboxbg$/);
  await settle(page);
  await expect(page.locator(".android-store")).toBeVisible();
  await expect(page.locator(".store-recommendations")).toHaveCount(0);
  await expect(page.locator(".product-grid .product-card")).toHaveCount(3);
  const brand = await page.locator(".store-brand > span").boundingBox();
  expect(brand?.y).toBeCloseTo(118, 0);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Filter store products", exact: true })
    .click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page
    .locator('[data-product-id="live-belle-11"] .product-media a')
    .click();
  await expect(page).toHaveURL(/\/products\/live-belle-11$/);
  await settle(page);
  const image = await page
    .locator(".product-gallery > button")
    .first()
    .boundingBox();
  expect(image?.y).toBe(64);
  expect(image?.width).toBe(395);
  expect(image?.height ?? 0).toBeGreaterThan(481);
  await page
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await expect(page.locator(".stepper output")).toHaveText("2");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  // Native guest Save is a reversible inline state, not the frozen collection picker.
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save product", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: "Open cart", exact: true }).click();
  const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
  await settledDialog(cart);
  await expect(cart.locator(".cart-subtotal strong")).toHaveText("€33.98");
  await page.keyboard.press("Escape");
  await expect(cart).not.toBeVisible();
});

for (const width of [320, 393, 427, 430]) {
  test(`Android Home and anchored options stay contained at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 });
    const card = page.locator('[data-merchant-id="live-belleboxbg"]');
    await expect(card).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect((await card.boundingBox())?.width).toBe(width - 32);
    await card
      .getByRole("button", { name: "More options", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "belleboxbg",
      exact: true,
    });
    await settledDialog(dialog);
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(16);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 16);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(552);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  });
}

test("private live media is bounded and native checkout never borrows USD provider data", async ({
  page,
  request,
}) => {
  const photo = await request.get("/api/reference-media/live-shelf-belle-11");
  expect(photo.status()).toBe(200);
  expect(photo.headers()["content-type"]).toBe("image/webp");
  expect(photo.headers()["cache-control"]).toContain("private");
  expect(
    (
      await request.get("/api/reference-media/live-not-in-the-manifest")
    ).status(),
  ).toBe(404);
  const font = await request.get("/api/reference-font");
  expect(font.status()).toBe(200);
  expect(font.headers()["x-robots-tag"]).toBe("noindex");
  await page.goto("/checkout?store=live-belleboxbg");
  await expect(
    page.getByText(
      "This merchant’s checkout has not been captured in this preview.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Shipping, taxes and payment details are unavailable. Nothing will be charged.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay now/ })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Back to shopping", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
});

test("native Home return shows the actual last product in its Still interested card", async ({
  page,
}) => {
  await page
    .locator('[data-product-id="live-freebubbles-3"] .product-media a')
    .click();
  await expect(page).toHaveURL(/\/products\/live-freebubbles-3$/);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page).toHaveURL(/\?home=recent$/);
  const card = page.locator(".android-still-interested");
  await expect(card).toHaveAttribute("data-merchant-id", "live-freebubbles");
  await expect(card.locator(".merchant-shop-all")).toContainText(
    "Still interested?",
  );
  await expect(card.locator(".android-interest-copy")).toContainText("€5.97");
  await expect(card.locator(".android-interest-copy del")).toHaveText("€8.99");
  await page.evaluate(() => window.scrollTo(0, 0));
  const row = await card.locator(".android-interest-product").boundingBox();
  expect(row?.x).toBe(32);
  expect(row?.y).toBe(534);
  expect(row?.height).toBe(160);
  await card.locator(".android-interest-copy").click();
  await expect(page).toHaveURL(/\/products\/live-freebubbles-3$/);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(card.locator(".android-interest-copy")).toBeFocused();
  for (const width of [320, 393, 427, 430]) {
    await page.setViewportSize({ width, height: 876 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const bounds = await card
      .locator(".android-interest-product")
      .boundingBox();
    expect(bounds?.x).toBe(32);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
      width - 32,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page.screenshot({
      path: test.info().outputPath(`still-interested-${width}.png`),
    });
  }
});
