import { expect, test, type Page } from "@playwright/test";

let errors: string[];
test.beforeEach(async ({ context, page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});
test.afterEach(() => expect(errors).toEqual([]));

const product = (id: string) => `/products/live-explore-${id}`;
async function settled(page: Page) {
  await expect(page.locator("[data-shop-interactive]").first()).toHaveAttribute(
    "data-shop-interactive",
    "true",
  );
  await expect(page.locator("main")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test("native lower shelves replace inherited menswear and beauty without changing frozen fixtures", async ({
  page,
}) => {
  await page.goto("/explore");
  const men = page.locator(".explore-shelf").filter({
    has: page.getByRole("heading", { name: "Top rated in menswear" }),
  });
  await expect(men.locator(".product-seller")).toHaveText([
    "NAADAM",
    "KICKS CREW",
    "Ekster®",
  ]);
  await expect(men.locator('[data-product-id="carbon-crew"]')).toHaveCount(0);
  const beauty = page
    .locator(".explore-shelf")
    .filter({ has: page.getByRole("heading", { name: "New in beauty" }) });
  await expect(beauty.locator(".product-seller")).toHaveText([
    "Beauty of Joseon",
    "Fenty Beauty",
    "Saie",
  ]);
  await expect(beauty.locator('[data-reference-markdown="true"]')).toHaveText(
    "50% off",
  );
  await expect(
    beauty.locator('[data-product-id="live-explore-glow-duo"] .product-copy'),
  ).toContainText("€20.40");
  await expect(
    beauty.locator(
      '[data-product-id="live-explore-glow-duo"] .product-copy del',
    ),
  ).toHaveText("€40.80");
});

for (const id of [
  "cashmere",
  "airtag-wallet",
  "glow-duo",
  "prismatic-gloss",
  "blush-trio",
]) {
  test(`native ${id} returns to its actual lower-shelf control and scroll`, async ({
    page,
  }) => {
    await page.goto("/explore");
    const opener = page
      .locator(`[data-product-id="live-explore-${id}"] .product-copy`)
      .first();
    await opener.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    await opener.click();
    await page.waitForURL(`**${product(id)}`);
    await settled(page);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(
      page.locator('.floating-nav [aria-current="page"]'),
    ).toHaveAttribute("aria-label", "Explore");
    const image = page.locator(".product-gallery img").first();
    await expect
      .poll(() =>
        image.evaluate(
          (e: HTMLImageElement) => e.complete && e.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.waitForURL("**/explore");
    await expect(opener).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
    await page.goForward();
    await page.waitForURL(`**${product(id)}`);
    await expect(
      page.locator('.floating-nav [aria-current="page"]'),
    ).toHaveAttribute("aria-label", "Explore");
  });
}

test("native unavailable colors remain inspectable but cannot enter checkout", async ({
  page,
}) => {
  await page.goto(product("perfect-pot"));
  await page.getByRole("button", { name: "Color: Clay", exact: true }).click();
  await expect(page.locator(".native-product-colors legend")).toHaveText(
    "Color: Clay",
  );
  await expect(page.locator(".product-price")).toHaveText("$149.00 Sold out");
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Buy now", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Increase quantity" }),
  ).toBeDisabled();
  const save = page.getByRole("button", {
    name: "Add to saved items",
    exact: true,
  });
  await save.click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator(".native-product-colors legend")).toHaveText(
    "Color: Clay",
  );
  await expect(page.locator(".product-price strong")).toHaveText("Sold out");
  await page.getByRole("button", { name: "Color: Char", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeEnabled();
});

test("sold-out native wallet keeps its source colors and does not invent restock enrollment", async ({
  page,
}) => {
  await page.goto(product("airtag-wallet"));
  await expect(page.locator(".native-product-colors legend")).toContainText(
    "Nappa Black",
  );
  await expect(page.locator(".product-price strong")).toHaveText("Sold out");
  const other = page.locator(".native-color-grid > button").nth(1);
  await other.click();
  await expect(other).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".product-price strong")).toHaveText("Sold out");
  await expect(page.locator(".native-sold-out-actions")).toContainText(
    "No restock notifications have been enabled.",
  );
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toHaveCount(0);
});

test("native Share cancels without touching the clipboard and copies only on request", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.defineProperty(window, "__shareWrites", { value: calls });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          calls.push(text);
        },
      },
      configurable: true,
    });
  });
  await page.goto(product("glow-duo"));
  const opener = page.getByRole("button", {
    name: "Share product",
    exact: true,
  });
  await opener.click();
  const sheet = page.getByRole("dialog", { name: "Sharing link", exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Link to this product")).toHaveValue(
    page.url(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __shareWrites: string[] }).__shareWrites,
      ),
    )
    .toEqual([]);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await opener.click();
  await sheet.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(sheet.getByRole("status")).toHaveText("Link copied");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __shareWrites: string[] }).__shareWrites,
      ),
    )
    .toEqual([page.url()]);
  await page.goBack();
  await expect(sheet).not.toBeVisible();
  await expect(opener).toBeFocused();
});

for (const width of [320, 393, 430]) {
  test(`native lower-product controls and source photos fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const id of [
      "cashmere",
      "airtag-wallet",
      "glow-duo",
      "prismatic-gloss",
      "blush-trio",
    ]) {
      await page.goto(product(id));
      await settled(page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await expect(
        page.getByRole("button", { name: "Share product", exact: true }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Share product", exact: true })
        .click();
      const share = page.getByRole("dialog", { name: "Sharing link" });
      await expect(
        share.getByRole("button", { name: "Copy link", exact: true }),
      ).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    }
  });
}
