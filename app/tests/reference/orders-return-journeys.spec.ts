import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

async function ready(page: Page) {
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.locator("main img").evaluateAll(async (images) => {
    await document.fonts.ready;
    await Promise.all(
      images.map((image) =>
        (image as HTMLImageElement).decode().catch(() => undefined),
      ),
    );
  });
}

for (const path of [
  {
    name: "active order",
    scenario: "orders-transit",
    url: "/orders",
    source: ".tracking-card",
  },
  {
    name: "archived order",
    scenario: "orders-archived",
    url: "/orders/archived",
    source: ".archive-order-row",
  },
  {
    name: "order history row",
    scenario: "orders-manual",
    url: "/orders/history",
    source: ".order-history-row.is-kitsch",
  },
  {
    name: "Profile order history",
    scenario: "orders-manual",
    url: "/profile",
    source: 'a[href="/orders/history"]',
  },
  {
    name: "manual order entry",
    scenario: "orders-empty",
    url: "/orders",
    source: 'a.form-cancel[href="/orders/new"]',
  },
  {
    name: "Orders account connection",
    scenario: "orders-empty",
    url: "/orders",
    source: 'a.primary[href="/account/connections"]',
  },
  {
    name: "history email connection",
    scenario: "orders-manual",
    url: "/orders/history",
    source: '.history-connect-banner a[href="/account/connections"]',
  },
  {
    name: "manual-entry automatic tracking",
    scenario: "orders-empty",
    url: "/orders/new",
    source: '.forward-orders a[href="/account/connections"]',
  },
] as const) {
  test(`${path.name} restores source focus and scroll through repeated history`, async ({
    page,
  }) => {
    await useReferenceScenario(page, path.scenario);
    await page.goto(path.url);
    await ready(page);
    const source = page.locator(path.source).first();
    await source.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    const destination = await source.getAttribute("href");
    await source.click();
    await expect(page).toHaveURL(destination!);
    for (let visit = 0; visit < 2; visit += 1) {
      await page.goBack();
      await expect(page).toHaveURL(path.url);
      await expect(source).toBeFocused();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
      if (visit === 0) {
        await page.goForward();
        await expect(page).toHaveURL(destination!);
      }
    }
  });
}

test("Orders menu navigation consumes its sheet and returns to the underlying opener", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-archived");
  await page.goto("/orders");
  const more = page.getByRole("button", {
    name: "More order options",
    exact: true,
  });
  for (const [label, destination] of [
    ["View order archive", "/orders/archived"],
    ["Add order manually", "/orders/new"],
    ["Connect email accounts", "/account/connections"],
  ]) {
    await more.click();
    await page
      .getByRole("dialog", { name: "More options", exact: true })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(destination);
    await page.goBack();
    await expect(page).toHaveURL("/orders");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(more).toBeFocused();
    await page.goForward();
    await expect(page).toHaveURL(destination);
    await page.goBack();
    await expect(more).toBeFocused();
  }
});

test("tracking query returns to its status control without stealing a sheet's focus", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-transit");
  await page.goto("/orders/REF-1001?state=in-transit");
  await ready(page);
  const status = page.locator(".order-status");
  await status.evaluate((element) => {
    window.scrollTo({ top: 80, behavior: "instant" });
    (element as HTMLElement).focus({ preventScroll: true });
  });
  const y = await page.evaluate(() => scrollY);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/view=tracking/);
  const edit = page.getByRole("button", {
    name: "Edit tracking details",
    exact: true,
  });
  await edit.click();
  await expect(
    page.getByRole("dialog", { name: "Edit tracking details", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(edit).toBeFocused();
  // Leave the route too: the return must survive a remounted OrderDetail.
  const product = page.locator(".product-card .product-media a").first();
  const href = await product.getAttribute("href");
  await product.click();
  await expect(page).toHaveURL(href!);
  await page.goBack();
  await expect(product).toBeFocused();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL("/orders/REF-1001?state=in-transit");
  await expect(status).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  await page.goForward();
  await expect(page).toHaveURL(/view=tracking/);
  await page.goBack();
  await expect(status).toBeFocused();
});

test("review Close returns to the actual Orders or detail entry and keeps direct-entry fallback", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-delivered");
  for (const [origin, selector] of [
    ["/orders", ".tracking-card"],
    ["/orders/REF-1001?state=delivered", ".review-invitation"],
  ]) {
    await page.goto(origin);
    const source = page.locator(selector);
    await source.click();
    await expect(page).toHaveURL("/orders/REF-1001/review");
    const length = await page.evaluate(() => history.length);
    await page.getByRole("link", { name: "Close review", exact: true }).click();
    await expect(page).toHaveURL(origin);
    await expect(source).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(length);
    await page.goForward();
    await expect(page).toHaveURL("/orders/REF-1001/review");
    await page.getByRole("link", { name: "Close review", exact: true }).click();
    await expect(source).toBeFocused();
  }
  await page.goto("/orders/REF-1001/review");
  await page.getByRole("link", { name: "Close review", exact: true }).click();
  await expect(page).toHaveURL("/orders/REF-1001");
});

