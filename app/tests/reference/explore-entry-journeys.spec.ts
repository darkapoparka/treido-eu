import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

async function open(page: Page) {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/explore");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await expect(
    page.getByRole("heading", { name: "Explore", exact: true }),
  ).toBeVisible();
}
async function inspect(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.decode().catch(() => undefined),
      ),
    );
  });
  await test.info().attach(name, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
}

test("Explore preserves the six captured departments and the ordered product shelves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await open(page);
  await expect(page.locator(".explore-categories h3")).toHaveText([
    "Deals",
    "Beauty",
    "Women",
    "Men",
    "Home",
    "Fitness & nutrition",
  ]);
  await expect(page.locator(".editorial-hero strong")).toHaveText(
    "High-rotation summer dresses",
  );
  await expect(page.locator(".explore-shelf h2")).toHaveText([
    "Top rated in home ›",
    "Top rated in menswear ›",
    "New in beauty ›",
    "Top rated in womenswear ›",
  ]);
  const citizenry = page
    .locator('a[href="/products/citizenry-linen"]')
    .first()
    .locator("xpath=ancestor::article[1]");
  await expect(citizenry.locator(".price-badge")).toHaveCSS(
    "background-color",
    "rgb(17, 17, 17)",
  );
  const beautyProducts = page
    .locator(".explore-shelf")
    .nth(2)
    .locator(".product-media a");
  await expect(beautyProducts).toHaveCount(2);
  expect(
    await beautyProducts.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    ),
  ).toEqual(["/products/bubble-sunrise", "/products/bare-liquid"]);
  await inspect(page, "explore-departments");
  await page.locator(".explore-minis").evaluate((element) => {
    window.scrollBy(0, element.getBoundingClientRect().top - 28);
  });
  await inspect(page, "explore-minis-and-home-shelf");
  const photos = await page
    .locator(".explore-categories img")
    .evaluateAll((images) =>
      images.every(
        (image) =>
          (image as HTMLImageElement).complete &&
          (image as HTMLImageElement).naturalWidth > 0,
      ),
    );
  expect(photos).toBe(true);
});

