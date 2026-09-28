import { expect, test, type Page } from "@playwright/test";

async function openStore(
  page: Page,
  baseURL: string | undefined,
  scenario: "home-welcome" | "following-pair",
) {
  if (!baseURL)
    throw new Error("Storefront tests require the reference preview");
  await page.context().addCookies([
    {
      name: "shop-reference-scenario",
      value: scenario,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/stores/kitsch");
  await expect(page.locator("html")).toHaveAttribute(
    "data-reference-scenario",
    scenario,
  );
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.locator("main img").evaluateAll(async (images) => {
    await document.fonts.ready;
    await Promise.all(
      images.map((image) => (image as HTMLImageElement).decode()),
    );
  });
}

for (const scenario of ["following-pair", "home-welcome"] as const) {
  test(`${scenario} keeps its campaign header through scrolling and a real search visit`, async ({
    page,
    baseURL,
  }) => {
    await openStore(page, baseURL, scenario);
    const navigation = page.locator(".store-category-navigation");
    await expect(navigation).not.toHaveClass(/is-pinned/);
    await page.locator(".store-grid-heading").evaluate((element) => {
      window.scrollTo({
        top: element.getBoundingClientRect().top + scrollY - 110,
        behavior: "instant",
      });
    });
    await expect(navigation).toHaveClass(/is-pinned/);
    await expect(
      navigation.getByRole("link", { name: "Store information", exact: true }),
    ).toBeVisible();
    await expect(navigation.locator(".store-compact-promotion")).toHaveCount(
      scenario === "home-welcome" ? 1 : 0,
    );
    await navigation
      .getByRole("link", { name: "Search store", exact: true })
      .click();
    await expect(page).toHaveURL(/\/stores\/kitsch\/search$/);
    await expect(
      page.getByRole("textbox", { name: "Search KITSCH", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/stores\/kitsch$/);
    await expect(navigation).toHaveClass(/is-pinned/);
    await expect(navigation.locator(".store-compact-promotion")).toHaveCount(
      scenario === "home-welcome" ? 1 : 0,
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(navigation).not.toHaveClass(/is-pinned/);
    await expect(page.locator(".store-brand")).toBeVisible();
  });
}

test("store promotions keep their captured type hierarchy", async ({
  page,
  baseURL,
}) => {
  await openStore(page, baseURL, "home-welcome");
  await page.evaluate(() => document.fonts.ready);
  const owner = page.locator(".promotion-owner");
  await expect(owner).toHaveCSS("font-family", /ShopChemicalGeist/);
  const emptyCart = page.getByRole("button", {
    name: "Open cart",
    exact: true,
  });
  await expect(emptyCart).toBeVisible();
  await page.locator(".store-promotion").click();
  await expect(emptyCart).toHaveCount(0);
  const offers = page.locator(".promotion-offers");
  await expect(offers).toBeVisible();
  for (const heading of await offers.locator("> div > b").all()) {
    await expect(heading).toHaveCSS("font-weight", "500");
  }
  for (const copy of await offers.locator("p, span").all()) {
    await expect(copy).toHaveCSS("font-weight", "400");
  }
  await page.locator(".store-promotion").click();
  await expect(page.locator(".promotion-offers")).toHaveCount(0);
  await expect(emptyCart).toBeVisible();
});
test("the captured empty-cart control opens an actual cart without adding an item", async ({
  page,
  baseURL,
}) => {
  await openStore(page, baseURL, "home-welcome");
  const cart = page.getByRole("button", { name: "Open cart", exact: true });
  await expect(cart).toBeVisible();
  await expect(page.locator(".dock-cart-count")).toHaveCount(0);
  await cart.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(cart).toBeFocused();
  await expect(page.locator(".dock-cart-count")).toHaveCount(0);
});