async function fillPackage(page: Page) {
  await page
    .getByRole("textbox", { name: "Tracking number", exact: true })
    .fill("LOCAL-RETURN-321");
  await page
    .getByRole("textbox", { name: "Package name", exact: true })
    .fill("My parcel draft");
  await expect(
    page.getByRole("textbox", { name: "Tracking number", exact: true }),
  ).toHaveValue("LOCAL-RETURN-321");
  await page
    .getByRole("textbox", { name: "Carrier", exact: true })
    .fill("DHL eCommerce");
  await page
    .getByRole("button", { name: "DHL eCommerce", exact: true })
    .click();
  await expectPackage(page);
}
async function expectPackage(page: Page) {
  await expect(
    page.getByRole("textbox", { name: "Tracking number", exact: true }),
  ).toHaveValue("LOCAL-RETURN-321");
  await expect(
    page.getByRole("textbox", { name: "Package name", exact: true }),
  ).toHaveValue("My parcel draft");
  await expect(
    page.getByRole("textbox", { name: "Carrier", exact: true }),
  ).toHaveValue("DHL eCommerce");
}

test("new-order draft returns from help but a deliberately reopened form starts blank", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-empty");
  await page.goto("/orders");
  const add = page.locator('a.form-cancel[href="/orders/new"]');
  await add.click();
  await fillPackage(page);
  const help = page.getByRole("link", { name: "Learn more", exact: true });
  await help.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await help.click();
  await expect(page).toHaveURL("/support/help");
  await expect(
    page.getByRole("heading", { name: "Help Center", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expectPackage(page);
  await expect(help).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  await page
    .getByRole("textbox", { name: "Tracking number", exact: true })
    .fill("LOCAL-RETURN-322");
  await expect(
    page.getByRole("textbox", { name: "Package name", exact: true }),
  ).toHaveValue("My parcel draft");
  await expect(
    page.getByRole("textbox", { name: "Carrier", exact: true }),
  ).toHaveValue("DHL eCommerce");
  await page.goBack();
  await expect(add).toBeFocused();
  await add.click();
  for (const label of ["Tracking number", "Package name", "Carrier"])
    await expect(
      page.getByRole("textbox", { name: label, exact: true }),
    ).toHaveValue("");
});

test("submitted manual draft survives Back and resubmission preserves one package identity", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-empty");
  await page.goto("/orders/new");
  await fillPackage(page);
  await page.getByRole("button", { name: "Add order", exact: true }).click();
  await expect(page).toHaveURL("/orders?view=manual");
  const card = page.locator(".manual-tracking-card");
  await expect(card).toHaveCount(1);
  const identity = await card.getAttribute("href");
  await page.goBack();
  await expectPackage(page);
  await page.getByRole("button", { name: "Add order", exact: true }).click();
  await expect(page).toHaveURL("/orders?view=manual");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("href", identity!);
});

test("marking delivered from the detail menu retires its entry before dock Back", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-transit");
  await page.goto("/orders");
  await page.locator(".tracking-card").click();
  await expect(page).toHaveURL("/orders/REF-1001?state=in-transit");
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark order as delivered", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL("/orders/REF-1001");
  await expect(page.locator(".order-status")).toContainText("Delivered Aug 1");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL("/orders");
  await expect(page.locator(".tracking-card")).toHaveAttribute(
    "data-order-status",
    "Delivered",
  );
  await expect(page.locator(".tracking-card")).toContainText(
    "Review your order",
  );
  await expect(page.locator(".tracking-card")).toBeFocused();
});

test("tracking delivery changes supersede older captured detail entries through Back and Forward", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-transit");
  await page.goto("/orders");
  await page.locator(".tracking-card").click();
  await page.locator(".order-status").click();
  await page
    .getByRole("button", { name: "Tracking options", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Mark as delivered", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).not.toHaveURL(/[?&]state=/);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL("/orders/REF-1001?state=in-transit");
  await expect(page.locator(".order-status")).toContainText("Delivered Aug 1");
  await expect(page.locator(".order-status")).toBeFocused();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Delivered Aug 1", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator(".order-status")).toContainText("Delivered Aug 1");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL("/orders");
  await expect(page.locator(".tracking-card")).toHaveAttribute(
    "data-order-status",
    "Delivered",
  );
  await expect(page.locator(".tracking-card")).toBeFocused();
});
