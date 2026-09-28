import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("address suggestions leave the next fields readable in a reduced viewport and retain the selected locality", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch");
  await page.getByRole("button", { name: /^Ship to/ }).click();
  await page.getByRole("button", { name: /Use a different address/ }).click();
  const editor = page.getByRole("dialog", { name: "Add address", exact: true });
  await editor
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Alex");
  await editor
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Smith");
  await page.setViewportSize({ width: 393, height: 487 });
  await editor
    .getByRole("textbox", { name: "Address", exact: true })
    .fill("1226 University Dr, Menlo");
  await editor.evaluate((element) => {
    element.scrollTop = 143;
  });
  await expect(
    editor.getByRole("textbox", { name: "City", exact: true }),
  ).toBeInViewport();
  await expect(
    editor.getByRole("button", { name: "Save address", exact: true }),
  ).not.toBeInViewport();
  await editor.locator(".source-address-result").click();
  await page.setViewportSize({ width: 393, height: 793 });
  await expect(
    editor.getByRole("textbox", { name: "City", exact: true }),
  ).toHaveValue("Menlo Park");
  await expect(
    editor.getByRole("combobox", { name: "State", exact: true }),
  ).toHaveValue("CA");
  await editor
    .getByRole("button", { name: "Save address", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await expect(
    page.locator(".checkout-addresses .shipping-option.selected"),
  ).toContainText("Alex Smith");
  await expect(
    page.locator(".checkout-addresses .shipping-option.selected"),
  ).toContainText("1226 University Dr");
});

test("pickup keeps source totals, offer choice and location state through the lookup boundary at narrow width", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.setViewportSize({ width: 320, height: 793 });
  await page.goto("/checkout?store=white-rock");
  await page.getByRole("tab", { name: "Pickup", exact: true }).click();
  await expect(page.locator(".pickup-total")).toContainText("$3.80");
  const offers = page.getByRole("checkbox", {
    name: "Sign me up for news and offers from this store",
    exact: true,
  });
  await offers.uncheck();
  const postcode = page
    .locator(".pickup-warning")
    .getByRole("button", { name: "94025", exact: true });
  await postcode.click();
  const lookup = page.getByRole("dialog", {
    name: "Location lookup unavailable",
    exact: true,
  });
  await expect(lookup).toBeVisible();
  await page.goBack();
  await expect(lookup).not.toBeVisible();
  await expect(postcode).toBeFocused();
  await expect(offers).not.toBeChecked();
  await expect(
    page.getByRole("radio", { name: "White Rock Soap Gallery", exact: true }),
  ).toBeChecked();
  await page.getByRole("tab", { name: "Ship", exact: true }).click();
  await expect(page.locator(".pickup-total")).toContainText("$10.83");
  await expect(offers).not.toBeChecked();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
