import { test, expect } from "@playwright/test";

import { useReferenceScenario } from "./helpers";

test("discovery images, navigation and mobile width remain usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/");
  await expect(page).toHaveTitle("Shop reference preview");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  // A new Home has no user-visit rail. Visit a product before asserting recent history.
  await page.goto("/products/cleo");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Cleo - Black/Smoke", exact: true }).first(),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("main img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Orders", exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByText("alexsmith.mobbin+3@gmail.com", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("cart keeps variant identity and checkout stops before a live payment", async ({
  page,
}) => {
  await page.goto("/products/carpenter-jeans");
  await expect(page.getByRole("button", { name: /^XS/ })).toBeDisabled();
  await page.getByRole("button", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: "Open cart", exact: true }).click();
  const cart = page.getByRole("dialog");
  await expect(cart).toBeVisible();
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(
      cart.locator(".commerce-line").getByText("S", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 393, height: 793 });
  await expect(
    cart.locator(".commerce-line").getByText("S", { exact: true }),
  ).toBeVisible();
  await cart.getByRole("button", { name: /^Increase Contrast/ }).click();
  await expect(
    cart.locator(".cart-subtotal").getByText("$69.98", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cart).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open cart", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open cart", exact: true }).click();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/checkout\?store=fashion-nova/);
  await page.getByRole("button", { name: /^Pay now/ }).click();
  await expect(
    page.getByRole("heading", { name: "Payment service is not connected" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "No card was charged and no order was created.",
  );
});

test("unknown media keys do not expose source files", async ({ request }) => {
  expect((await request.get("/api/reference-media/not-a-key")).status()).toBe(
    404,
  );
  expect(
    (await request.get("/api/reference-media/cleo")).headers()["content-type"],
  ).toContain("image/webp");
});

test("collection creation, membership and deletion preserve saved products", async ({
  page,
}) => {
  await page.goto("/saved");
  await page
    .getByRole("button", { name: "Create collection", exact: true })
    .click();
  const name = page.getByRole("textbox", { name: "Collection name" });
  await expect(name).toBeFocused();
  await name.fill("QA collection");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add from saved", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Add Shea Butter Exfoliating Body Wash",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^QA collection/ }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", {
        name: "Shea Butter Exfoliating Body Wash",
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Private QA collection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collection options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete collection", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Private QA collection", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("link", {
        name: "Shea Butter Exfoliating Body Wash",
        exact: true,
      })
      .first(),
  ).toBeVisible();
});

test("repeated query values remain safe and filter sheets dismiss before navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/search?q=Jeans&q=Shampoo&ratings=4&ratings=5");
  await expect(
    page.getByRole("textbox", { name: "Search products" }),
  ).toHaveValue("Jeans");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/\/search\?/);
  expect(errors).toEqual([]);
});

// Browser captures support review; they are not automatically approved baselines.
for (const path of [
  "/explore",
  "/explore/Beauty",
  "/minis",
  "/minis/sol",
  "/minis/skin",
  "/minis/look",
  "/minis/gift",
  "/assistant",
  "/following",
  "/account",
  "/account/addresses",
  "/account/payments",
  "/orders",
  "/orders/REF-1001",
  "/orders/REF-1001/receipt",
  "/login",
  "/onboarding",
  "/support",
  "/stores/kitsch",
]) {
  test(`reference surface ${path} renders without broken media`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main").first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator("main img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.locator("main img").evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => (image as HTMLImageElement).decode()),
      );
    });
    await page.screenshot({
      path: `test-results/reference${path.replaceAll("/", "-")}.png`,
    });
  });
}
