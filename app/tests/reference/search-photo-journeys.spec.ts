import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

async function openPhotoHistory(page: Page) {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/search");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await expect(
    page.locator('[data-captured-search-continuation="photo"]'),
  ).toBeVisible();
}

test("photo history keeps the source-bounded fourth fragment and chooser sheet at mobile widths", async ({
  page,
}) => {
  await openPhotoHistory(page);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const fragment = page.locator(
      '[data-captured-search-continuation="photo"]',
    );
    const geometry = await fragment.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        width: bounds.width,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(geometry.width).toBeGreaterThanOrEqual(15);
    expect(geometry.width).toBeLessThanOrEqual(17);
    expect(geometry.overflow).toBe(false);
  }

  await button(page, "Add photos").click();
  const chooser = page.getByRole("dialog", { name: "Add photos", exact: true });
  await expect(chooser).toBeVisible();
  await expect
    .poll(() =>
      chooser.evaluate((element) => element.getBoundingClientRect().bottom),
    )
    .toBeLessThanOrEqual(793);
  const chooserGeometry = await chooser.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const firstRow = element.querySelector<HTMLElement>(".account-row");
    const rowStyle = firstRow ? getComputedStyle(firstRow) : null;
    return {
      height: bounds.height,
      bottom: bounds.bottom,
      rowTextAlign: rowStyle?.textAlign,
      rowWidth: firstRow?.getBoundingClientRect().width ?? 0,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(chooserGeometry.height).toBeLessThanOrEqual(195);
  expect(chooserGeometry.bottom).toBeLessThanOrEqual(793);
  expect(chooserGeometry.rowTextAlign).toBe("left");
  expect(chooserGeometry.rowWidth).toBeGreaterThan(250);
  expect(chooserGeometry.overflow).toBe(false);
});

test("the captured example naturally reaches the bounded photo answer", async ({
  page,
}) => {
  await openPhotoHistory(page);
  await button(page, "Add photos").click();
  await button(page, "Use captured cap example").click();
  await expect(page.getByRole("img", { name: "Selected photo" })).toBeVisible();
  const selectedSource = await page
    .getByRole("img", { name: "Selected photo" })
    .getAttribute("src");
  await expect(
    page.getByRole("textbox", { name: "Search products", exact: true }),
  ).toBeFocused();
  await button(page, "Submit search").click();
  await expect(page).toHaveURL(/\/assistant\?example=photo$/);
  await expect(page.locator(".photo-tag img")).toHaveAttribute(
    "src",
    selectedSource!,
  );
  await expect(
    page.locator('[data-photo-recommendation="source-bounded-third"]'),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Close assistant", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(
    page.getByRole("img", { name: "Selected photo", exact: true }),
  ).toHaveAttribute("src", selectedSource!);
  await expect(
    page.getByRole("search", { name: "Search products", exact: true }),
  ).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/assistant\?example=photo$/);
  await page
    .getByRole("link", { name: "Close assistant", exact: true })
    .click();
  await expect(
    page.getByRole("search", { name: "Search products", exact: true }),
  ).toBeFocused();
});

