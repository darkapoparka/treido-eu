import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const shea = "Shea Butter Exfoliating Body Wash";

test("the captured arrival entry keeps its offer after the real first-visit tip expires", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await useReferenceScenario(page, "kitsch-product-arrival");
  await page.goto("/stores/kitsch");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.locator("main img").evaluateAll(async (images) => {
    await document.fonts.ready;
    await Promise.all(
      images.map((image) => (image as HTMLImageElement).decode()),
    );
  });
  const fragments = page.locator(
    '[data-source-boundary="unidentified-store-product"]',
  );
  await expect(fragments).toHaveCount(2);
  await expect(fragments.locator("a,button,strong")).toHaveCount(0);
  await expect(page.locator(".store-all-products .product-card")).toHaveCount(
    4,
  );
  await expect(fragments.first().locator("img")).toHaveAttribute(
    "src",
    "/api/reference-media/store-arrival-tail-left",
  );
  await expect(fragments.last().locator("img")).toHaveAttribute(
    "src",
    "/api/reference-media/store-arrival-tail-right",
  );
  await page.locator(".store-grid-heading").evaluate((element) =>
    window.scrollTo({
      top: element.getBoundingClientRect().top + scrollY - 79,
      behavior: "instant",
    }),
  );
  await expect(page.locator(".store-category-navigation")).toHaveClass(
    /is-pinned/,
  );
  await expect(page.locator(".store-compact-promotion")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open cart", exact: true }),
  ).toHaveCount(0);
  await page
    .locator('#all-products a[href="/products/shea-butter"]')
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: shea, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".product-price-alert-tip")).toBeVisible();
  await expect(page.locator(".product-deal")).toContainText(
    "Save $15 when you spend $50",
  );
  await expect(page.locator(".product-underlay > .store-row")).toContainText(
    "194.9K",
  );
  await expect(page.locator(".product-price-alert-tip")).not.toBeVisible({
    timeout: 7000,
  });
  await expect(page.locator(".product-deal")).toContainText(
    "Save $15 when you spend $50",
  );
  await expect(page.locator(".product-underlay > .store-row")).toContainText(
    "194.9K",
  );
  await page.locator(".product-deal").click();
  await expect(
    page.getByRole("dialog", { name: "Offer details", exact: true }),
  ).toContainText("Save $15 when you spend $50");
});

