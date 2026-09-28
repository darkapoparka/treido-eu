import { expect, test } from "@playwright/test";
import { useReferenceScenario, addShampooBag } from "./helpers";

for (const width of [320, 393, 430]) {
  test(`empty Orders keeps its real cart control and modal return at ${width}px`, async ({
    page,
  }) => {
    await useReferenceScenario(page, "orders-empty");
    await page.setViewportSize({ width, height: 793 });
    await page.goto("/orders");
    const cart = page.getByRole("button", { name: "Open cart", exact: true });
    await expect(cart).toBeVisible();
    await expect(cart.locator(".dock-cart-count")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Orders", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await cart.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Your cart", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("empty");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(cart).toBeFocused();
    await cart.click();
    await page.goBack();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/orders$/);
    await expect(cart).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}

test("cart artwork and quantity stay inside the glyph and the same cart opens from Orders", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await addShampooBag(page);
  const cart = page.getByRole("button", { name: "Open cart", exact: true });
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const geometry = await cart.evaluate((button) => {
      const svg = button.querySelector("svg")!;
      const inverse = svg.getScreenCTM()!.inverse();
      const contained = [
        ...svg.querySelectorAll<SVGGraphicsElement>("path,circle,rect"),
      ].every((shape) => {
        const box = shape.getBBox();
        const matrix = inverse.multiply(shape.getScreenCTM()!);
        return [
          [box.x, box.y],
          [box.x + box.width, box.y + box.height],
        ].every(([x, y]) => {
          const point = new DOMPoint(x, y).matrixTransform(matrix);
          return (
            point.x >= -0.01 &&
            point.y >= -0.01 &&
            point.x <= 24.01 &&
            point.y <= 24.01
          );
        });
      });
      const count = button
        .querySelector(".dock-cart-count")!
        .getBoundingClientRect();
      const icon = svg.getBoundingClientRect();
      const targets = [
        ...document.querySelectorAll<HTMLElement>(
          ".floating-nav a, .floating-dock > button",
        ),
      ];
      return {
        contained,
        countInBasket:
          count.top > icon.top + 5 && count.bottom < icon.bottom - 1,
        targetsReachable: targets.every((target) => {
          const b = target.getBoundingClientRect();
          return (
            b.width >= 44 &&
            b.height >= 44 &&
            target.contains(
              document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
            )
          );
        }),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(geometry).toEqual({
      contained: true,
      countInBasket: true,
      targetsReachable: true,
      overflow: false,
    });
    await expect(cart.locator(".dock-cart-count")).toHaveText("1");
  }
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(cart).toBeVisible();
  await expect(cart.locator(".dock-cart-count")).toHaveText("1");
  await cart.click();
  const dialog = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(dialog).toContainText("Shampoo Bar Bag");
  await cart.evaluate((element) =>
    element.addEventListener(
      "focus",
      () => {
        element.dataset.sheetEntryAtFocus = String(
          Boolean(window.history.state?.shopSheet),
        );
      },
      { once: true },
    ),
  );
  await page.keyboard.press("Escape");
  await expect(cart).toBeFocused();
  await expect(cart).toHaveAttribute("data-sheet-entry-at-focus", "false");
  await page.goBack();
  await expect(page).toHaveURL(/\/products\/shampoo-bag$/);
  await expect(cart.locator(".dock-cart-count")).toHaveText("1");
});

test("delivered Orders keeps the source review card, grid and package hierarchy", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-delivered-history");
  await page.goto("/orders");
  const review = page.locator('.tracking-card[data-order-status="Delivered"]');
  await expect(review).toBeVisible();
  await expect(review.locator(".review-rating-stars-empty svg")).toHaveCount(5);
  await expect(page.locator(".orders-past img")).toHaveAttribute(
    "src",
    "/api/reference-media/order-manual-parcel",
  );
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const bounds = await review.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(122);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(page.locator(".orders-deal-grid > button")).toHaveCount(6);
  }
  await page.setViewportSize({ width: 393, height: 793 });
  expect((await review.boundingBox())?.height).toBe(122);
  expect(
    (await page.locator(".orders-deal-grid").boundingBox())?.y,
  ).toBeCloseTo(244, 0);
  await review.click();
  await expect(page).toHaveURL(/\/orders\/REF-1001\/review$/);
  await page.goBack();
  await expect(review).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Orders", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("transit Orders retains the captured promotion and opens its own deal", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-transit-history");
  await page.goto("/orders");
  const grid = page.locator(".orders-deal-grid");
  await expect(grid.locator("button")).toHaveCount(6);
  await expect(grid.locator("button > span")).toHaveText([
    "Save $5",
    "Save $30",
    "Save $5",
    "Save $25",
    "Save $25",
    "Save $20",
  ]);
  expect((await grid.boundingBox())?.y).toBeCloseTo(236, 0);
  await expect(
    page.locator(".orders-deals .order-section-chevron"),
  ).toHaveCount(1);
  await expect(page.locator(".orders-past .order-section-chevron")).toHaveCount(
    1,
  );
  const deal = page.getByRole("button", { name: "View deal 6", exact: true });
  await deal.click();
  const dialog = page.getByRole("dialog", { name: "Your deal", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toHaveAttribute(
    "src",
    "/api/reference-media/order-deal-carpe",
  );
  await page.keyboard.press("Escape");
  await expect(deal).toBeFocused();
});
