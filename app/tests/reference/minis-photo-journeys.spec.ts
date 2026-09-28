import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const skinResultMedia: Record<string, string> = {
  "skin-anua": "skin-card-anua",
  "skin-mimi": "skin-card-mimi",
  "skin-loretta": "skin-card-loretta",
  "skin-harry": "skin-card-harry",
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await useReferenceScenario(page, "home-welcome");
});

test("Skin's recorded flow retains products, returns by history, and never starts camera or network analysis", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await page.goto("/minis/skin");
  await expect(page.locator('[data-skin-phase="welcome"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze My Skin", exact: true })
    .click();
  const permission = page.getByRole("dialog", {
    name: "Allow access to your camera?",
    exact: true,
  });
  await expect(permission).toContainText("No camera access is requested");
  const permissionSurface = page.locator('[data-skin-phase="welcome"]');
  await expect(permissionSurface).toHaveAttribute(
    "data-camera-permission",
    "true",
  );
  await expect
    .poll(() =>
      permissionSurface
        .locator(".skin-heading h1")
        .evaluate((heading) => getComputedStyle(heading).fontFamily),
    )
    .toContain("Times New Roman");
  await expect
    .poll(async () => {
      const bounds = await permission.boundingBox();
      const gap = Math.round(
        793 - (bounds?.y ?? 0) - (bounds?.height ?? Number.POSITIVE_INFINITY),
      );
      return gap >= 31 && gap <= 33;
    })
    .toBe(true);
  const permissionBounds = await permission.boundingBox();
  expect(Math.round(permissionBounds?.x ?? -1)).toBeGreaterThanOrEqual(16);
  expect(Math.round(permissionBounds?.x ?? -1)).toBeLessThanOrEqual(17);
  expect(Math.round(permissionBounds?.width ?? -1)).toBeGreaterThanOrEqual(359);
  expect(Math.round(permissionBounds?.width ?? -1)).toBeLessThanOrEqual(361);
  expect(Math.round(permissionBounds?.height ?? -1)).toBeLessThanOrEqual(194);
  await expect
    .poll(() =>
      permission
        .locator('img[src="/api/reference-media/skin-permission-avatar"]')
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await permission.getByRole("button", { name: "Share", exact: true }).click();
  const choose = page.getByRole("dialog", {
    name: "Choose a photo",
    exact: true,
  });
  await expect(choose).toContainText("No photo is uploaded or analyzed");
  await expect(
    choose.getByRole("button", { name: "Photo Library", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Skincare AI preview controls", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View reference example", exact: true })
    .click();
  await expect(page.locator('[data-skin-phase="analyzing"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Overall Skin Summary", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  const firstSummaryBounds = await page
    .locator(".skin-summary")
    .first()
    .boundingBox();
  expect(Math.round(firstSummaryBounds?.y ?? -1)).toBeGreaterThanOrEqual(131);
  expect(Math.round(firstSummaryBounds?.y ?? -1)).toBeLessThanOrEqual(134);
  const cleanserBounds = await page
    .getByRole("heading", { name: "Cleanser", exact: true })
    .boundingBox();
  expect(Math.round(cleanserBounds?.y ?? -1)).toBeGreaterThanOrEqual(408);
  expect(Math.round(cleanserBounds?.y ?? -1)).toBeLessThanOrEqual(411);
  for (const id of ["skin-anua", "skin-mimi", "skin-loretta", "skin-harry"]) {
    const card = page.locator(
      `.skin-results .product-card:has(a[href="/products/${id}"])`,
    );
    await expect(card).toHaveCount(1);
    await expect(card.locator(".product-media > a > img")).toHaveAttribute(
      "src",
      `/api/reference-media/${skinResultMedia[id]}`,
    );
  }
  await expect(page.locator(".skin-results")).toContainText(
    "no skin analysis performed",
  );
  await page.goBack();
  await expect(page.locator('[data-skin-phase="welcome"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-skin-phase="results"]')).toBeVisible();
  expect(writes).toEqual([]);
});

test("Back cancels an in-progress skin replay and restores the Analyze control", async ({
  page,
}) => {
  await page.goto("/minis/skin");
  await page
    .getByRole("button", { name: "Analyze My Skin", exact: true })
    .click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Skincare AI preview controls", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View reference example", exact: true })
    .click();
  await expect(page.locator('[data-skin-phase="analyzing"]')).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Analyze My Skin", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(2700);
  await expect(page.locator('[data-skin-phase="welcome"]')).toBeVisible();
  await expect(page.locator('[data-skin-phase="results"]')).toHaveCount(0);
});

test("Get the Look connects source hotspots, selected panel, all result groups and Back/Forward", async ({
  page,
}) => {
  await page.goto("/minis/look");
  await expect(
    page.getByRole("complementary", { name: "Get the Look terms notice" }),
  ).toBeVisible();
  const termsNotice = page.getByRole("complementary", {
    name: "Get the Look terms notice",
  });
  await expect(termsNotice).toHaveCSS("padding", "16.5px 20px");
  await expect(termsNotice).toHaveCSS("background-color", "rgb(42, 42, 42)");
  const termsCopy = termsNotice.locator("p");
  await expect(termsCopy).toHaveCSS("font-weight", "375");
  await expect(termsCopy).toHaveCSS("letter-spacing", "-0.02px");
  await expect(termsCopy).toHaveCSS("translate", "0.25px");
  const dismissTerms = termsNotice.getByRole("button", {
    name: "Dismiss Get the Look terms notice",
    exact: true,
  });
  await expect(dismissTerms).toHaveCSS("width", "28px");
  await expect(dismissTerms).toHaveCSS("height", "28px");
  await page
    .getByRole("button", {
      name: "Dismiss Get the Look terms notice",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Choose Photo", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Get the Look preview controls", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use reference outfit", exact: true })
    .click();
  await expect(page.locator('[data-look-phase="scanning"]')).toBeVisible();
  await page
    .getByRole("button", { name: "View captured matches", exact: true })
    .click();
  await expect(page.locator('[data-look-phase="results"]')).toBeVisible();
  await expect(page.locator(".look-photo > img")).toHaveAttribute(
    "src",
    "/api/reference-media/look-outfit-results",
  );
  const blazerCards = page.locator("#look-blazer .product-card");
  await expect(blazerCards).toHaveCount(2);
  await expect(
    blazerCards.nth(0).locator(".product-media img"),
  ).toHaveAttribute("src", "/api/reference-media/look-blazer-one-card");
  await expect(
    blazerCards.nth(1).locator(".product-media img"),
  ).toHaveAttribute("src", "/api/reference-media/look-blazer-two-card");
  await expect(page.locator("#look-blazer")).toContainText("$188.00");
  await expect(page.locator("#look-shirt")).toContainText("$23.00");
  for (const card of await blazerCards.all()) {
    const bounds = await card.boundingBox();
    expect(Math.round(bounds?.width ?? -1)).toBe(150);
    expect(Math.round(bounds?.height ?? -1)).toBe(200);
  }
  const shirt = page.getByRole("button", {
    name: "Women’s Black Crew Neck T-shirt",
    exact: true,
  });
  await shirt.click();
  await expect(shirt).toHaveAttribute("aria-pressed", "true");
  const selected = page.getByRole("region", {
    name: "Selected outfit piece",
    exact: true,
  });
  await expect(selected).toContainText("Selected");
  await expect(selected.getByRole("heading")).toHaveText(
    "Women’s Black Crew Neck T-shirt",
  );
  await expect(page.locator(".look-photo")).toBeVisible();
  const before = await page.evaluate(() => scrollY);
  expect(before).toBeLessThan(40);
  await page.goBack();
  await expect(shirt).toHaveAttribute("aria-pressed", "false");
  await expect(selected).toHaveCount(0);
  await page.goForward();
  await expect(shirt).toHaveAttribute("aria-pressed", "true");
  const allMatches = page.getByRole("button", {
    name: "View all matching pieces",
    exact: true,
  });
  await allMatches.focus();
  const selectedScroll = await page.evaluate(() => scrollY);
  await allMatches.press("Enter");
  await expect(selected).toHaveCount(0);
  await expect
    .poll(async () =>
      Math.round((await page.locator("#look-blazer").boundingBox())?.y ?? -1),
    )
    .toBe(70);
  await expect(page.locator(".look-results section[id]")).toHaveCount(3);
  const blazerHeading = page.locator("#look-blazer > h2");
  const shirtHeading = page.locator("#look-shirt > h2");
  const skirtHeading = page.locator("#look-skirt > h2");
  await expect(blazerHeading).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, -1.5, -4)",
  );
  await expect(shirtHeading).toHaveCSS("font-weight", "500");
  await expect(skirtHeading).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, -0.75, 1)",
  );
  await expect(page.locator("#look-shirt > .product-rail")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, -0.5)",
  );
  const resultCopy = page.locator("#look-blazer .product-copy").first();
  await expect(resultCopy).toHaveCSS("translate", "0.5px -1.5px");
  await expect(resultCopy).toHaveCSS("opacity", "0.94");
  await expect(resultCopy.locator("strong")).toHaveCSS(
    "letter-spacing",
    "0.15px",
  );
  await expect(resultCopy.locator(":scope > span:last-child")).toHaveCSS(
    "letter-spacing",
    "0.1px",
  );
  await expect(page.locator("#look-blazer > h2")).toBeFocused();
  await expect(
    page.locator('.look-results a[href="/products/look-black-crew"]').first(),
  ).toBeVisible();
  await page.goBack();
  await expect(selected).toBeVisible();
  await expect(shirt).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "View all matching pieces", exact: true }),
  ).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(selectedScroll);
  await page.goForward();
  await expect(selected).toHaveCount(0);
  await expect
    .poll(async () =>
      Math.round((await page.locator("#look-blazer").boundingBox())?.y ?? -1),
    )
    .toBe(70);

  for (const [piece, height] of [
    ["blazer", 200],
    ["shirt", 200],
    ["skirt", 64],
  ] as const) {
    const boundary = page.locator(`[data-look-source-boundary="${piece}"]`);
    await expect(boundary).toBeAttached();
    await expect(boundary.locator("a, button")).toHaveCount(0);
    const bounds = await boundary.boundingBox();
    expect(Math.round(bounds?.x ?? -1), `${piece} boundary x`).toBe(352);
    expect(Math.round(bounds?.width ?? -1), `${piece} boundary width`).toBe(41);
    expect(Math.round(bounds?.height ?? -1), `${piece} boundary height`).toBe(
      height,
    );
    await expect
      .poll(() =>
        boundary
          .locator("img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
  }
});

