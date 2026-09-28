import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const input = (page: Page) =>
  page.getByRole("textbox", { name: "Search products", exact: true });

async function openSearch(page: Page) {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await expect(input(page)).toBeVisible();
}

async function chooseExample(page: Page) {
  await button(page, "Add photos").click();
  await expect(page.getByRole("dialog", { name: "Add photos" })).toBeVisible();
  await button(page, "Use captured cap example").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("img", { name: "Selected photo" })).toBeVisible();
  await expect(input(page)).toBeFocused();
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

test("a repeated Jeans search plays every captured phase and then reveals its answer", async ({
  page,
}) => {
  await openSearch(page);
  await page.clock.install();
  await input(page).fill("Jeans");
  await button(page, "Submit search").click();
  await expect(page).toHaveURL(/\/search\?q=Jeans$/);
  const progress = page.locator("[data-search-progress]");
  await expect(progress).toBeVisible();
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 60_000)),
  );
  // Submit the same query again: the old boolean effect could stick forever
  // because neither its query nor route dependency changed.
  await input(page).fill("Jeans");
  await input(page).press("Enter");
  await page.clock.runFor(1);
  await expect(progress).toHaveText("Thinking");
  await expect(button(page, "View answer for Jeans")).toHaveCount(0);
  for (const [elapsed, label] of [
    [2600, "Researching categories"],
    [2000, "Browsing results"],
    [2000, "Comparing products"],
    [2000, "Thinking"],
  ] as const) {
    await page.clock.fastForward(elapsed);
    await expect(progress).toHaveText(label);
    await expect(button(page, "View answer for Jeans")).toHaveCount(0);
  }
  await page.clock.fastForward(1400);
  await expect(button(page, "View answer for Jeans")).toBeVisible();
  await expect(progress).toHaveCount(0);
});

test("captured progress resumes elapsed time on reload and a different query cancels it", async ({
  page,
}) => {
  await openSearch(page);
  await page.clock.install();
  await page.goto("/search?q=Jeans");
  await expect(button(page, "View answer for Jeans")).toBeVisible();
  await expect(page.locator("[data-search-progress]")).toHaveCount(0);
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 60_000)),
  );
  await input(page).fill("Jeans");
  await input(page).press("Enter");
  await page.clock.runFor(1);
  await expect(page.locator("[data-search-progress]")).toHaveText("Thinking");
  await page.clock.fastForward(2700);
  await expect(page.locator("[data-search-progress]")).toHaveText(
    "Researching categories",
  );
  await page.reload();
  await page.clock.runFor(1);
  await expect(page.locator("[data-search-progress]")).toHaveText(
    "Researching categories",
  );
  await input(page).fill("Soap");
  await input(page).press("Enter");
  await page.clock.runFor(1);
  await expect(page).toHaveURL(/q=Soap/);
  await expect(page.locator("[data-search-progress]")).toHaveCount(0);
  await expect(button(page, "View answer for Jeans")).toHaveCount(0);
  // Return before the original deadline: cancellation, not expiry, must settle it.
  await page.goBack();
  await page.clock.runFor(1);
  await expect(page).toHaveURL(/q=Jeans/);
  await expect(button(page, "View answer for Jeans")).toBeVisible();
  await expect(page.locator("[data-search-progress]")).toHaveCount(0);
});