test("the partial third recommendation stays bounded, invents no destination, and restores focus", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo");
  const fragment = page.locator(
    '[data-photo-recommendation="source-bounded-third"]',
  );
  await fragment.scrollIntoViewIfNeeded();
  await expect(fragment).toBeVisible();
  await expect(fragment.locator("a")).toHaveCount(0);
  const trigger = fragment.getByRole("button", {
    name: "View source-bounded recommendation",
    exact: true,
  });
  const width = await fragment.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  expect(width).toBeGreaterThanOrEqual(54);
  expect(width).toBeLessThanOrEqual(56);

  await trigger.click();
  const boundary = page.getByRole("dialog", {
    name: "Source-bounded recommendation",
    exact: true,
  });
  await expect(boundary).toBeVisible();
  await expect(boundary).toContainText(
    "complete seller, title, destination, variants, and inventory",
  );
  await boundary.getByRole("button", { name: /^Close / }).click();
  await expect(boundary).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("photo answer edit search and Back preserve history without horizontal overflow", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow).toBe(false);
  }
  await page.getByRole("link", { name: "Edit search", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?edit=photo$/);
  await expect(
    page.getByRole("textbox", { name: "Search products", exact: true }),
  ).toHaveValue("Find me a baseball cap like this");
  await expect(
    page.getByRole("img", { name: "Selected photo", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/assistant\?example=photo$/);
  await expect(
    page.locator('[data-photo-recommendation="source-bounded-third"]'),
  ).toBeVisible();
});

test("photo answer typography keeps the captured text offsets scoped", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo");
  await page.evaluate(() => document.fonts.ready);

  const title = page.getByRole("heading", {
    name: "Find me a baseball cap like this",
    exact: true,
  });
  await expect(title).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -1)");

  const headings = page.locator(".photo-assistant > h2");
  await expect(headings).toHaveCount(2);
  await expect(headings.nth(0)).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, -1)",
  );
  await expect(headings.nth(1)).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, -2)",
  );

  const notes = page.locator(".photo-assistant > .form-note");
  await expect(notes).toHaveCount(2);
  await expect(notes.nth(0)).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, -1)",
  );
  await expect(notes.nth(1)).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 1, -2)",
  );
  const comparisonCopy = page.locator(
    '.photo-assistant > p[class*="photoComparisonCopy"]',
  );
  await expect(comparisonCopy).toHaveCSS("letter-spacing", "normal");
  await expect(comparisonCopy).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 1, 0)",
  );

  const brandCopy = page.locator(
    ".photo-assistant > .assistant-answer-card:nth-of-type(2) + p",
  );
  await expect(brandCopy).toHaveCSS("letter-spacing", "-0.08px");
  await expect(brandCopy).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0.5, 1)");

  const preferenceQuestion = page.locator(
    ".photo-assistant > .assistant-answer-card:nth-of-type(2) + p + p",
  );
  await expect(preferenceQuestion).toHaveCSS("letter-spacing", "-0.12px");
  await expect(preferenceQuestion).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, -1, 1)",
  );
});
test("photo comparison preserves source framing and non-interactive gallery indicators", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo");
  const cards = page.locator("[data-photo-comparison]");
  await expect(cards).toHaveCount(2);
  await expect(
    cards.nth(0).locator(".product-media > :is(a, button) > img"),
  ).toHaveAttribute(
    "src",
    "/api/reference-media/assistant-dad-comparison-photo",
  );
  await expect(
    cards.nth(1).locator(".product-media > :is(a, button) > img"),
  ).toHaveAttribute(
    "src",
    "/api/reference-media/assistant-armor-comparison-photo",
  );
  await expect(
    cards.nth(1).locator(".product-media > span[aria-hidden='true'] > i"),
  ).toHaveCount(9);
  await expect(
    cards.nth(1).locator("img[src$='/assistant-armor-logo']"),
  ).toHaveCount(1);
  await expect(
    page
      .locator('[data-photo-recommendation="assistant-mobbin-merch-cap"]')
      .getByRole("img", { name: "5 out of 5 stars" }),
  ).toBeVisible();
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await cards.first().scrollIntoViewIfNeeded();
    const geometry = await cards.evaluateAll((elements) => {
      const first = elements[0]!.getBoundingClientRect();
      const second = elements[1]!.getBoundingClientRect();
      const photos = elements.map((element) =>
        element.querySelector(".product-media")!.getBoundingClientRect(),
      );
      return {
        gap: second.top - first.bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
        photos: photos.map(({ width, height }) => ({ width, height })),
      };
    });
    expect(geometry.gap).toBeCloseTo(16, 0);
    expect(geometry.overflow).toBe(false);
    if (width === 393)
      for (const photo of geometry.photos) {
        expect(photo.width).toBeCloseTo(166, 0);
        expect(photo.height).toBeCloseTo(166, 0);
      }
  }
});

