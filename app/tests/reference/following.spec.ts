import { expect, test } from "@playwright/test";

// Keep failures actionable without filtering out hidden, partial or failed
// images. The assertion still requires every image in the family to decode.
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const images = await page.locator("img").evaluateAll((nodes) =>
    nodes
      .filter((node) => !node.complete || node.naturalWidth === 0)
      .map((node) => ({
        src: node.getAttribute("src"),
        alt: node.alt,
        complete: node.complete,
        currentSrc: node.currentSrc,
        inDialog: node.closest("dialog")?.getAttribute("class"),
      })),
  );
  console.error("Undecoded images", JSON.stringify(images));
});

test.beforeEach(async ({ context, baseURL }) => {
  if (!baseURL)
    throw new Error("Following tests require the reference base URL");
  await context.addCookies([
    {
      name: "shop-reference-scenario",
      value: "following-pair",
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test("Following products use real offers and the shared Saved state", async ({
  page,
}) => {
  await page.goto("/following");
  await expect(page.locator('[data-shop-interactive="true"]')).toBeVisible();
  const feed = page.getByRole("region", {
    name: "New Pura products",
    exact: true,
  });
  await expect(feed.locator(".product-card")).toHaveCount(6);
  await expect(feed.locator(".price-badge")).toHaveText(
    Array(6).fill("$30 off order"),
  );
  await page
    .getByRole("button", { name: "Save Moroccan Amber", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unsave Moroccan Amber", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  const saved = page
    .locator(".saved-grid .saved-product")
    .filter({ hasText: "Moroccan Amber" });
  await expect(saved).toBeVisible();
  await expect(saved).toContainText("$20.99");
  await saved
    .getByRole("button", { name: "Unsave Moroccan Amber", exact: true })
    .click();
  await expect(saved).toHaveCount(0);
});

test("Manage preserves rows for re-following and returns to the actual empty state", async ({
  page,
}) => {
  await page.goto("/following");
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Following list", exact: true }),
  ).toBeVisible();
  const rows = page.locator(".following-management-row");
  await expect(rows).toHaveCount(2);
  const pura = rows.filter({ hasText: "Pura" });
  await pura.getByRole("button", { name: "Following", exact: true }).click();
  await expect(
    pura.getByRole("button", { name: "Follow", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await pura.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    pura.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await rows
    .filter({ hasText: "KITSCH" })
    .getByRole("button", { name: "Following", exact: true })
    .click();
  await pura.getByRole("button", { name: "Following", exact: true }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Following", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go shopping", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".following-brand-rail")).toHaveCount(0);
  await page.getByRole("link", { name: "Go shopping", exact: true }).click();
  await expect(page).toHaveURL(/\/explore$/);
});

test("Manage Back and Forward restore the feed scroll position and focus", async ({
  page,
}) => {
  await page.goto("/following");
  await page.locator('[data-following-post="kitsch"]').scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  expect(scroll).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await expect(page).toHaveURL(/\/following\?manage=1$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/following$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
  await expect(
    page.getByRole("button", { name: "Manage", exact: true }),
  ).toBeFocused();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Following list", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/following$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
});

for (const width of [320, 393, 430]) {
  test(`Following contains the real controls and available photos at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 793 });
    await page.goto("/following");
    await expect(page.locator('[data-shop-interactive="true"]')).toBeVisible();
    await expect(page.locator(".following-page .save-button")).toHaveCount(7);
    await expect
      .poll(() =>
        page
          .locator(".following-page img")
          .evaluateAll((images) =>
            images
              .filter((image) => !image.complete || image.naturalWidth === 0)
              .map((image) => image.getAttribute("src")),
          ),
      )
      .toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page
      .getByRole("button", { name: "Save Black Bow Hair Clip", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Unsave Black Bow Hair Clip",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "View earlier Pura item", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Earlier Pura item", exact: true }),
    ).toContainText("does not include its complete product record");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "View earlier Pura item", exact: true }),
    ).toBeFocused();
  });
}