test("the native-photo boundary offers a local file, cancels cleanly, and keeps mobile widths contained", async ({
  page,
}) => {
  await page.goto("/minis/look");
  const termsNotice = page.getByRole("complementary", {
    name: "Get the Look terms notice",
  });
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const noticeBounds = await termsNotice.boundingBox();
    expect(Math.round(noticeBounds?.x ?? -1), `Terms x at ${width}px`).toBe(8);
    expect(
      Math.round(noticeBounds?.width ?? -1),
      `Terms width at ${width}px`,
    ).toBe(width - 16);
    const viewport = await page.evaluate(() => ({
      client: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(viewport.scroll, `Terms overflow at ${width}px`).toBeLessThanOrEqual(
      viewport.client,
    );
  }
  await page.setViewportSize({ width: 393, height: 793 });
  await page.getByRole("button", { name: "Choose Photo", exact: true }).click();
  const chooser = page.getByRole("dialog", {
    name: "Choose Photo",
    exact: true,
  });
  await expect(chooser.getByLabel("Choose local image")).toHaveAttribute(
    "accept",
    "image/*",
  );
  await expect(chooser.getByRole("button")).toHaveText([
    "Photo Library",
    "Take Photo",
    "Choose File",
  ]);
  await expect(chooser.getByLabel("Take a local photo")).toHaveAttribute(
    "capture",
    "user",
  );
  const menuBounds = await chooser.boundingBox();
  expect(menuBounds?.width).toBe(250);
  expect(menuBounds?.height).toBe(146);
  const choosePhoto = page.getByRole("button", {
    name: "Choose Photo",
    exact: true,
  });
  await choosePhoto.evaluate((element) =>
    element.addEventListener(
      "focus",
      () => {
        element.dataset.sheetEntryAtFocus = String(
          Boolean(window.history.state?.shopSheet),
        );
      },
      { once: true },
    ),
  );
  await page.keyboard.press("Escape");
  await expect(chooser).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose Photo", exact: true }),
  ).toBeFocused();
  await expect(choosePhoto).toHaveAttribute(
    "data-sheet-entry-at-focus",
    "false",
  );
  await page.goto("/minis/look?look=results");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const sizes = await page.evaluate(() => ({
      client: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(sizes.scroll, `Outfit at ${width}px`).toBeLessThanOrEqual(
      sizes.client,
    );
    await expect(
      page.getByRole("button", {
        name: "Women’s Gold Embellished Sandals",
        exact: true,
      }),
    ).toBeVisible();
  }
});

test("every photo menu choice opens a local picker and never starts a recorded analysis", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await page.goto("/minis/look");
  const fixture = {
    name: "local-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWPo6OgAAAM0AZmUse0HAAAAAElFTkSuQmCC",
      "base64",
    ),
  };
  for (const name of ["Photo Library", "Take Photo", "Choose File"]) {
    await page
      .getByRole("button", { name: "Choose Photo", exact: true })
      .click();
    const chooser = page.getByRole("dialog", {
      name: "Choose Photo",
      exact: true,
    });
    const fileChooser = page.waitForEvent("filechooser");
    await chooser.getByRole("button", { name, exact: true }).click();
    await (await fileChooser).setFiles(fixture);
    const preview = page.getByRole("dialog", {
      name: "Photo preview",
      exact: true,
    });
    await expect(
      preview.getByRole("img", { name: "Selected local image" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        preview
          .getByRole("img", { name: "Selected local image" })
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBe(1);
    await expect(preview.getByRole("status")).toContainText(
      "No photo is uploaded or analyzed",
    );
    await expect(page.locator('[data-look-phase="welcome"]')).toBeAttached();
    await expect(
      page.locator('[data-look-phase="scanning"], [data-look-phase="results"]'),
    ).toHaveCount(0);
    await page.goBack();
    await expect(preview).not.toBeVisible();
    await expect(page).toHaveURL(/\/minis\/look$/);
  }
  expect(writes).toEqual([]);
});

test("Skin welcome retains the source action rhythm and permission focus at sibling widths", async ({
  page,
}) => {
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await page.goto("/minis/skin");
    const surface = page.locator('[data-skin-phase="welcome"]');
    const analyze = page.getByRole("button", {
      name: "Analyze My Skin",
      exact: true,
    });
    await expect(analyze).toHaveCSS("height", "48px");
    const before = await analyze.boundingBox();
    expect(before).not.toBeNull();
    if (width === 393)
      expect(Math.abs((before?.y ?? 0) - 407)).toBeLessThanOrEqual(1);
    expect(
      await surface.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await analyze.focus();
    await analyze.press("Enter");
    const permission = page.getByRole("dialog", {
      name: "Allow access to your camera?",
      exact: true,
    });
    await expect(permission).toBeVisible();
    const during = await analyze.boundingBox();
    expect(Math.abs((during?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(
      1,
    );
    await page.keyboard.press("Escape");
    await expect(permission).not.toBeVisible();
    await expect(analyze).toBeFocused();
  }
  await page.setViewportSize({ width: 393, height: 540 });
  await page.goto("/minis/skin");
  const note = page.locator(".skin-surface > small");
  await note.scrollIntoViewIfNeeded();
  const noteBounds = await note.boundingBox();
  expect(
    (noteBounds?.y ?? 540) + (noteBounds?.height ?? 1),
  ).toBeLessThanOrEqual(540);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
