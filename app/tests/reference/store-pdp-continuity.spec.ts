import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("postal editor discards cancellation and commits Done without losing its return control", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/shampoo-bag");
  const ship = page.locator(".pdp-delivery > button");
  await ship.click();
  await page
    .getByRole("textbox", { name: "Postal code", exact: true })
    .fill("10001");
  await page.keyboard.press("Escape");
  await expect(ship).toContainText("94025");
  await expect(ship).toBeFocused();
  await ship.click();
  const postal = page.getByRole("textbox", {
    name: "Postal code",
    exact: true,
  });
  await expect(postal).toHaveValue("94025");
  await postal.fill("10001");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(ship).toContainText("10001");
  await expect(ship).toBeFocused();
});

test("product and store review Close restore their actual source scroll and Forward entry", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/shea-butter");
  const source = page.getByRole("link", {
    name: "Read all reviews",
    exact: true,
  });
  await source.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await source.click();
  await expect(page).toHaveURL(/\/products\/shea-butter\/reviews$/);
  await page.getByRole("link", { name: "Close reviews", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/shea-butter$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  await expect(source).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/products\/shea-butter\/reviews$/);
  await page.getByRole("link", { name: "Close reviews", exact: true }).click();
  await expect(source).toBeFocused();

  await page.goto("/stores/kitsch");
  const information = page
    .getByRole("link", { name: "Store information", exact: true })
    .first();
  await information.click();
  await expect(page).toHaveURL(/\/stores\/kitsch\/info$/);
  const reviews = page.locator(".store-info-reviews > .detail-row");
  await reviews.scrollIntoViewIfNeeded();
  const storeY = await page.evaluate(() => scrollY);
  await reviews.click();
  await expect(page).toHaveURL(/\/stores\/kitsch\/reviews$/);
  await page.getByRole("link", { name: "Close reviews", exact: true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(storeY);
  await expect(reviews).toBeFocused();
  await page
    .getByRole("link", { name: "Close store information", exact: true })
    .click();
  await expect(page).toHaveURL(/\/stores\/kitsch$/);
  await expect(information).toBeFocused();
});

test("review report Back and Forward retain the draft and restore the menu trigger", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/shea-butter/reviews");
  await page
    .getByRole("button", { name: "About ratings", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "About ratings", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "About ratings", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "More options for Wes's review", exact: true })
    .click();
  const entry = page.getByRole("button", {
    name: "Report this review",
    exact: true,
  });
  await entry.click();
  await page.getByRole("radio", { name: "It’s spam", exact: true }).check();
  await page.goBack();
  await expect(entry).toBeFocused();
  await page.goForward();
  await expect(
    page.getByRole("radio", { name: "It’s spam", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("dialog", { name: "More options", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("radio", { name: "It’s spam", exact: true }),
  ).toBeChecked();
});

test("product report notes survive browser and visible Back without submitting", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/shea-butter");
  await page.getByRole("button", { name: "More options", exact: true }).click();
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await page.getByRole("radio", { name: "Other", exact: true }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Tell us more", exact: true })
    .fill("Draft report");
  await page.goBack();
  await expect(
    page.getByRole("radio", { name: "Other", exact: true }),
  ).toBeChecked();
  await page.goForward();
  await expect(
    page.getByRole("textbox", { name: "Tell us more", exact: true }),
  ).toHaveValue("Draft report");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "More options", exact: true }),
  ).toBeFocused();
  await expect(page).toHaveURL(/\/products\/shea-butter$/);
});
