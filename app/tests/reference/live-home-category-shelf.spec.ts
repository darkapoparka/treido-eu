import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const potPath = "/products/live-explore-perfect-pot";
const sourceProducts = [
  "live-explore-perfect-pot",
  "live-explore-verena-rug",
  "live-explore-bubble-blanket",
];

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});

test("native Home keeps its source Top rated shelf", async ({ page }) => {
  await page.goto("/explore/Home");
  const shelf = page.locator(".explore-shelf");
  await expect(shelf).toHaveCount(1);
  await expect(shelf.locator("h2")).toContainText("Top rated");
  await expect(shelf.locator(".product-card")).toHaveCount(3);
  const cards = shelf.locator(".product-card");
  const ids = await cards.evaluateAll((entries) => {
    return entries.map((card) => card.getAttribute("data-product-id"));
  });
  expect(ids).toEqual(sourceProducts);
  await expect(shelf.locator(".product-seller")).toHaveText([
    "Our Place",
    "Ruggable",
    "Cozy Earth",
  ]);
  await expect(shelf.locator(".product-copy > span:last-child")).toHaveText([
    "$149.00",
    "$89.00",
    "€282.95",
  ]);
  const buffy = shelf.locator('[data-product-id="buffy-breeze"]');
  const wake = shelf.locator('[data-product-id="live-cozy-wake-light"]');
  await expect(buffy).toHaveCount(0);
  await expect(wake).toHaveCount(0);
});

for (const width of [320, 393, 427, 430]) {
  test(`native Home card size and product return at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 });
    await page.goto("/explore/Home");
    const shelf = page.locator(".explore-shelf");
    await page.evaluate(() => document.fonts.ready);
    const media = shelf.locator(".product-media").first();
    const bounds = await media.boundingBox();
    const documentWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(bounds?.width).toBeCloseTo((width - 48) / 2, 1);
    expect(bounds?.height).toBeCloseTo((width - 48) / 2, 1);
    expect(documentWidth).toBe(width);
    const opener = shelf.locator(`.product-copy[href="${potPath}"]`);
    await opener.scrollIntoViewIfNeeded();
    await opener.click();
    await page.waitForURL(`**${potPath}`);
    const title = page.getByRole("heading", {
      name: "Ceramic Nonstick Perfect Pot 6.5 qt.",
      exact: true,
    });
    await expect(title).toBeVisible();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.waitForURL("**/explore/Home");
    await expect(opener).toBeFocused();
    await expect(shelf.locator(".product-card")).toHaveCount(3);
  });
}

test("native swatches retain rings and centered photographs", async ({
  page,
}) => {
  await page.goto(potPath);
  const clay = page.getByRole("button", { name: "Color: Clay", exact: true });
  const swatch = clay.locator("span");
  await expect(clay).toBeEnabled();
  await expect(swatch).toHaveCSS("border-color", "rgb(162, 162, 162)");
  await clay.click();
  await expect(clay).toHaveAttribute("aria-pressed", "true");
  await expect(swatch).toHaveCSS("border-color", "rgb(17, 17, 17)");
  await expect(page.locator(".product-price strong")).toHaveText("Sold out");
  const buy = page.getByRole("button", { name: "Add to cart", exact: true });
  await expect(buy).toHaveCount(0);
  await page.goto("/products/live-explore-bubble-blanket");
  const creme = page
    .getByRole("button", { name: "Color: Creme", exact: true })
    .locator("span");
  await expect(creme).toHaveCSS("background-origin", "content-box");
  await expect(creme).toHaveCSS("background-position", "50% 50%");
});

test("frozen Explore keeps its own shelf and styling", async ({ page }) => {
  await useReferenceScenario(page, "onboarding-new");
  await page.goto("/explore");
  const shelf = page.locator(".explore-shelf");
  const buffy = shelf.locator('[data-product-id="buffy-breeze"]');
  const pot = shelf.locator('[data-product-id="live-explore-perfect-pot"]');
  await expect(page.locator("[data-native-shelves]")).toHaveCount(0);
  await expect(buffy).toHaveCount(1);
  await expect(pot).toHaveCount(0);
});
