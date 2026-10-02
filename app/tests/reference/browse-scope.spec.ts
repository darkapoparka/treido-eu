import { expect, test, type Page } from "@playwright/test";

const selected = (page: Page, scope: string) =>
  page.locator(`[data-browse-scope="${scope}"]`);
const trigger = (page: Page) => page.locator("[data-browse-scope-trigger]");
async function choose(page: Page, scope: string, keepScroll = false) {
  if (keepScroll)
    await trigger(page).evaluate((button: HTMLButtonElement) => {
      button.focus({ preventScroll: true });
      button.click();
    });
  else await trigger(page).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await selected(page, scope).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function expectScope(page: Page, scope: string) {
  await expect(trigger(page)).toHaveAttribute("data-selected-scope", scope);
  await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
}
async function ready(page: Page) {
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
}
test("guest scope switching retains filters, resets pagination and restores Back/Forward", async ({
  page,
}) => {
  await page.goto(
    "/search?q=phone&category=cat%3Aelectronics%2Fphones&condition=good&minPrice=12.34&maxPrice=90&location=София&lang=en&sort=price_asc&attr.brand=Samsung&page=4",
  );
  await ready(page);
  await choose(page, "personal");
  await expectScope(page, "personal");
  await expect(trigger(page)).toBeFocused();
  const personal = new URL(page.url());
  for (const [key, value] of Object.entries({
    condition: "good",
    q: "phone",
    category: "cat:electronics/phones",
    minPrice: "12.34",
    maxPrice: "90.00",
    location: "София",
    sort: "price_asc",
    "attr.brand": "Samsung",
  }))
    expect(personal.searchParams.get(key)).toBe(value);
  expect(personal.searchParams.has("page")).toBe(false);
  await expect(page.locator(".search-results")).toHaveCount(0);
  await choose(page, "business");
  await expectScope(page, "business");
  await page.goBack();
  await expectScope(page, "personal");
  await page.goForward();
  await expectScope(page, "business");
  await page.reload();
  await expectScope(page, "business");
});

test("All/reset and invalid scope remain guest compatible without changing buyer state", async ({
  page,
}) => {
  await page.goto("/search?q=jeans&lang=en&seller=invalid");
  await ready(page);
  await expectScope(page, "all");
  const before = await page.evaluate(() => ({ ...localStorage }));
  await choose(page, "personal");
  await expect(
    page.getByText("Discovery by seller type is not connected yet."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Browse all", exact: true }).click();
  await expectScope(page, "all");
  expect(new URL(page.url()).searchParams.has("seller")).toBe(false);
  await expect(
    page.locator(".search-results .result-row").first(),
  ).toBeVisible();
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before);
  await choose(page, "business");
  await expectScope(page, "business");
  await choose(page, "all");
  await expectScope(page, "all");
  await expect(trigger(page)).toBeFocused();
});

test("query submit and filter sheet keep scope and canonical criteria", async ({
  page,
}) => {
  await page.goto(
    "/search?q=jeans&lang=en&seller=business&condition=good&minPrice=12.34&location=София",
  );
  await ready(page);
  const input = page.getByRole("textbox", {
    name: "Search products",
    exact: true,
  });
  await input.fill("coat");
  await input.press("Enter");
  await expect(page).toHaveURL(/q=coat/);
  expect(new URL(page.url()).searchParams.get("seller")).toBe("business");
  expect(new URL(page.url()).searchParams.get("condition")).toBe("good");
  await choose(page, "all");
  await expectScope(page, "all");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("condition")).toBe("good");
  expect(new URL(page.url()).searchParams.get("minPrice")).toBe("12.34");
  expect(new URL(page.url()).searchParams.get("location")).toBe("София");
});

test("newer navigation wins a delayed server response, including an All cancellation", async ({
  page,
}) => {
  await page.goto("/search?q=jeans&lang=en");
  await ready(page);
  await page.route("**/search?**", async (route) => {
    if (!route.request().headers().rsc) return route.continue();
    const scope = new URL(route.request().url()).searchParams.get("seller");
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-shop-reference-catalog-delay-ms":
          scope === "personal" ? "1600" : "100",
        "x-forwarded-for": "127.0.0.1",
      },
    });
  });
  await choose(page, "personal");
  await choose(page, "business");
  await expectScope(page, "business");
  await expect(trigger(page)).toHaveAttribute("aria-busy", "false");
  await choose(page, "personal");
  await choose(page, "all");
  await expectScope(page, "all");
  await expect(trigger(page)).toHaveAttribute("aria-busy", "false");
  expect(new URL(page.url()).searchParams.has("seller")).toBe(false);
  // Returning to the already displayed All URL must finish focus/scroll even
  // when the older selection was cancelled before its URL ever committed.
  await page.evaluate(() => window.scrollTo(0, 220));
  const stalled = page.waitForRequest(
    (request) =>
      Boolean(request.headers().rsc) &&
      new URL(request.url()).searchParams.get("seller") === "personal",
  );
  await choose(page, "personal", true);
  await stalled;
  await choose(page, "all", true);
  await expect(trigger(page)).toHaveAttribute("aria-busy", "false");
  await expect(trigger(page)).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("scope resets result scroll and Back restores detail and source context", async ({
  page,
}) => {
  await page.goto("/?lang=en");
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, 220));
  await choose(page, "business", true);
  await expectScope(page, "business");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await expectScope(page, "all");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(220);
  await page.goto("/search?q=jeans&lang=en&condition=good");
  await ready(page);
  await page.locator(".search-results .product-media a").first().click();
  await expect(page).toHaveURL(/\/products\//);
  expect(new URL(page.url()).searchParams.get("condition")).toBe("good");
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?/);
  await expectScope(page, "all");
});