test("photo drafting keeps one input and removing the photograph preserves its query", async ({
  page,
}) => {
  await openSearch(page);
  await input(page).evaluate((element) => {
    element.dataset.identityProbe = "original-search-input";
  });
  await expect(button(page, "Submit search")).toBeDisabled();
  await chooseExample(page);
  await expect(input(page)).toHaveValue("");
  await expect(button(page, "Cancel photo search")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  await expect(button(page, "Submit search")).toBeEnabled();
  await input(page).fill("Find me a baseball cap like this");
  await expect(page.locator(".search-suggestions-surface")).toHaveCount(0);
  await expect(input(page)).toHaveAttribute(
    "data-identity-probe",
    "original-search-input",
  );
  await expect(button(page, "Cancel photo search")).toBeVisible();
  await inspect(page, "search-photo-composer");
  await button(page, "Remove selected photo").click();
  await expect(page.getByRole("img", { name: "Selected photo" })).toHaveCount(
    0,
  );
  await expect(input(page)).toHaveValue("Find me a baseball cap like this");
  await expect(input(page)).toBeFocused();
  await expect(page.locator(".search-suggestions-surface")).toBeVisible();
  await expect(input(page)).toHaveAttribute(
    "data-identity-probe",
    "original-search-input",
  );
  await input(page).press("Escape");
  await expect(input(page)).toHaveValue("");
  await expect(button(page, "Submit search")).toBeDisabled();
  const length = await page.evaluate(() => history.length);
  await input(page).fill("   ");
  await input(page).press("Enter");
  await expect(page).toHaveURL(/\/search$/);
  expect(await page.evaluate(() => history.length)).toBe(length);
});

test("an uploaded image remains distinct from the captured example and is never sent for analysis", async ({
  page,
}) => {
  await openSearch(page);
  await button(page, "Add photos").click();
  const photos = page.getByRole("dialog", { name: "Add photos", exact: true });
  const chooser = photos.getByLabel("Choose from library", { exact: true });
  await chooser.setInputFiles({
    name: "not-an-image.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Not a photograph"),
  });
  await expect(photos.getByRole("alert")).toHaveText("Choose an image file.");
  const artwork = await page.request.get("/api/reference-media/assistant-cap");
  expect(artwork.ok()).toBe(true);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()))
      writes.push(`${request.method()} ${request.url()}`);
  });
  await chooser.setInputFiles({
    name: "my-photo.webp",
    mimeType: "image/webp",
    buffer: await artwork.body(),
  });
  const selected = page.getByRole("img", { name: "Selected photo" });
  await expect(selected).toHaveAttribute("src", /^blob:/);
  await expect(input(page)).toBeFocused();
  await input(page).fill("Find a cap like my photo");
  await button(page, "Submit search").click();
  const unavailable = page.getByRole("dialog", {
    name: "Photo search unavailable",
    exact: true,
  });
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toContainText("has not been analyzed");
  await expect(page).toHaveURL(/\/search$/);
  await button(page, "Remove photo").click();
  await expect(unavailable).not.toBeVisible();
  await expect(selected).toHaveCount(0);
  await expect(input(page)).toHaveValue("Find a cap like my photo");
  await expect(input(page)).toBeFocused();
  expect(writes).toEqual([]);
});

test("recent history includes real stores and products and removal does not unsave a product", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/shea-butter");
  await button(page, "Save product").click();
  await button(page, "Saved").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator('.store-row a[href="/stores/kitsch"]').click();
  await expect(page).toHaveURL(/\/stores\/kitsch$/);
  await expect(page.getByRole("heading", { name: "For you" })).toBeVisible();
  await page.getByRole("link", { name: "Search", exact: true }).click();
  const store = page.locator(
    '[data-recent-kind="store"][data-recent-id="kitsch"]',
  );
  const product = page.locator(
    '[data-recent-kind="product"][data-recent-id="shea-butter"]',
  );
  await expect(store).toBeVisible();
  await expect(product).toBeVisible();
  await inspect(page, "search-mixed-recent-rail");
  await page
    .getByRole("link", { name: "Recently viewed", exact: true })
    .click();
  await expect(page).toHaveURL(/view=recent/);
  await expect(store).toBeVisible();
  await expect(product).toBeVisible();
  await inspect(page, "search-mixed-recent-grid");
  await button(page, "Remove KITSCH from recently viewed").click();
  await expect(store).toHaveCount(0);
  await button(
    page,
    "Remove Shea Butter Exfoliating Body Wash from recently viewed",
  ).click();
  await expect(product).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText(/No recently viewed items/);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(
    page.locator('.saved-grid [data-product-id="shea-butter"]'),
  ).toBeVisible();
});

test("the photo composer contains its editable query and controls at all three reference widths", async ({
  page,
}) => {
  await openSearch(page);
  await chooseExample(page);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await input(page).fill("Find me a baseball cap like this");
    await expect(input(page)).toBeFocused();
    await expect(button(page, "Submit search")).toBeVisible();
    const geometry = await page.locator(".search-form").evaluate((form) => {
      const bounds = form.getBoundingClientRect();
      return {
        contained:
          bounds.left >= 0 &&
          bounds.right <= innerWidth &&
          bounds.bottom <= innerHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
        input: form.querySelector("input")!.getBoundingClientRect().bottom,
        submit: form
          .querySelector('button[type="submit"]')!
          .getBoundingClientRect().top,
      };
    });
    expect(geometry.contained).toBe(true);
    expect(geometry.overflow).toBe(false);
    expect(geometry.input).toBeLessThanOrEqual(geometry.submit);
  }
  await button(page, "Cancel photo search").click();
  await expect(page.getByRole("img", { name: "Selected photo" })).toHaveCount(
    0,
  );
  await expect(input(page)).toHaveValue("");
  await expect(
    page.getByRole("link", { name: "Home", exact: true }),
  ).toBeVisible();
});
