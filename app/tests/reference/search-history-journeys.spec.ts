import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("a new search has no conversation until the Jeans answer is opened", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-entry");
  await page.goto("/search");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await expect(
    page.getByRole("heading", { name: "Keep shopping" }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search products", exact: true })
    .fill("Jeans");
  await page
    .getByRole("button", { name: "Submit search", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View answer for Jeans", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Jeans answer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Search", exact: true })
    .click();
  const conversation = page.getByRole("link", {
    name: "Continue Finding the right pair of jeans",
    exact: true,
  });
  await expect(conversation).toBeVisible();
  await expect(conversation).toContainText("Just now");
  await conversation.click();
  await expect(page).toHaveURL(/\/assistant$/);
  await expect(
    page.getByRole("heading", { name: "Jeans", exact: true }),
  ).toBeVisible();
});

test("expanded recent history has the identified eighth brand and removal survives return", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-recent");
  await page.goto("/search?view=recent");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await expect(page.locator("[data-recent-id]")).toHaveCount(8);
  const dockFade = await page.locator(".floating-dock").evaluate((dock) => {
    const style = getComputedStyle(dock, "::before");
    return {
      content: style.content,
      height: style.height,
      background: style.backgroundImage,
    };
  });
  expect(dockFade.content).not.toBe("none");
  expect(dockFade.height).toBe("118px");
  expect(dockFade.background).toContain("linear-gradient");
  const tea = page.locator('[data-recent-id="loaded-tea"]');
  await expect(
    tea.getByRole("link", { name: "Visit The Loaded Tea Shop", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-recent-id="kitsch"] .price-badge'),
  ).toHaveCount(0);
  await tea
    .getByRole("button", {
      name: "Remove The Loaded Tea Shop from recently viewed",
      exact: true,
    })
    .click();
  await expect(tea).toHaveCount(0);
  await expect(
    page
      .locator("[data-recent-id]")
      .last()
      .getByRole("button", { name: /^Remove / }),
  ).toBeFocused();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Search", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Recently viewed", exact: true })
    .click();
  await expect(page.locator("[data-recent-id]")).toHaveCount(7);
  await expect(page.locator('[data-recent-id="loaded-tea"]')).toHaveCount(0);
  while (await page.locator("[data-recent-id]").count()) {
    await page
      .locator("[data-recent-id]")
      .first()
      .getByRole("button", { name: /^Remove / })
      .click();
    const remaining = page.locator("[data-recent-id]");
    if (await remaining.count())
      await expect(
        remaining.first().getByRole("button", { name: /^Remove / }),
      ).toBeFocused();
  }
  await expect(
    page.getByRole("link", { name: "Browse products", exact: true }),
  ).toBeFocused();
});

test("expanded recent history uses the captured heading gap without overflowing narrow phones", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-recent");
  await page.goto("/search?view=recent");
  const grid = page.locator(".recent-history-grid");
  await expect(grid.locator("[data-recent-id]")).toHaveCount(8);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const geometry = await grid.evaluate((element) => ({
      top: element.getBoundingClientRect().top,
      headingBottom:
        element.previousElementSibling!.getBoundingClientRect().bottom,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(geometry.overflow).toBe(false);
    expect(geometry.top - geometry.headingBottom).toBeCloseTo(14, 0);
    expect(geometry.top).toBeCloseTo(60, 0);
  }
});