test("photo comparison boundaries remain keyboard accessible without inventing product routes", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo");
  const steps = page.getByRole("button", { name: /^Assistant steps/ });
  await steps.click();
  for (const title of ["Mobbin Dad Hat", "Mob Armor Snapback"]) {
    const trigger = page
      .locator(".photo-assistant > p")
      .getByRole("button", { name: title, exact: true });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await trigger.press("Enter");
    const boundary = page.getByRole("dialog", {
      name: "Product details unavailable",
      exact: true,
    });
    await expect(boundary).toBeVisible();
    await expect(boundary).toContainText(
      "has not been opened, saved, or added to a cart",
    );
    await expect(page).toHaveURL(/\/assistant\?example=photo&steps=1$/);
    await boundary.getByRole("button", { name: /^Close / }).click();
    await expect(boundary).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(steps).toHaveAttribute("aria-expanded", "true");
    if (title === "Mob Armor Snapback") {
      // The source splits this inline action after "Mob", not before its whole title.
      expect(await trigger.evaluate((el) => el.getClientRects().length)).toBe(
        2,
      );
      await trigger.press("Space");
      await expect(boundary).toBeVisible();
      await page.goBack();
      await expect(boundary).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(steps).toHaveAttribute("aria-expanded", "true");
    }
  }
  await expect(
    page.locator('.photo-assistant a[href^="/products/assistant-"]'),
  ).toHaveCount(0);
});

test("editing the captured answer restores its photo, question and disclosure history", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo");
  const steps = button(page, "Assistant steps");
  await steps.click();
  await expect(steps).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "Edit search", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?edit=photo$/);
  const input = page.getByRole("textbox", {
    name: "Search products",
    exact: true,
  });
  await expect(input).toHaveValue("Find me a baseball cap like this");
  await expect(input).toBeFocused();
  await expect(
    page.getByRole("img", { name: "Selected photo", exact: true }),
  ).toHaveAttribute("src", "/api/reference-media/assistant-uploaded-cap");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/assistant\?example=photo&steps=1$/);
  await expect(steps).toHaveAttribute("aria-expanded", "true");
  await page.goForward();
  await expect(page).toHaveURL(/\/search\?edit=photo$/);
  await expect(input).toHaveValue("Find me a baseball cap like this");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/assistant\?example=photo$/);
  await expect(steps).toHaveAttribute("aria-expanded", "false");
});

test("a different question about the example photo never receives an unrelated recorded answer", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/search?edit=photo");
  const input = page.getByRole("textbox", {
    name: "Search products",
    exact: true,
  });
  await input.fill("Find a waterproof hiking hat instead");
  await input.press("Enter");
  const unavailable = page.getByRole("dialog", {
    name: "Photo search unavailable",
    exact: true,
  });
  await expect(unavailable).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/search");
  await expect(unavailable).toContainText("different question");
  await expect(
    unavailable.getByRole("link", {
      name: "View captured example",
      exact: true,
    }),
  ).toHaveAttribute("href", "/assistant?example=photo");
  await unavailable.getByRole("button", { name: /^Close / }).click();
  await expect(input).toHaveValue("Find a waterproof hiking hat instead");
  await expect(
    page.getByRole("img", { name: "Selected photo", exact: true }),
  ).toBeVisible();
});

test("captured cap title controls retain the same honest boundary and keyboard focus as their images", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo");
  const title = page
    .locator('[data-photo-recommendation="assistant-cap"] strong')
    .getByRole("button", { name: "Mobbin Dad Hat", exact: true });
  await title.focus();
  await title.press("Enter");
  const unavailable = page.getByRole("dialog", {
    name: "Product details unavailable",
    exact: true,
  });
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toContainText(
    "not been opened, saved, or added to a cart",
  );
  await unavailable.getByRole("button", { name: /^Close / }).click();
  await expect(title).toBeFocused();
  expect(new URL(page.url()).pathname).toBe("/assistant");
});