test("named storefront and shared links preserve scope without changing seller", async ({
  page,
}) => {
  await page.goto(
    "/stores/kitsch?lang=en&seller=personal&condition=good&location=София",
  );
  await ready(page);
  await expect(page.locator("[data-browse-scope-unavailable]")).toContainText(
    "keeps its named seller",
  );
  await page.getByRole("link", { name: "Search store", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/kitsch\/search/);
  expect(new URL(page.url()).searchParams.get("seller")).toBe("personal");
  expect(new URL(page.url()).searchParams.get("condition")).toBe("good");
  await page.getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?/);
  await expectScope(page, "personal");
  const fresh = await page.context().newPage();
  await fresh.goto(page.url());
  await expectScope(fresh, "personal");
  await fresh.close();
});

test("Home keeps its shortcuts in one scrollable row and Deals remains reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 793 });
  await page.goto("/?lang=en");
  await ready(page);
  const header = page.locator(".home-shortcuts");
  await expect(header.locator("[data-browse-scope-trigger]")).toHaveCount(1);
  expect(
    await header.evaluate((row) => row.scrollWidth > row.clientWidth),
  ).toBe(true);
  for (const [label, path] of [
    ["Deals", "/deals"],
    ["Following", "/following"],
    ["Saved", "/saved"],
    ["Minis", "/minis"],
  ])
    await expect(
      header.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", new RegExp(`^${path}(\\?|$)`));
  const boxes = await header
    .locator(".pill")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().toJSON()),
    );
  expect(boxes.every((box) => box.top === boxes[0].top)).toBe(true);
  await header.getByRole("link", { name: "Deals", exact: true }).click();
  await expect(page).toHaveURL(/\/deals(?:\?|$)/);
  await page.goBack();
  await expect(page).toHaveURL(/\/(?:\?lang=en)?$/);
  await expectScope(page, "all");
});

test("Escape, Back and the current choice dismiss the sheet without changing the page", async ({
  page,
}) => {
  await page.goto("/?lang=en&condition=good");
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, 220));
  const url = page.url();
  for (const dismiss of ["escape", "back", "current"]) {
    await trigger(page).evaluate((button: HTMLButtonElement) => {
      button.focus({ preventScroll: true });
      button.click();
    });
    const dialog = page.getByRole("dialog", {
      name: "Seller type",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-browse-scope]")).toHaveCount(3);
    await expect(selected(page, "all")).toHaveAttribute("aria-pressed", "true");
    await expect(selected(page, "all")).toBeFocused();
    if (dismiss === "escape") await page.keyboard.press("Escape");
    else if (dismiss === "back") await page.goBack();
    else await selected(page, "all").click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger(page)).toBeFocused();
    await expect(page).toHaveURL(url);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(220);
    await expect
      .poll(() => page.evaluate(() => window.history.state?.shopSheet))
      .toBeUndefined();
  }
});

