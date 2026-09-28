import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
}

test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
  await page.goto("/onboarding?step=preferences&journey=new");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page).toHaveURL(/\/$/);
});

test("guest Profile has no inherited identity, payment card, order or visit", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page.locator(".android-guest-profile")).toBeVisible();
  await ready(page);
  await expect(
    page.getByRole("heading", {
      name: "Sign in or create an account",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("No orders yet", { exact: true })).toBeVisible();
  await expect(page.locator(".profile-recent-rail")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("alexsmith.mobbin");
  await expect(
    page.locator(".identity-row, .payment-card, .profile-order-card"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCSS("background-color", "rgb(84, 51, 246)");
  await expect(
    page.getByRole("link", { name: "Saved", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?journey=new&returnTo=\/profile$/);
  await page.getByRole("link", { name: "Close sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("No orders yet", { exact: true })).toBeVisible();
});

test("native Saved starts empty, renders the source mug, and follows real Save/Unsave", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await ready(page);
  await expect(page.locator(".saved-grid .saved-product")).toHaveCount(0);
  await expect(page.locator(".saved-sock-card img")).toHaveAttribute(
    "src",
    "/api/reference-media/live-empty-saved-mug",
  );
  await expect(page.locator(".saved-sock-card")).toHaveCSS("width", "164px");
  await expect(
    page.getByRole("button", { name: "Open cart", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Go shopping", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const card = page.locator('[data-product-id="live-freebubbles-3"]');
  await card.getByRole("button", { name: /^Save / }).click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(page.locator(".saved-product")).toHaveCount(1);
  await expect(page.locator(".saved-product .saved-promotion")).toHaveText(
    "34% off",
  );
  await expect(page.locator(".saved-product > b")).toHaveText("€5.97 €8.99");
  await expect(
    page.getByRole("button", { name: "Create collection", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".saved-product")).toHaveCount(1);
  await page
    .locator(".saved-product")
    .getByRole("button", { name: /^Unsave / })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "You haven’t saved any items yet",
      exact: true,
    }),
  ).toBeVisible();
});

test("guest Following has the actual native posts, real product returns and Home action", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Following", exact: true }).click();
  await ready(page);
  const posts = page.locator("[data-live-following-post]");
  await expect(posts).toHaveCount(2);
  await expect(posts.first().locator(".product-card")).toHaveCount(8);
  await expect(posts.nth(1).locator(".product-card")).toHaveCount(1);
  await expect(posts.first()).toContainText("9 items added 23 hours ago");
  await expect(posts.nth(1)).toContainText("1 item added 8 days ago");
  await expect(page.locator(".following-product-grid .rating")).toHaveCount(0);
  expect(
    (await posts.first().locator(".product-media").first().boundingBox())?.y,
  ).toBe(284);
  await posts.first().locator(".product-media a").first().click();
  await expect(page).toHaveURL(/\/products\/live-following-zlatna-1$/);
  await expect(
    page.getByRole("heading", {
      name: "Регенерираща маска за коса с термозащита 180мл",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/following$/);
  await page.getByRole("link", { name: "Go shopping", exact: true }).click();
  await expect(page).toHaveURL(/\?home=recent$/);
});

test("guest Orders shows sign-in instead of inherited delivered orders", async ({
  page,
}) => {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Orders", exact: true })
    .click();
  await ready(page);
  await expect(
    page.getByRole("heading", {
      name: "Track all your orders here",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".order-empty-source")).toHaveCSS(
    "font-family",
    /ShopAndroidRoboto/,
  );
  await expect(
    page.getByRole("link", { name: "Connect account", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Add a package manually", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open cart", exact: true }),
  ).toHaveCount(0);
  const action = page.getByRole("link", { name: "Sign in", exact: true });
  expect((await action.boundingBox())?.height).toBe(44);
  await action.click();
  await expect(page).toHaveURL(/returnTo=\/orders$/);
  await page.getByRole("link", { name: "Close sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await page
    .getByRole("button", { name: "Search orders", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search orders", exact: true })
    .fill("not a real order");
  await expect(
    page.getByRole("heading", { name: "No orders found", exact: true }),
  ).toBeVisible();
});

for (const width of [320, 393, 427, 430]) {
  test(`native guest sibling layouts and navigation fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 });
    for (const route of ["/profile", "/saved", "/following", "/orders"]) {
      await page.goto(route);
      await ready(page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      const nav = await page.locator(".floating-nav").boundingBox();
      expect(nav!.x).toBeGreaterThanOrEqual(0);
      expect(nav!.x + nav!.width).toBeLessThanOrEqual(width);
      const back = page.getByRole("button", { name: "Go back", exact: true });
      if (await back.count()) {
        const box = await back.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(nav!.x);
      }
      await page.screenshot({
        path: test.info().outputPath(`${route.slice(1)}-${width}.png`),
      });
    }
  });
}