test("Explore keeps the captured Mini and product-shelf continuation bounded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await open(page);

  const topGeometry = await page.evaluate(() => {
    const categories = document.querySelector<HTMLElement>(
      ".explore-categories",
    );
    const minis = document.querySelector<HTMLElement>(".explore-minis");
    if (!categories || !minis)
      throw new Error("Explore continuation sections are missing");
    return {
      categoriesBottom: categories.getBoundingClientRect().bottom,
      minisTop: minis.getBoundingClientRect().top,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(topGeometry.categoriesBottom).toBeGreaterThanOrEqual(712);
  expect(topGeometry.categoriesBottom).toBeLessThanOrEqual(714);
  expect(topGeometry.minisTop).toBeGreaterThanOrEqual(792);
  expect(topGeometry.minisTop).toBeLessThanOrEqual(794);
  expect(topGeometry.documentWidth).toBeLessThanOrEqual(393);

  const minis = page.locator(".explore-minis");
  await minis.evaluate((element) => {
    window.scrollBy(0, element.getBoundingClientRect().top - 26);
  });
  await expect(minis).toContainText(
    "Analyze your skin instantly with advanced AI. Detect vi…",
  );
  const continuation = await page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>(".explore-minis h2");
    const miniChevron = document.querySelector<SVGElement>(
      ".explore-minis > a svg",
    );
    const copy = document.querySelector<HTMLElement>(".explore-minis > p");
    const rows = [
      ...document.querySelectorAll<HTMLElement>(".explore-minis a"),
    ].slice(1);
    const shelf = document.querySelector<HTMLElement>(".explore-shelf");
    const shelfHeading = shelf?.querySelector<HTMLElement>("h2");
    const shelfChevron = shelf?.querySelector<HTMLElement>("h2 span");
    const firstCard = shelf?.querySelector<HTMLElement>(".product-card");
    const firstMedia = shelf?.querySelector<HTMLElement>(".product-media");
    if (
      !heading ||
      !miniChevron ||
      !copy ||
      rows.length !== 3 ||
      !shelf ||
      !shelfHeading ||
      !shelfChevron ||
      !firstCard ||
      !firstMedia
    )
      throw new Error("Captured Explore continuation is incomplete");
    const headingRect = heading.getBoundingClientRect();
    const miniChevronRect = miniChevron.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    const rowRects = rows.map((row) => row.getBoundingClientRect());
    const shelfRect = shelf.getBoundingClientRect();
    const shelfHeadingRect = shelfHeading.getBoundingClientRect();
    const shelfChevronRect = shelfChevron.getBoundingClientRect();
    const cardRect = firstCard.getBoundingClientRect();
    const mediaRect = firstMedia.getBoundingClientRect();
    return {
      miniChevronGap: miniChevronRect.left - headingRect.right,
      copyTop: copyRect.top,
      rowTops: rowRects.map((rect) => rect.top),
      shelfTop: shelfRect.top,
      shelfHeadingHeight: shelfHeadingRect.height,
      shelfChevronWidth: shelfChevronRect.width,
      shelfChevronHeight: shelfChevronRect.height,
      cardTop: cardRect.top,
      cardWidth: cardRect.width,
      mediaHeight: mediaRect.height,
    };
  });
  expect(continuation.miniChevronGap).toBeGreaterThanOrEqual(9);
  expect(continuation.miniChevronGap).toBeLessThanOrEqual(11);
  expect(continuation.copyTop).toBeGreaterThanOrEqual(47);
  expect(continuation.copyTop).toBeLessThanOrEqual(49);
  expect(continuation.rowTops).toEqual([82, 138, 194]);
  expect(continuation.shelfTop).toBeGreaterThanOrEqual(277);
  expect(continuation.shelfTop).toBeLessThanOrEqual(279);
  expect(continuation.shelfHeadingHeight).toBeGreaterThanOrEqual(23);
  expect(continuation.shelfHeadingHeight).toBeLessThanOrEqual(25);
  expect(continuation.shelfChevronWidth).toBe(24);
  expect(continuation.shelfChevronHeight).toBe(24);
  expect(continuation.cardTop).toBeGreaterThanOrEqual(311);
  expect(continuation.cardTop).toBeLessThanOrEqual(313);
  expect(continuation.cardWidth).toBeGreaterThanOrEqual(172);
  expect(continuation.cardWidth).toBeLessThanOrEqual(174);
  expect(continuation.mediaHeight).toBeGreaterThanOrEqual(171);
  expect(continuation.mediaHeight).toBeLessThanOrEqual(173);

  const newBeautyPhoto = page
    .locator(".explore-shelf")
    .nth(2)
    .locator(".product-media img")
    .first();
  await expect(newBeautyPhoto).toHaveAttribute(
    "src",
    "/api/reference-media/explore-home-bubble-card",
  );
});

