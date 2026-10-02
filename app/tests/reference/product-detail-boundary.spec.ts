import { expect, test } from "@playwright/test";

test("product context is bounded, uncached and explicit about invalid or missing items", async ({
  request,
}) => {
  const response = await request.get(
    "/api/products/shea-butter/context?cart=rice-bundle&cover=rice-bundle",
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const context = await response.json();
  expect(
    context.cart.products.map((product: { id: string }) => product.id),
  ).toEqual([
    "shea-butter",
    "rice-bundle",
    "black-conditioner-bag",
    "chocolate-body-bag",
    "shower-caddy",
    "solid-shave-butter",
  ]);
  expect(context.cart.stores.map((store: { id: string }) => store.id)).toEqual([
    "kitsch",
  ]);
  for (const product of context.cart.products) {
    expect(product).not.toHaveProperty("description");
    expect(product).not.toHaveProperty("detail");
    expect(product).not.toHaveProperty("category");
  }
  for (const store of context.cart.stores)
    expect(store).not.toHaveProperty("referencePolicies");
  expect(
    (
      await request.get("/api/products/shea-butter/context?cart=bad/id")
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get("/api/products/not-a-reference-product/context")
    ).status(),
  ).toBe(404);
});

test("a deferred cart failure stays explicit and retries without losing sheet focus or items", async ({
  page,
}) => {
  await page.goto("/products/shea-butter");
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Added to cart", exact: true }),
  ).toBeVisible();
  let requests = 0;
  await page.route("**/api/products/rice-bundle/context?*", async (route) => {
    requests++;
    if (requests === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Injected boundary failure" }),
      });
    else await route.continue();
  });
  await page.goto("/products/rice-bundle");
  const opener = page.getByRole("button", { name: "Open cart", exact: true });
  await opener.click();
  const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(cart.getByRole("alert")).toHaveText(
    "Unable to load these items. Please retry.",
  );
  await expect(
    cart.getByText("Your cart is empty", { exact: true }),
  ).toHaveCount(0);
  await cart.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(cart.locator('[data-cart-line^="shea-butter|"]')).toBeVisible();
  await expect(cart.getByRole("alert")).toHaveCount(0);
  await expect
    .poll(() =>
      cart.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  expect(requests).toBe(2);
  await page.keyboard.press("Escape");
  await expect(cart).not.toBeVisible();
  await expect(opener).toBeFocused();
});

for (const width of [320, 390])
  test(`product detail remains contained with long Bulgarian/English text at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 793 });
    await page.goto("/products/shea-butter");
    await expect(
      page.locator('[data-shop-interactive="true"]').first(),
    ).toBeVisible();
    await page.locator(".product-heading h1").evaluate((element) => {
      element.textContent =
        "Изключително запазен фотоапарат с оригинални аксесоари и гаранция — professional camera bundle with additional lenses and protective travel case";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
