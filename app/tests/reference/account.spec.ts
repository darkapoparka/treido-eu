import { test, expect } from "@playwright/test";

test("birthday editing validates calendar dates and permits clearing", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "MM/DD/YYYY", exact: true }).click();
  await page.getByRole("textbox", { name: "Month", exact: true }).fill("02");
  await page.getByRole("textbox", { name: "Day", exact: true }).fill("31");
  await page.getByRole("textbox", { name: "Year", exact: true }).fill("2000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Enter a valid birthday that is not in the future.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Day", exact: true }).fill("29");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Year", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "02/29/2000" }).click();
  for (const name of ["Month", "Day", "Year"]) {
    await page.getByRole("textbox", { name, exact: true }).fill("");
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "MM/DD/YYYY", exact: true }),
  ).toBeVisible();
});

test("address drafts survive browser Back and Forward without becoming saved addresses", async ({
  page,
}) => {
  await page.goto("/account/addresses");
  await page.getByRole("button", { name: "Add address", exact: true }).click();
  await page
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Reference draft");
  await page.goBack();
  await expect(page).toHaveURL(/\/account\/addresses$/);
  await expect(
    page.getByRole("heading", { name: "Manage addresses", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Reference draft", { exact: true })).toHaveCount(
    0,
  );
  await page.goForward();
  await expect(
    page.getByRole("textbox", { name: "First name", exact: true }),
  ).toHaveValue("Reference draft");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/addresses$/);
});

test("card preferences and deletion retain the selected card identity", async ({
  page,
}) => {
  await page.goto("/account/payments");
  // Create the second local display fixture through the form, using public test data.
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Card number" })
    .fill("4242424242424242");
  await page
    .getByRole("textbox", { name: "Expiry", exact: true })
    .fill("12/30");
  await page.getByRole("textbox", { name: "CVC", exact: true }).fill("123");
  await page.getByPlaceholder("Name on card").fill("Test User");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Payment methods", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /VISA.*4242/ }).click();
  const receipts = page.getByRole("switch", { name: /In-store receipts/ });
  await receipts.uncheck();
  await page.goBack();
  await page.getByRole("button", { name: /VISA.*4263/ }).click();
  await expect(receipts).toBeChecked();
  await page.goBack();
  await page.getByRole("button", { name: /VISA.*4242/ }).click();
  await expect(receipts).not.toBeChecked();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Are you sure you want to delete this card?",
    exact: true,
  });
  await confirmation
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/payments$/);
  await expect(
    page.getByRole("heading", { name: "Payment methods", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /VISA.*4242/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /VISA.*4263/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});
