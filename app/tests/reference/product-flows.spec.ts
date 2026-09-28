import { test, expect } from "@playwright/test";

test("product gallery closes through history and returns to the selected photo", async ({
  page,
}) => {
  await page.goto("/products/shea-butter");
  const trigger = page.getByRole("button", {
    name: "View product image 1",
    exact: true,
  });
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "Product photos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show photo 2", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show photo 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".lightbox-swipe img")).toHaveAttribute(
    "src",
    "/api/reference-media/shea-gallery-testimonial",
  );
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View product image 2", exact: true }),
  ).toBeFocused();
});

test("product saving chooses a collection and retains its membership", async ({
  page,
}) => {
  await page.goto("/products/shea-butter");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await page
    .getByRole("button", { name: "Create collection", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Collection name" })
    .fill("Body care");
  await page
    .getByRole("button", { name: "Create collection", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Item saved" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByText("Body care", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Private Body care", exact: true })
    .click();
  await expect(
    page
      .getByRole("link", {
        name: "Shea Butter Exfoliating Body Wash",
        exact: true,
      })
      .first(),
  ).toBeVisible();
});

test("review search and helpful selection affect the selected review", async ({
  page,
}) => {
  await page.goto("/products/shea-butter/reviews");
  await page.getByRole("searchbox", { name: "Search reviews" }).fill("nice");
  await expect(page.locator(".review-card")).toHaveCount(4);
  const review = page.locator(".review-card").first();
  await expect(review).toContainText("This is truly one of the nicest soaps");
  await review.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(
    review.getByRole("button", { name: "Helpful (1) ✓", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".review-card")
      .nth(1)
      .getByRole("button", { name: "Helpful", exact: true }),
  ).toBeVisible();
});

test("expanded review reveals the captured full body", async ({ page }) => {
  await page.goto("/products/shea-butter/reviews");
  const review = page.locator(".review-card").first();
  await review.getByRole("button", { name: "Read more", exact: true }).click();
  await expect(
    review.getByRole("button", { name: "Read less", exact: true }),
  ).toBeVisible();
  await expect(review.locator("p")).toContainText(
    "I can finally go to bed and not have allergy issues . Thank you",
  );
  await expect(review.locator("p")).not.toHaveClass(/review-truncated/);
});