test("the separately captured settled entry starts at 20/195K without borrowing a Follow seed", async ({
  page,
}) => {
  await useReferenceScenario(page, "kitsch-product-settled");
  await page.goto("/products/shea-butter");
  await expect(
    page.getByRole("heading", { name: shea, exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await expect(page.locator(".product-price-alert-tip")).toHaveCount(0);
  await expect(page.locator(".product-deal")).toContainText(
    "Save $20 when you spend $50",
  );
  await expect(page.locator(".product-underlay > .store-row")).toContainText(
    "195K",
  );
  await page.reload();
  await expect(page.locator(".product-deal")).toContainText(
    "Save $20 when you spend $50",
  );
  await expect(page.locator(".product-underlay > .store-row")).toContainText(
    "195K",
  );
  await expect(page.locator(".product-price-alert-tip")).toHaveCount(0);
});

test("the captured bag delivery entry preserves its followed shop and one cart line", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await useReferenceScenario(page, "kitsch-bag-following-cart");
  await page.goto("/products/shampoo-bag");
  await expect(
    page.getByRole("heading", { name: "Shampoo Bar Bag", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();

  const following = page
    .locator(".pdp-store-card")
    .getByRole("button", { name: "Following", exact: true });
  await expect(following).toHaveAttribute("aria-pressed", "true");
  const cartTrigger = page.getByRole("button", {
    name: "Open cart",
    exact: true,
  });
  await expect(cartTrigger).toBeVisible();
  await expect(page.locator(".dock-cart-count")).toHaveText("1");

  await cartTrigger.click();
  const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(cart).toBeVisible();
  await expect(
    cart.getByText("Shampoo Bar Bag", { exact: true }).first(),
  ).toBeVisible();
  await expect(cart.locator(".seller-cart output")).toHaveText("1");
  await page.goBack();
  await expect(cart).not.toBeVisible();
  await expect(cartTrigger).toBeFocused();
  await expect(following).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".dock-cart-count")).toHaveText("1");

  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/shampoo-bag");
  await expect(
    page
      .locator(".pdp-store-card")
      .getByRole("button", { name: "Follow", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Open cart", exact: true }),
  ).toHaveCount(0);
});

test("saving in the later captured offer entry changes membership without changing the offer", async ({
  page,
}) => {
  await useReferenceScenario(page, "kitsch-product-saving-offer");
  await page.goto("/products/shea-butter");
  await expect(
    page.getByRole("heading", { name: shea, exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  const deal = page.locator(".product-deal");
  const store = page.locator(".product-underlay > .store-row");
  await expect(deal).toContainText("20% off your order");
  await expect(deal).toContainText("Applied at checkout");
  await expect(store).toContainText("195.2K");
  await expect(
    page.getByText("Arrives as soon as Sun, Aug 2", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".product-price")).toHaveText("$14.00");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Save to collection", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(page.locator(".product-saved-toast")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save product", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(deal).toContainText("20% off your order");
  await expect(store).toContainText("195.2K");
  await expect(page.locator(".product-price")).toHaveText("$14.00");
  await deal.click();
  await expect(
    page.getByRole("dialog", { name: "Offer details", exact: true }),
  ).toContainText(
    "20% off your order. Applied at checkout. This is a reference offer.",
  );
});

test("the captured Shea recommendation entry retains Following without inventing a cart", async ({
  page,
}) => {
  await useReferenceScenario(page, "kitsch-shea-following");
  await page.goto("/products/shea-butter");
  const store = page.locator(".pdp-store-card");
  const follow = store.getByRole("button", { name: "Following", exact: true });
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Open cart", exact: true }),
  ).toHaveCount(0);
  await follow.click();
  await expect(
    store.getByRole("button", { name: "Follow", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await store
    .getByRole("button", { name: "Follow", exact: true })
    .press("Enter");
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await store.getByRole("link", { name: "Visit KITSCH", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/kitsch$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/products\/shea-butter$/);
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Open cart", exact: true }),
  ).toHaveCount(0);
});

test("bag recommendation photography keeps canonical products, saves and mobile dock controls", async ({
  page,
}) => {
  await useReferenceScenario(page, "kitsch-bag-following-cart");
  await page.goto("/products/shampoo-bag");
  const grid = page.locator(".product-underlay .product-grid");
  for (const id of ["black-conditioner-bag", "chocolate-body-bag"]) {
    const card = grid.locator(`[data-product-id="${id}"]`);
    await expect(card.locator("img")).toHaveAttribute(
      "src",
      `/api/reference-media/pdp-bag-${id}-recommendation`,
    );
    await expect(card.locator(".product-media a")).toHaveAttribute(
      "href",
      `/products/${id}`,
    );
    const save = card.getByRole("button", { name: /^Save / });
    await save.click();
    await expect(
      card.getByRole("button", { name: /^Unsave / }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const surface = page.locator(
      '.product-page[data-product-id="shampoo-bag"]',
    );
    expect(
      await surface.evaluate(
        (el) => getComputedStyle(el, "::after").pointerEvents,
      ),
    ).toBe("none");
    expect(
      await surface.evaluate((el) => getComputedStyle(el, "::after").position),
    ).toBe("fixed");
    expect(
      await surface.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const cart = page.getByRole("button", { name: "Open cart", exact: true });
    await cart.click();
    const overlay = page.getByRole("dialog", {
      name: "Your cart",
      exact: true,
    });
    await expect(overlay).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible();
    await expect(cart).toBeFocused();
  }
  await grid
    .locator('[data-product-id="black-conditioner-bag"] .product-media a')
    .click();
  await expect(page).toHaveURL(/\/products\/black-conditioner-bag$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/products\/shampoo-bag$/);
  await expect(grid.getByRole("button", { name: /^Unsave / })).toHaveCount(2);
});