test("the Mini heading opens the real catalogue and a Mini visit survives the return to Explore", async ({
  page,
}) => {
  await open(page);
  const minis = page.getByRole("link", {
    name: "Try something new",
    exact: true,
  });
  await minis.click();
  await expect(page).toHaveURL(/\/minis$/);
  await expect(
    page.getByRole("heading", { name: "Minis", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/explore$/);
  await page.locator('.explore-minis a[href="/minis/sol"]').click();
  await expect(page).toHaveURL(/\/minis\/sol$/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/\/minis\/sol$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/explore$/);
  await minis.click();
  await expect(page).toHaveURL(/\/minis$/);
  const recent = page.locator('.mini-recent a[href="/minis/sol"]');
  await expect(recent).toHaveCount(1);
  await expect(recent).toBeVisible();
  await expect(recent).toHaveAccessibleName("Sol: Browse by Voice");
  await page.reload();
  await expect(recent).toBeVisible();
});

test("Beauty retains every captured section and its saved product uses the shared buyer state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await open(page);
  await page.locator('.explore-categories a[href="/explore/Beauty"]').click();
  await expect(page).toHaveURL(/\/explore\/Beauty$/);
  await expect(
    page.getByRole("heading", { name: "Beauty", exact: true }),
  ).toBeVisible();
  // Flow 51 contains these three editorials and six section headings in order.
  await expect(page.locator(".editorial-hero strong")).toHaveText([
    "Summer curl routine",
    "Skincare starter set",
    "Vacation-ready nails",
  ]);
  await expect(
    page.locator(".explore-page").getByRole("heading", { level: 2 }),
  ).toHaveText([
    "Top rated ›",
    "What’s new ›",
    "Scent & body",
    "Favorites for a reason",
    "Bestsellers ›",
    "Sweet deals",
  ]);
  await inspect(page, "beauty-category-top");
  await page
    .getByRole("button", {
      name: "Save Whip Volumizing Mousse",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Unsave Whip Volumizing Mousse",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  // Route commitment and rendered membership are separate assertions: cold
  // development chunks can still be in flight after the click completes.
  await page.waitForURL((url) => url.pathname === "/saved");
  await expect(
    page.locator('.saved-grid [data-product-id="whip-mousse"]'),
  ).toBeVisible();
});

test("Beauty exposes only the captured nails card and bounded next-card continuation", async ({
  page,
}) => {
  await open(page);
  await page.locator('.explore-categories a[href="/explore/Beauty"]').click();
  await expect(page).toHaveURL(/\/explore\/Beauty$/);

  const rail = page.locator(".beauty-editorial-rail");
  const continuation = page.locator(".beauty-editorial-continuation");
  await expect(rail).toContainText("Vacation-ready nails");
  await expect(continuation).toHaveAttribute("aria-hidden", "true");
  await expect(continuation).toHaveText("");
  const photograph = rail.locator(".beauty-editorial > img");
  await expect(photograph).toHaveAttribute(
    "src",
    "/api/reference-media/beauty-nails-photo",
  );
  await photograph.evaluate((image) => (image as HTMLImageElement).decode());
  const photoRatio = await photograph.evaluate((image) => {
    const photo = image as HTMLImageElement;
    return photo.naturalWidth / photo.naturalHeight;
  });
  // The complete photograph is 353 by 198, not the old enlarged top strip.
  expect(photoRatio).toBeCloseTo(353 / 198, 2);
  await expect(page.locator(".floating-dock")).toHaveAttribute(
    "data-fade",
    "true",
  );

  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const geometry = await page.evaluate(() => {
      const editorialRail = document.querySelector<HTMLElement>(
        ".beauty-editorial-rail",
      );
      const editorial =
        editorialRail?.querySelector<HTMLElement>(".beauty-editorial");
      const nextCard = editorialRail?.querySelector<HTMLElement>(
        ".beauty-editorial-continuation",
      );
      if (!editorialRail || !editorial || !nextCard)
        throw new Error("Beauty editorial continuation is missing");
      const railRect = editorialRail.getBoundingClientRect();
      const editorialRect = editorial.getBoundingClientRect();
      const nextRect = nextCard.getBoundingClientRect();
      return {
        railWidth: railRect.width,
        editorialWidth: editorialRect.width,
        editorialHeight: editorialRect.height,
        nextLeft: nextRect.left,
        nextWidth: nextRect.width,
        visibleContinuation: innerWidth - nextRect.left,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.railWidth).toBe(width - 16);
    expect(geometry.editorialWidth).toBe(width - 40);
    expect(geometry.editorialHeight).toBe(197);
    expect(geometry.nextLeft).toBe(width - 16);
    expect(geometry.nextWidth).toBe(64);
    expect(geometry.visibleContinuation).toBe(16);
    expect(geometry.documentWidth).toBeLessThanOrEqual(width);
  }
});

test("Explore and Beauty stay within the three reference widths and expose a working empty cart", async ({
  page,
}) => {
  await open(page);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Open cart", exact: true }).click();
    const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
    await expect(cart).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cart).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open cart", exact: true }),
    ).toBeFocused();
  }
  await page.locator('.explore-categories a[href="/explore/Beauty"]').click();
  await expect(page).toHaveURL(/\/explore\/Beauty$/);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
