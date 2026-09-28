import { test, expect } from "@playwright/test";

test("onboarding artwork has visible dimensions and stages follow browser history", async ({
  page,
}) => {
  await page.goto("/onboarding?step=preferences&reference=captured");
  const art = page.locator(".preference-onboarding-art");
  await expect(art.locator("img")).toHaveCount(11);
  await expect
    .poll(async () => art.evaluate((el) => el.getBoundingClientRect().width))
    .toBeGreaterThan(300);
  await expect
    .poll(async () =>
      art
        .locator("img")
        .first()
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(async () =>
      art
        .locator("img")
        .first()
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Everything", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/step=tracking/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "What are you shopping for?" }),
  ).toBeVisible();
});

test("photo assistant entry retains a local preview and opens the captured answer", async ({
  page,
}) => {
  await page.goto("/search");
  await page.getByRole("button", { name: "Add photos", exact: true }).click();
  await page.getByRole("button", { name: "Use captured cap example" }).click();
  await expect(page.getByAltText("Selected photo")).toBeVisible();
  await page.getByRole("button", { name: "Submit search" }).click();
  await expect(
    page.getByRole("heading", { name: "Find me a baseball cap like this" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Assistant steps/ }).click();
  await expect(page.getByText("Search for products")).toBeVisible();
});

test("captured outfit labels open the complete results from their first group", async ({
  page,
}) => {
  await page.goto("/minis/look");
  await page.getByRole("button", { name: "Choose Photo", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Get the Look preview controls", exact: true })
    .click();
  await page.getByRole("button", { name: "Use reference outfit" }).click();
  await page.getByRole("button", { name: "View captured matches" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const products = page.locator(".look-results");
  await expect(
    products.locator('a[href="/products/look-sculpt"]').first(),
  ).toBeVisible();
  for (const label of [
    "Women’s Black Crew Neck T-shirt",
    "Women’s Black and White Gingham Mini Skirt",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const selected = page.getByRole("region", {
      name: "Selected outfit piece",
      exact: true,
    });
    await expect(
      selected.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // f058-007 keeps the outfit in place and shows its selected-piece panel.
    // f058-008 opens the complete catalogue at Blazer from any selected piece.
    await page
      .getByRole("button", { name: "View all matching pieces", exact: true })
      .click();
    const section = page
      .locator(".look-results section[id]")
      .filter({ has: page.getByRole("heading", { name: label, exact: true }) });
    await expect(section).toBeVisible();
    await expect
      .poll(async () => {
        const rect = await page.locator("#look-blazer").boundingBox();
        return Math.round(rect?.y ?? 999);
      })
      .toBe(70);
    await expect(page.locator("#look-blazer > h2")).toBeFocused();
  }
  await expect(
    products.locator('a[href="/products/look-sculpt"]').first(),
  ).toHaveCount(1);
  await expect(
    products.locator('a[href="/products/look-black-crew"]').first(),
  ).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText(/â€™|â€¦|dÃ©/);
});

test("captured skin result keeps existing source products", async ({
  page,
}) => {
  await page.goto("/minis/skin");
  await page.getByRole("button", { name: "Analyze My Skin" }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Skincare AI preview controls", exact: true })
    .click();
  await page.getByRole("button", { name: "View reference example" }).click();
  await expect(
    page.getByRole("heading", { name: "Overall Skin Summary" }),
  ).toBeVisible();
  await expect(
    page.locator('a[href="/products/skin-anua"]').first(),
  ).toBeVisible();
});

test("gift questions retain source result rows after local access preview", async ({
  page,
}) => {
  await page.goto("/minis/gift");
  await page.getByRole("button", { name: /Let’s Begin/ }).click();
  await page.getByRole("button", { name: "Friend", exact: true }).click();
  await page.getByRole("button", { name: "Creative", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Under $50", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await page.getByRole("button", { name: "View captured gift ideas" }).click();
  await expect(page.locator(".gift-result-row")).toHaveCount(3);
  await expect(page.locator('a[href="/products/gift-logic"]')).toBeVisible();
});

test("people draft follows nickname and birthday browser stages", async ({
  page,
}) => {
  await page.goto("/account/people");
  await page.getByRole("button", { name: "Add someone new" }).click();
  await page
    .getByRole("textbox", { name: "Nickname", exact: true })
    .fill("Taylor");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add Taylor's birthday" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("textbox", { name: "Nickname", exact: true }),
  ).toHaveValue("Taylor");
});

test("search suggestions replace the entry and keep captured store choices", async ({
  page,
}) => {
  await page.goto("/search");
  await expect(
    page.getByRole("link", { name: /Finding the right pair of jeans/ }),
  ).toHaveCount(0);
  const searchInput = page.getByRole("textbox", { name: "Search products" });
  await searchInput.click();
  await page.keyboard.type("Jeans", { delay: 90 });
  await expect(searchInput).toHaveValue("Jeans");
  await expect(searchInput).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Suggestions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /City Jeans 4.8/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Recently viewed/ }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "jeans baggy", exact: true }).click();
  await expect(page).toHaveURL(/q=jeans%20baggy/);
});

test("gift questions retain prior choices and use the bottom composer", async ({
  page,
}) => {
  await page.goto("/minis/gift");
  await page.getByRole("button", { name: /Let’s Begin/ }).click();
  await page.getByRole("button", { name: "Friend", exact: true }).click();
  await page.getByRole("button", { name: "Creative", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Under $25", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Under $25", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Under $25", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("What’s your budget for this gift?", { exact: true }),
  ).toHaveCount(1);
  await expect(page.locator("textarea")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Optional gift notes" })
    .fill("He likes black color");
  await expect(page.locator(".gift-composer input")).toHaveValue(
    "He likes black color",
  );
});

test("Sol advances the entered captured example to source product cards", async ({
  page,
}) => {
  await page.goto("/minis/sol");
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await page.getByRole("button", { name: /Allow & Continue/ }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.locator('[data-sol-phase="greeting"]')).toBeVisible();
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  await page.getByRole("textbox", { name: "Message Sol" }).fill("sunglasses");
  await page.getByRole("button", { name: "Send local message" }).click();
  await expect(
    page.getByText("Nice, sunglasses are a fun pick.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View captured choices" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Gold rimless glasses", exact: true })
    .click();
  await expect(
    page.locator('.sol-product-results a[href="/products/u-see-me"]').first(),
  ).toBeVisible();
  await expect(page.locator(".sol-product-results")).toContainText("$14.90");
  await expect(
    page.locator('.sol-product-results [data-product-id="hush-glasses"]'),
  ).toHaveCount(1);
});

for (const [store, product] of [
  ["princess-polly", "home-princess-top"],
  ["drmtlgy", "home-drmtlgy-eye"],
  ["city-jeans", "city-duaa-denim"],
]) {
  test(`store ${store} opens its product with decoded media and no empty logo`, async ({
    page,
  }) => {
    await page.goto(`/stores/${store}`);
    await expect(page.locator('img[src=""]')).toHaveCount(0);
    await page.locator(`a[href="/products/${product}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/products/${product}$`));
    await expect(page.locator('img[src=""]')).toHaveCount(0);
    await expect
      .poll(async () =>
        page
          .locator(".product-gallery img")
          .evaluateAll(
            (nodes) =>
              nodes.length > 0 &&
              nodes.every(
                (n) =>
                  (n as HTMLImageElement).complete &&
                  (n as HTMLImageElement).naturalWidth > 0,
              ),
          ),
      )
      .toBeTruthy();
    await expect(page.getByRole("link", { name: /More options/ })).toHaveCount(
      0,
    );
  });
}

test("pickup payment follows card deletion when returning from account", async ({
  page,
}) => {
  await page.goto("/checkout?store=white-rock");
  await expect(
    page.getByText("Visa ···· 4263", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit payment method" }).click();
  await expect(page.locator(".payment-card-button")).toHaveCount(1);
  await page.locator(".payment-card-button").first().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.locator(".payment-card-button")).toHaveCount(0);
  for (let i = 0; i < 6 && !page.url().includes("/checkout"); i++) {
    await page.goBack();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  }
  await expect(page).toHaveURL(/checkout\?store=white-rock/);
  await expect(
    page.getByText("Add payment method", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay now/ })).toBeDisabled();
});
