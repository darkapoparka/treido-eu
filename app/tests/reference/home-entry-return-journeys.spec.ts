import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function position(page: Page, control: Locator, rail?: Locator) {
  await control.scrollIntoViewIfNeeded();
  return {
    y: await page.evaluate(() => scrollY),
    x: rail ? await rail.evaluate((element) => element.scrollLeft) : 0,
  };
}

async function returned(
  page: Page,
  control: Locator,
  before: { y: number; x: number },
  rail?: Locator,
) {
  await expect(control).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before.y);
  if (rail)
    await expect
      .poll(() => rail.evaluate((element) => element.scrollLeft))
      .toBe(before.x);
}

for (const width of [320, 393, 430]) {
  test(`Home entry controls at ${width}px preserve focus and shortcut scroll across repeated history`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 793 });
    await useReferenceScenario(page, "home-welcome");
    await page.goto("/");
    await ready(page);
    const rail = page.locator(".home-shortcuts");
    for (const entry of [
      { name: "Profile", route: "/profile", button: false },
      { name: "Notifications", route: "/notifications", button: true },
      { name: "Deals", route: "/deals", button: false },
      { name: "Following", route: "/following", button: false },
      { name: "Saved", route: "/saved", button: false },
      { name: "Minis", route: "/minis", button: false },
    ]) {
      const control = rail.getByRole(entry.button ? "button" : "link", {
        name: entry.name,
        exact: true,
      });
      const before = await position(page, control, rail);
      await control.click();
      await expect(page).toHaveURL(entry.route);
      await ready(page);
      if (entry.name === "Profile")
        await page
          .getByRole("button", { name: "Go back", exact: true })
          .click();
      else await page.goBack();
      await expect(page).toHaveURL("/");
      await returned(page, control, before, rail);
      await page.goForward();
      await expect(page).toHaveURL(entry.route);
      await ready(page);
      await page.goBack();
      await returned(page, control, before, rail);
    }
  });

  test(`Home tracking and recent entry controls at ${width}px return to the original feed`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 793 });
    await useReferenceScenario(page, "returning-home");
    await page.goto("/?feed=tracking");
    await ready(page);
    for (const selector of [".delivery-card", ".email-card"]) {
      const control = page.locator(selector);
      const before = await position(page, control);
      await control.click();
      await expect(page).toHaveURL(
        selector === ".delivery-card" ? "/orders" : "/account/connections",
      );
      await ready(page);
      await page.goBack();
      await expect(page).toHaveURL("/?feed=tracking");
      await returned(page, control, before);
    }
    await useReferenceScenario(page, "home-recent-shops");
    await page.goto("/?feed=recent-stores");
    await ready(page);
    const recent = page.locator(".recent-title");
    // The captured title starts behind the floating dock. Move it into the
    // reading area before recording the actual navigation position.
    await recent.evaluate((element) =>
      window.scrollTo(0, scrollY + element.getBoundingClientRect().top - 200),
    );
    const before = await position(page, recent);
    await recent.click();
    await expect(page).toHaveURL("/search?view=recent");
    await ready(page);
    await page.goBack();
    await expect(page).toHaveURL("/?feed=recent-stores");
    await returned(page, recent, before);
  });

  test(`Deals and Following entry controls at ${width}px restore their own focus and rail`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 793 });
    await useReferenceScenario(page, "following-empty");
    await page.goto("/deals");
    await ready(page);
    const rail = page.locator(".deals-filter-rail");
    for (const name of ["Search", "Women"]) {
      const control = rail.getByRole("link", { name, exact: true });
      const before = await position(page, control, rail);
      await control.click();
      await expect(page).toHaveURL(
        name === "Search" ? "/search" : "/search?q=Women",
      );
      await ready(page);
      await page.goBack();
      await returned(page, control, before, rail);
      await page.goForward();
      await ready(page);
      await page.goBack();
      await returned(page, control, before, rail);
    }
    await page.goto("/following");
    await ready(page);
    const shopping = page.getByRole("link", {
      name: "Go shopping",
      exact: true,
    });
    const before = await position(page, shopping);
    await shopping.click();
    await expect(page).toHaveURL("/explore");
    await ready(page);
    await page.goBack();
    await returned(page, shopping, before);
  });
}

test("Home Minis entry remains the outer origin after a staged Mini closes to its catalogue", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/");
  await ready(page);
  const rail = page.locator(".home-shortcuts");
  const minis = rail.getByRole("link", { name: "Minis", exact: true });
  const before = await position(page, minis, rail);
  await minis.click();
  await ready(page);
  const look = page.locator('.mini-feature[data-mini-id="look"]');
  await look.click();
  await page
    .getByRole("button", {
      name: "Dismiss Get the Look terms notice",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Get the Look preview controls", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use reference outfit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View captured matches", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Close Get the Look", exact: true })
    .click();
  await expect(page).toHaveURL("/minis");
  await expect(look).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL("/");
  await returned(page, minis, before, rail);
});
