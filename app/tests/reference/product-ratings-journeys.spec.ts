import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const title =
  "Midi Shirtdress in Ultrasoft Cotton | Estate Blue/Open Air/White";

test("the dress ratings link never inherits a different product's review text", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/midi-shirtdress");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.locator(".review-link").click();
  await expect(page).toHaveURL(/\/products\/midi-shirtdress\/reviews$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "4.5 out of 5 stars", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "The full review list was not captured for this product.",
  );
  await expect(page.getByText("2 ratings", { exact: false })).toBeVisible();
  await expect(page.locator(".review-item")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Helpful/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/midi-shirtdress$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("a missing product cannot open the default Shea reviews", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  const response = await page.goto("/products/not-in-the-catalog/reviews");
  expect(response?.status()).toBe(404);
  await expect(page.locator(".review-item")).toHaveCount(0);
});

test("product aggregates keep stars and counts on one line at every reference width", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  for (const id of ["shea-butter", "shampoo-bag", "midi-shirtdress"]) {
    await page.goto(`/products/${id}`);
    await expect(
      page.locator('[data-shop-interactive="true"]').first(),
    ).toBeAttached();
    for (const width of [320, 393, 430]) {
      await page.setViewportSize({ width, height: 793 });
      const geometry = await page
        .locator(".review-link")
        .evaluate((element) => {
          const stars = element.querySelector(".review-rating-stars")!;
          const count = [...element.childNodes].find(
            (node) =>
              node.nodeType === Node.TEXT_NODE &&
              node.textContent?.includes("ratings"),
          );
          if (!count) throw new Error("The product rating count is missing");
          const range = document.createRange();
          range.selectNodeContents(count);
          const text = range.getBoundingClientRect();
          const star = stars.getBoundingClientRect();
          return {
            height: element.getBoundingClientRect().height,
            distance: Math.abs(
              (text.top + text.bottom - star.top - star.bottom) / 2,
            ),
            ordered: text.left >= star.right,
          };
        });
      expect(geometry.height, `${id} at ${width}`).toBeLessThanOrEqual(24);
      expect(geometry.distance, `${id} at ${width}`).toBeLessThanOrEqual(4);
      expect(geometry.ordered, `${id} at ${width}`).toBe(true);
    }
  }
});
