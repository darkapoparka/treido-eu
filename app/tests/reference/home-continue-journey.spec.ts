import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("Home's welcome prompt scrolls to the next campaign and dismisses", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/");
  await page.getByRole("button", { name: "Keep going", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Keep going", exact: true }),
  ).toHaveCount(0);
  const next = page.getByRole("region", {
    name: "DRMTLGY campaign",
    exact: true,
  });
  await expect
    .poll(async () => Math.round((await next.boundingBox())?.y ?? -1))
    .toBe(56);
  await next
    .getByRole("button", { name: "Save Retinol Body Lotion", exact: true })
    .click();
  await expect(
    next.getByRole("button", {
      name: "Unsave Retinol Body Lotion",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(
    page.getByRole("button", { name: "Keep going", exact: true }),
  ).toHaveCount(0);
});

test("Home's continuation prompt does not cover an existing tracking journey", async ({
  page,
}) => {
  await useReferenceScenario(page, "returning-home");
  await page.goto("/?feed=tracking");
  await expect(
    page.getByRole("link", { name: "Profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep going", exact: true }),
  ).toHaveCount(0);
});
