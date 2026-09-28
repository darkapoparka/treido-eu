import { expect, test, type Page } from "@playwright/test";

const base = () => String(test.info().project.use.baseURL);
async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator("img:visible").evaluateAll(async (images) => {
    await Promise.all(
      images.map((image) =>
        (image as HTMLImageElement).decode().catch(() => undefined),
      ),
    );
  });
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});

test("current Explore Mini entry closes to the same source and returns focus", async ({
  page,
}) => {
  await page.goto("/explore");
  for (const id of ["makeup", "look", "picnic"])
    await expect(
      page.locator(`.android-explore a[href='/minis/${id}']`),
    ).toHaveCount(1);
  const opener = page.locator(".android-explore a[href='/minis/picnic']");
  await opener.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await opener.click();
  await expect(page).toHaveURL(/\/minis\/picnic$/);
  await expect(
    page.getByRole("heading", { name: "Sign in required" }),
  ).toBeVisible();
  await expect(page.locator(".native-mini-access")).toContainText(
    "Please sign in to your Shop account to load Picnic Gift Registry.",
  );
  await page.getByRole("link", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(opener).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
});

test("current Mini carousel keeps source rail position through guest Gift Sense", async ({
  page,
}) => {
  await page.goto("/minis");
  await expect(page.locator(".mini-carousel .mini-feature strong")).toHaveText([
    "Makeup Master",
    "Get the Look",
    "Picnic Gift Registry",
    "Gift Sense",
  ]);
  const opener = page.locator(".mini-carousel a[href='/minis/gift']");
  await opener.scrollIntoViewIfNeeded();
  const position = await page
    .locator(".mini-carousel")
    .evaluate((e) => e.scrollLeft);
  await opener.click();
  await expect(page).toHaveURL(/\/minis\/gift$/);
  await expect(
    page.getByRole("heading", { name: "Sign in required" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(/\/minis$/);
  await expect(opener).toBeFocused();
  await expect
    .poll(() => page.locator(".mini-carousel").evaluate((e) => e.scrollLeft))
    .toBeCloseTo(position, 0);
});

test("native Mini search is route-backed, clearable and cancellable", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/minis");
  const opener = page.getByRole("button", {
    name: "Search Minis",
    exact: true,
  });
  await opener.click();
  await expect(page).toHaveURL(/search=1/);
  const input = page.getByRole("searchbox", { name: "Search Minis" });
  await expect(input).toBeFocused();
  await input.fill("Makeup");
  await expect(page).toHaveURL(/q=Makeup/);
  await expect(page.locator(".native-mini-search-results strong")).toHaveText([
    "Makeupify",
    "Makeup Master",
    "Glow Coach",
  ]);
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/minis$/);
  await expect(opener).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/search=1/);
  await expect(input).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test("Makeup phases preserve browser history and direct links have an in-Mini return", async ({
  page,
}) => {
  await page.goto("/minis/makeup");
  await page
    .getByRole("button", { name: "Your past makeups", exact: true })
    .click();
  await expect(page).toHaveURL(/makeup=history/);
  await expect(
    page.getByRole("heading", { name: "Your past makeups" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/minis\/makeup$/);
  await page.goForward();
  await expect(page).toHaveURL(/makeup=history/);
  await page.getByRole("button", { name: "Back to Makeup Master" }).click();
  await expect(page).toHaveURL(/\/minis\/makeup$/);
  await page.goto("/minis/makeup?makeup=upload");
  await expect(
    page.getByRole("heading", { name: "Upload your best selfie" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go back in Mini" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Back to Makeup Master" }).click();
  await expect(page).toHaveURL(/\/minis\/makeup$/);
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
});

test("native Mini host restores focus and does not invent a provider document", async ({
  page,
}) => {
  await page.goto("/minis/makeup");
  const opener = page.getByRole("button", { name: "About Makeup Master" });
  await opener.click();
  await expect(page).toHaveURL(/miniMenu=1/);
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".mini-native-content")).toHaveAttribute(
    "inert",
    "",
  );
  await page.getByRole("button", { name: "Terms and conditions" }).click();
  await expect(page).toHaveURL(/miniDocument=terms/);
  await expect(page.locator(".mini-native-document")).toContainText(
    "No agreement has been accepted.",
  );
  await expect(page.locator(".mini-native-document iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Close provider page" }).click();
  await expect(page).toHaveURL(/\/minis\/makeup$/);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("Get the Look opens the verified provider URL and closes its browser frame", async ({
  page,
  context,
}) => {
  await context.route("https://get-the-look.lit.dog/privacy", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<main>Isolated provider route fixture</main>",
    }),
  );
  await page.goto("/minis/look?look=results");
  await expect(page.locator(".look-surface")).toHaveAttribute(
    "data-look-phase",
    "welcome",
  );
  await expect(page.locator(".look-results")).toHaveCount(0);
  await page.getByRole("button", { name: "About Get the Look" }).click();
  await page
    .getByRole("button", { name: "Privacy policy", exact: true })
    .click();
  await expect(page.locator(".mini-native-document iframe")).toHaveAttribute(
    "src",
    "https://get-the-look.lit.dog/privacy",
  );
  await expect(
    page.frameLocator(".mini-native-document iframe").locator("main"),
  ).toHaveText("Isolated provider route fixture");
  await page.getByRole("button", { name: "Close provider page" }).click();
  await expect(page).not.toHaveURL(/miniDocument/);
  await expect(
    page.getByRole("button", { name: "About Get the Look" }),
  ).toBeFocused();
});

for (const [route, action] of [
  ["look", "Choose Photo"],
  ["makeup?makeup=upload", "Upload image"],
]) {
  test(`native ${route} photo selection can be cancelled and rejects invalid files without analysis`, async ({
    page,
  }) => {
    await page.goto(`/minis/${route}`);
    const opener = page.getByRole("button", { name: action, exact: true });
    await opener.click();
    await expect(
      page.getByRole("dialog", { name: "Allow access to your camera?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(opener).toBeFocused();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await opener.click();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const picker = page.locator("dialog[open]");
    await expect(picker).toHaveCount(1);
    await picker
      .locator('input[aria-label="Choose local image"]')
      .setInputFiles({
        name: "not-an-image.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      });
    await expect(picker.getByRole("alert")).toHaveText("Choose an image file.");
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(page.locator(".look-results")).toHaveCount(0);
  });
}

test("Match Striker clean gallery retains its selected photo, save state and quantity", async ({
  page,
}) => {
  await page.goto("/products/live-cozy-match-striker");
  await ready(page);
  const gallery = page.locator(".product-gallery");
  await expect(gallery.locator("img")).toHaveCount(2);
  await expect(gallery.locator("img").first()).toHaveAttribute(
    "src",
    "/api/reference-media/live-cozy-match-striker-pdp",
  );
  await gallery.getByRole("button", { name: "View product image 1" }).click();
  const photos = page.getByRole("group", {
    name: "Product photos. Use Left and Right arrow keys to change photo.",
  });
  await photos.focus();
  await page.keyboard.press("ArrowRight");
  await expect(photos.locator("img")).toHaveAttribute(
    "src",
    "/api/reference-media/live-cozy-match-striker-photo-2",
  );
  await expect(page.locator(".photo-dots button")).toHaveCount(2);
  await page.getByRole("button", { name: "Close product photos" }).click();
  await expect(
    gallery.getByRole("button", { name: "View product image 2" }),
  ).toBeFocused();
  const save = page.getByRole("button", { name: "Save product", exact: true });
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.locator(".quantity output")).toHaveText("2");
  await page.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(page.locator(".quantity output")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "Decrease quantity" }),
  ).toBeDisabled();
});

test("Match Striker description and observed policies preserve cancellation and product returns", async ({
  page,
}) => {
  await page.goto("/products/live-cozy-match-striker");
  const more = page.getByRole("button", { name: "Read more", exact: true });
  await more.click();
  const description = page.getByRole("dialog", {
    name: "Description",
    exact: true,
  });
  await expect(description.locator("li")).toHaveText([
    '2" x 2" x 2"',
    "Carbon steel with electroplated black zinc",
    "Works with strike anywhere matches - not included",
    "Imported",
  ]);
  await expect(
    description.getByRole("link", {
      name: "Hudson Grace Signature Scented Candle",
    }),
  ).toHaveAttribute(
    "href",
    "https://hudsongracesf.com/collections/scented-candles",
  );
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  for (const [label, kind, heading] of [
    ["Return policy", "refund", "Refund policy"],
    ["Shipping policy", "shipping", "Shipping policy"],
  ]) {
    const opener = page.getByRole("link", { name: label, exact: true });
    await opener.click();
    // Cold development compilation can outlast a locator assertion. Wait for
    // route commitment before inspecting the destination; a missed navigation still fails.
    await page.waitForURL(new RegExp(`/policies/${kind}$`));
    await expect(page).toHaveURL(new RegExp(`/policies/${kind}$`));
    await expect(
      page.getByRole("heading", { name: heading, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".native-merchant-policy article")).toContainText(
      kind === "refund"
        ? "Proof of purchase is required for a refund."
        : "We ship to the United States only.",
    );
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(page).toHaveURL(/\/products\/live-cozy-match-striker$/);
    await expect(opener).toBeFocused();
  }
  await expect(
    page.getByRole("link", { name: "Visit Hudson Grace" }),
  ).toHaveAttribute("href", "https://hudsongracesf.com");
});

for (const [width, height] of [
  [320, 568],
  [393, 793],
  [430, 568],
]) {
  test(`native Mini actions remain usable with reduced motion at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [route, label] of [
      ["look", "Choose Photo"],
      ["makeup", "Get started"],
      ["makeup?makeup=upload", "Upload image"],
    ]) {
      await page.goto(`/minis/${route}`);
      await ready(page);
      const action = page.getByRole("button", { name: label, exact: true });
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await expect(page.locator("video")).toHaveCount(0);
    }
    await page.screenshot({
      path: test.info().outputPath(`native-mini-${width}-${height}.png`),
    });
  });
}

test("retina clean PDP photographs decode from their own sources, not editorial crops", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 427, height: 876 },
    deviceScaleFactor: 3,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const page = await context.newPage();
    for (const id of ["wake-light", "match-striker"]) {
      await page.goto(`${base()}/products/live-cozy-${id}`);
      await ready(page);
      const image = page.locator(".product-gallery img").first();
      // naturalWidth is density-corrected for a 3x srcset candidate. Decode the
      // response itself to verify physical source pixels, not CSS dimensions.
      const sourceWidth = await image.evaluate(async (e) => {
        const response = await fetch((e as HTMLImageElement).currentSrc);
        const bitmap = await createImageBitmap(await response.blob());
        const width = bitmap.width;
        bitmap.close();
        return width;
      });
      expect(sourceWidth).toBeGreaterThanOrEqual(1000);
      expect(
        await image.evaluate((e) => (e as HTMLImageElement).currentSrc),
      ).toContain(`live-cozy-${id}-pdp-3x`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(427);
      await page.screenshot({
        path: test.info().outputPath(`${id}-clean-retina.png`),
      });
    }
  } finally {
    await context.close();
  }
});

test("missing Makeup artwork never claims successful playback or blocks entry", async ({
  page,
}) => {
  await page.route("**/api/reference-media/live-makeup-welcome-art", (route) =>
    route.abort(),
  );
  await page.goto("/minis/makeup");
  await expect(page.locator(".makeup-welcome-art")).toHaveAttribute(
    "data-media-state",
    "source-still",
  );
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await expect(page).toHaveURL(/makeup=upload/);
  await expect(
    page.getByRole("button", { name: "Upload image", exact: true }),
  ).toBeEnabled();
});