test("matched Home and Search captures keep one selector row at mobile and desktop widths", async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const states = [];
  for (const width of [320, 393, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 793 });
    for (const [name, route] of [
      ["home", "/"],
      ["search", "/search?q=jeans&lang=en"],
    ]) {
      await page.goto(route, { waitUntil: "networkidle" });
      await ready(page);
      await expectScope(page, "all");
      await expect(page.locator("[data-browse-scope-trigger]")).toHaveCount(1);
      await testInfo.attach(`${name}-${width}-matched`, {
        body: await page.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
      const geometry = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            ".home-shortcuts, .home-shortcuts > *, .search-form, .floating-dock",
          ),
        ].map((element) => ({
          text:
            element.getAttribute("aria-label") ??
            element.textContent!.trim().slice(0, 50),
          class: element.className,
          rect: element.getBoundingClientRect().toJSON(),
        })),
      );
      const campaigns = await page.evaluate(() => ({
        feed: document.querySelector("main")?.getAttribute("data-feed"),
        products: [...document.querySelectorAll("[data-campaign-product]")]
          .slice(0, 8)
          .map((element) => ({
            id: element.getAttribute("data-campaign-product"),
            price: element.querySelector(".campaign-price")?.textContent,
            image: element.querySelector("img")?.getAttribute("src"),
            railScroll: element.parentElement?.scrollLeft,
          })),
      }));
      states.push({ name, route, width, geometry, campaigns });
    }
  }
  expect(errors).toEqual([]);
  await testInfo.attach("matched-capture-data", {
    body: Buffer.from(
      JSON.stringify(
        {
          browser: browser.version(),
          platform: process.platform,
          errors,
          states,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
});

for (const width of [320, 393, 1024, 1440, 1920]) {
  test(`keyboard and Bulgarian large text fit the selector and sheet at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 480 : 793 });
    for (const surface of ["home", "search"]) {
      await page.goto(surface === "home" ? "/?lang=bg" : "/search?lang=bg");
      await ready(page);
      await page.addStyleTag({
        content:
          "[data-browse-scope-trigger] { font-size: 28px !important; } [data-browse-scope] { font-size: 32px !important; } dialog:has([data-browse-scope]) h2 { font-size: 40px !important; }",
      });
      await trigger(page).focus();
      const label = await trigger(page).locator("span").boundingBox();
      const before = await trigger(page).boundingBox();
      expect(label!.y).toBeGreaterThanOrEqual(before!.y);
      expect(label!.y + label!.height).toBeLessThanOrEqual(
        before!.y + before!.height,
      );
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", {
        name: "Вид продавач",
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await expect(selected(page, "all")).toBeFocused();
      const panel = await dialog.boundingBox();
      expect(panel).not.toBeNull();
      expect(panel!.x).toBeGreaterThanOrEqual(0);
      expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
      const boxes = await dialog
        .locator("[data-browse-scope]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().toJSON()),
        );
      for (const box of boxes) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(56);
        expect(box.right).toBeLessThanOrEqual(width);
      }
      for (let i = 1; i < boxes.length; i++)
        expect(boxes[i].top >= boxes[i - 1].bottom).toBe(true);
      await testInfo.attach(`${surface}-${width}-large-sheet`, {
        body: await page.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
      await selected(page, "personal").focus();
      await page.keyboard.press("Enter");
      await expectScope(page, "personal");
      await expect(trigger(page)).toBeFocused();
      const strip = page.locator(
        surface === "home" ? ".home-shortcuts" : ".filter-chips",
      );
      await expect(strip.locator("[data-browse-scope-trigger]")).toHaveCount(1);
      const button = await trigger(page).boundingBox();
      const row = await strip.boundingBox();
      expect(button!.height).toBeGreaterThanOrEqual(40);
      expect(button!.y).toBeGreaterThanOrEqual(row!.y);
      expect(button!.y + button!.height).toBeLessThanOrEqual(
        row!.y + row!.height,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}