test("photo answer composer preserves the measured frosted mobile surface", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo&steps=1");
  const composer = page.getByRole("textbox", {
    name: "Ask a follow-up",
    exact: true,
  });
  await expect(composer).toBeVisible();
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const geometry = await composer.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        height: rect.height,
        bottomGap: innerHeight - rect.bottom,
        backgroundColor: getComputedStyle(node).backgroundColor,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(geometry).toEqual({
      height: 56,
      bottomGap: 36,
      backgroundColor: "rgba(255, 255, 255, 0.976)",
      overflow: false,
    });
  }
});

test("structured photo continuations retain only their captured pixels and leave the composer usable", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/assistant?example=photo");
  const fragments = page.locator('[data-source-boundary^="structured-"]');
  await expect(fragments).toHaveCount(3);
  await expect(fragments.locator("a,button,input")).toHaveCount(0);
  for (const [index, position] of ["first", "second", "third"].entries())
    await expect(fragments.nth(index).locator("img")).toHaveAttribute(
      "src",
      `/api/reference-media/assistant-structured-${position}-fragment`,
    );
  await expect(fragments.locator("strong,b")).toHaveCount(0);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const geometry = await fragments.evaluateAll((elements) => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      cards: elements.map((element) => ({
        width: element.getBoundingClientRect().width,
        imageHeight: element.querySelector("img")!.getBoundingClientRect()
          .height,
      })),
    }));
    expect(geometry.overflow).toBe(false);
    expect(geometry.cards.map((card) => card.width)).toEqual([152, 152, 56]);
    expect(geometry.cards.map((card) => card.imageHeight)).toEqual([
      86, 86, 86,
    ]);
    await page
      .getByRole("textbox", { name: "Ask a follow-up", exact: true })
      .fill("Keep this draft");
  }
  const boundedCard = page.locator(
    '[data-source-boundary="partial-third"] > button',
  );
  await expect(boundedCard).toHaveCSS("border-top-right-radius", "0px");
  await expect(boundedCard).toHaveCSS("border-bottom-right-radius", "0px");
  await page
    .getByRole("link", { name: "Close assistant", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/assistant\?example=photo$/);
  await expect(fragments).toHaveCount(3);
  await expect(
    page.getByRole("textbox", { name: "Ask a follow-up", exact: true }),
  ).toHaveValue("Keep this draft");
});

test("a pending local photo and question survive viewing the separate captured answer", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-photo");
  await page.goto("/search");
  await button(page, "Add photos").click();
  const chooser = page.getByRole("dialog", { name: "Add photos", exact: true });
  await chooser
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "local-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nVQAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  const input = page.getByRole("textbox", {
    name: "Search products",
    exact: true,
  });
  await input.fill("Find soap in this photo");
  const photo = page.getByRole("img", { name: "Selected photo", exact: true });
  const original = await photo.getAttribute("src");
  expect(original).toMatch(/^blob:/);
  await input.press("Enter");
  await page
    .getByRole("dialog", { name: "Photo search unavailable", exact: true })
    .getByRole("link", { name: "View captured example", exact: true })
    .click();
  await expect(page).toHaveURL(/\/assistant\?example=photo$/);
  await page
    .getByRole("link", { name: "Close assistant", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(input).toHaveValue("Find soap in this photo");
  await expect(
    page.getByRole("search", { name: "Search products", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("dialog", { name: "Photo search unavailable", exact: true }),
  ).toHaveCount(0);
  await expect(photo).toHaveAttribute("src", original!);
  await expect
    .poll(() =>
      photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  await button(page, "Remove selected photo").click();
  await expect(photo).toHaveCount(0);
});
