import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

async function enterFromStore(page: import("@playwright/test").Page) {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/stores/kitsch");
  await page
    .locator('#all-products a[href="/products/shea-butter"]')
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Shea Butter Exfoliating Body Wash",
      exact: true,
    }),
  ).toBeVisible();
}

test("a first store-to-product visit shows a temporary save hint and a repeat visit retains the viewed history", async ({
  page,
}) => {
  await enterFromStore(page);
  const hint = page.getByRole("note");
  await expect(hint).toHaveText(/Get alerts for price drops\s*on saved items/);
  await expect(hint).not.toBeVisible({ timeout: 6500 });
  await page.goBack();
  await expect(page).toHaveURL(/stores\/kitsch$/);
  await page
    .locator('#all-products a[href="/products/shea-butter"]')
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Shea Butter Exfoliating Body Wash",
      exact: true,
    }),
  ).toBeVisible();
  await expect(hint).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save product", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("saving from the hint uses the existing picker and restores focus on dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 793 });
  await enterFromStore(page);
  await expect(page.getByRole("note")).toBeVisible();
  const save = page.getByRole("button", { name: "Save product", exact: true });
  await save.click();
  const picker = page.getByRole("dialog", {
    name: "Save to collection",
    exact: true,
  });
  await expect(picker).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
  await page.goBack();
  await expect(picker).not.toBeVisible();
  await expect(save).toBeFocused();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
