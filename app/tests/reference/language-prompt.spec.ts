import { expect, test, type Page } from "@playwright/test";
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ context, page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await context.clearCookies();
  await context.addCookies([
    {
      name: "shop-reference-scenario",
      value: "reference-default",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

test("language prompt opens a real sheet, preserves discovery filters and remembers the choice", async ({
  page,
}) => {
  await page.goto("/search?q=shampoo&location=Sofia&lang=bg");
  const prompt = page.locator("[data-language-prompt]");
  await expect(prompt).toBeVisible();
  const popup = await prompt.boundingBox();
  const dock = await page.locator(".floating-dock").boundingBox();
  expect(Math.abs(dock!.y - popup!.y - popup!.height - 12)).toBeLessThan(1);
  await prompt
    .getByRole("button", { name: "Избери език", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    prompt.getByRole("button", { name: "Избери език", exact: true }),
  ).toBeFocused();
  await prompt
    .getByRole("button", { name: "Избери език", exact: true })
    .click();
  await page.getByRole("radio", { name: "English", exact: true }).check();
  await page
    .getByRole("button", { name: "Приложи езика", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const url = new URL(page.url());
  expect(url.searchParams.get("q")).toBe("shampoo");
  expect(url.searchParams.get("location")).toBe("Sofia");
  await page.reload();
  await expect(prompt).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("dismissed suggestions stay dismissed; profile still opens the language picker", async ({
  page,
}) => {
  await page.goto("/profile?lang=bg");
  const prompt = page.locator("[data-language-prompt]");
  await expect(prompt).toBeVisible();
  await prompt
    .getByRole("button", { name: "Скрий предложението за език" })
    .click();
  await page.reload();
  await expect(prompt).toHaveCount(0);
  const button = page
    .locator(".profile-footer")
    .getByRole("button", { name: "Избери език" });
  await button.click();
  await expect(
    page.getByRole("dialog", { name: "Език", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
});

test("the prompt and picker fit phone and desktop widths", async ({ page }) => {
  for (const width of [320, 393, 1440]) {
    await page.setViewportSize({ width, height: 793 });
    await page.goto("/search?lang=bg");
    const prompt = page.locator("[data-language-prompt]");
    await expect(prompt).toBeVisible();
    const bounds = await prompt.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await prompt
      .getByRole("button", { name: "Избери език", exact: true })
      .click();
    const sheet = page.getByRole("dialog", { name: "Език", exact: true });
    await expect(sheet).toBeVisible();
    const dialog = await sheet.boundingBox();
    expect(dialog!.x).toBeGreaterThanOrEqual(0);
    expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press("Escape");
  }
});

test("language suggestion stays out of text entry and returns after leaving the field", async ({
  page,
}) => {
  await page.goto("/search?lang=bg");
  const prompt = page.locator("[data-language-prompt]");
  await expect(prompt).toBeVisible();
  const input = page.getByRole("textbox", {
    name: "Търси артикули",
    exact: true,
  });
  await input.focus();
  await expect(prompt).toHaveCount(0);
  await input.fill("телефон");
  await expect(input).toHaveValue("телефон");
  await input.blur();
  await expect(prompt).toHaveCount(0);
  await page
    .getByRole("button", { name: "Затвори предложенията", exact: true })
    .click();
  await expect(page.locator(".floating-dock")).toBeVisible();
  await expect(prompt).toBeVisible();
});

test("country preferences leave the language sheet without losing search context", async ({
  page,
}) => {
  await page.goto(
    "/search?q=phone&seller=business&condition=good&location=Sofia&lang=bg",
  );
  const prompt = page.locator("[data-language-prompt]");
  await expect(prompt).toBeVisible();
  await prompt
    .getByRole("button", { name: "Избери език", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Език", exact: true });
  await dialog
    .getByRole("link", { name: "Държава и местоположение", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/language/);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const destination = new URL(page.url());
  const back = new URL(
    destination.searchParams.get("returnTo")!,
    "https://treido.invalid",
  );
  expect(back.pathname).toBe("/search");
  expect(back.searchParams.get("q")).toBe("phone");
  expect(back.searchParams.get("seller")).toBe("business");
  expect(back.searchParams.get("location")).toBe("Sofia");
  await expect(page.locator("#browsing-location")).toHaveValue("Sofia");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?/);
  expect(new URL(page.url()).searchParams.get("seller")).toBe("business");
});
