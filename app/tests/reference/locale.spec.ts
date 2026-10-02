import { expect, test, type Page } from "@playwright/test";

const trigger = (page: Page) => page.locator("[data-browse-scope-trigger]");
async function ready(page: Page) {
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
}

test("browser language renders on the server and keeps the short All label", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9,bg;q=0.5",
  });
  const response = await page.goto("/");
  expect((await response!.text()).match(/<html lang="([^"]+)"/)?.[1]).toBe(
    "en",
  );
  await ready(page);
  await expect(trigger(page)).toHaveText("All");
  await expect(trigger(page)).toHaveAccessibleName(
    "Listings from: All sellers",
  );
  await trigger(page).click();
  await expect(page.getByRole("dialog", { name: "Seller type" })).toBeVisible();
  await expect(page.locator('[data-browse-scope="all"]')).toHaveText(
    "All sellers",
  );
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
});

test.describe("Bulgarian browser defaults", () => {
  test.use({ locale: "bg-BG" });
  test("Bulgarian browser preference translates the browse chrome and search composer", async ({
    page,
    request,
  }, testInfo) => {
    const weighted = await request.get("/", {
      headers: { "Accept-Language": "de-DE,bg-BG;q=0.9,en;q=0.8" },
    });
    expect((await weighted.text()).match(/<html lang="([^"]+)"/)?.[1]).toBe(
      "bg",
    );
    const response = await page.goto("/");
    expect((await response!.text()).match(/<html lang="([^"]+)"/)?.[1]).toBe(
      "bg",
    );
    await ready(page);
    await expect(trigger(page)).toHaveText("Всички");
    await expect(page.locator('.home-shortcuts a[href="/deals"]')).toHaveText(
      "Оферти",
    );
    await testInfo.attach("home-bg-393", {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
    await page.getByRole("link", { name: "Търсене", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
    await expect(page.getByPlaceholder("Търси или задай въпрос")).toBeVisible();
    await expect(trigger(page)).toHaveText("Всички");
  });
});

test("URL language overrides a saved preference through scope switching and Back", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "treido-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.goto("/search?q=phone&lang=bg&location=София&condition=good");
  await ready(page);
  await expect(trigger(page)).toHaveText("Всички");
  await trigger(page).click();
  await page.locator('[data-browse-scope="business"]').click();
  await expect(trigger(page)).toHaveText("Бизнеси");
  const url = new URL(page.url());
  expect(url.searchParams.get("lang")).toBe("bg");
  expect(url.searchParams.get("location")).toBe("София");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  await page.goBack();
  await expect(trigger(page)).toHaveText("Всички");
  await expect(page.locator("html")).toHaveAttribute("lang", "bg");
});

test("profile exposes persistent language preferences for a guest", async ({
  page,
}) => {
  await page.goto("/?lang=en");
  await ready(page);
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page.getByRole("link", { name: "Language & location English" }).click();
  await expect(
    page.getByRole("heading", { name: "Language & location" }),
  ).toBeVisible();
  await page.getByLabel("Language", { exact: true }).selectOption("bg");
  await page.getByRole("button", { name: "Запази настройките" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  await expect(
    page.getByRole("link", { name: "Език и местоположение Български" }),
  ).toBeVisible();
  await page.goto("/");
  await ready(page);
  await expect(trigger(page)).toHaveText("Всички");
  await page.reload();
  await expect(trigger(page)).toHaveText("Всички");
});

test("language preferences preserve scope and location without accepting local geo headers", async ({
  page,
  context,
}) => {
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US",
    "x-vercel-ip-country": "BG",
    "x-vercel-ip-city": "Sofia",
  });
  const destination =
    "/search?q=phone&lang=en&seller=business&location=София&condition=good&page=3";
  await page.goto(
    `/account/language?lang=en&returnTo=${encodeURIComponent(destination)}`,
  );
  await ready(page);
  await expect(page.getByLabel("Browsing location")).toHaveValue("София");
  await expect(page.locator("[data-location-unavailable]")).toBeVisible();
  await expect(page.locator("[data-location-suggestion]")).toHaveCount(0);
  await page.getByLabel("Language", { exact: true }).selectOption("bg");
  await page.getByRole("button", { name: "Запази настройките" }).click();
  await expect(trigger(page)).toHaveText("Бизнеси");
  const url = new URL(page.url());
  for (const [key, value] of Object.entries({
    q: "phone",
    lang: "bg",
    seller: "business",
    location: "София",
    condition: "good",
  }))
    expect(url.searchParams.get(key)).toBe(value);
  expect(url.searchParams.has("page")).toBe(false);
  expect(
    (await context.cookies()).find((cookie) => cookie.name === "treido-locale")
      ?.value,
  ).toBe("bg");
});

test("malformed preference returns stay local without a page error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const value of ["http://[", "//outside.invalid"]) {
    await page.goto(
      `/account/language?lang=en&returnTo=${encodeURIComponent(value)}`,
    );
    await ready(page);
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page).toHaveURL(/\/profile\?lang=en$/);
    expect(new URL(page.url()).hostname).toBe("127.0.0.1");
  }
  expect(errors).toEqual([]);
});

test.describe("unsupported browser defaults", () => {
  test.use({ locale: "fr-FR" });
  test("unsupported language falls back safely, with no hydration errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setExtraHTTPHeaders({ "Accept-Language": "fr-FR" });
    await page.goto("/?lang=de");
    await ready(page);
    await expect(trigger(page)).toHaveText("Всички");
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
    await page.goto("/?lang=en");
    await expect(trigger(page)).toHaveText("All");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(errors).toEqual([]);
  });
});

for (const width of [320, 393, 1440]) {
  test(`language preferences fit Bulgarian at 200 percent and ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 480 : 793 });
    await page.goto("/account/language?lang=bg");
    await ready(page);
    await page.addStyleTag({
      content:
        ".account-heading h1 { font-size: 56px !important; line-height: 1.15 !important; } .account-panel label, .account-panel input, .account-panel select, .account-panel strong, .account-panel .pill, .primary, .account-page > form > a { font-size: 32px !important; } .account-panel .form-note { font-size: 28px !important; }",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("Език", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Място за търсене")).toBeFocused();
    await page.getByLabel("Място за търсене").fill("Пловдив");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Запази настройките" }),
    ).toBeFocused();
    await testInfo.attach(`preferences-bg-large-${width}`, {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/location=/);
    expect(new URL(page.url()).searchParams.get("location")).toBe("Пловдив");
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  });
}
