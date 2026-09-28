import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("a locally retained phone appears immediately and reopens as one editable number", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/account");
  await page.getByRole("button", { name: "Add phone", exact: true }).click();
  const phone = page.getByRole("dialog", {
    name: "Add phone number",
    exact: true,
  });
  await phone
    .getByRole("combobox", { name: "Country calling code" })
    .selectOption("+359");
  await phone
    .getByPlaceholder("Phone number", { exact: true })
    .fill("888123456");
  await phone.getByRole("button", { name: "Continue", exact: true }).click();
  const code = page.getByRole("dialog", {
    name: "Confirm it’s you",
    exact: true,
  });
  await code.getByRole("button", { name: "Resend code", exact: true }).click();
  await code
    .getByRole("button", {
      name: "Use as unverified reference number",
      exact: true,
    })
    .click();
  await expect(code).not.toBeVisible();
  await page
    .getByRole("button", { name: "+359 888123456", exact: true })
    .click();
  await expect(phone).toBeVisible();
  await expect(
    phone.getByRole("combobox", { name: "Country calling code" }),
  ).toHaveValue("+359");
  await expect(
    phone.getByPlaceholder("Phone number", { exact: true }),
  ).toHaveValue("888123456");
  await phone
    .getByRole("button", { name: "Close Add phone number", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "+359 888123456", exact: true }),
  ).toBeFocused();
});

test("a saved reference card retains its chosen nondefault billing address", async ({
  page,
}) => {
  await page.goto("/account/payments");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Card number", exact: true })
    .fill("4242424242424242");
  await page
    .getByRole("textbox", { name: "Expiry", exact: true })
    .fill("12/30");
  await page.getByRole("textbox", { name: "CVC", exact: true }).fill("123");
  await page.getByPlaceholder("Name on card").fill("Local billing example");
  await page
    .getByRole("button", { name: "+ Use a different address", exact: true })
    .click();
  const billing = page.getByRole("dialog", {
    name: "Billing address",
    exact: true,
  });
  for (const [name, value] of [
    ["First name", "Jamie"],
    ["Last name", "Example"],
    ["Address", "1 Example Street"],
    ["City", "Los Angeles"],
    ["ZIP code", "90001"],
  ])
    await billing.getByRole("textbox", { name, exact: true }).fill(value);
  await billing
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("CA");
  await billing.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await page.getByRole("button", { name: /VISA.*4242/ }).click();
  await expect(page.locator(".billing-details")).toContainText("Jamie Example");
  await expect(page.locator(".billing-details")).toContainText(
    "1 Example Street",
  );
  await page.goBack();
  await page.getByRole("button", { name: /VISA.*4263/ }).click();
  await expect(page.locator(".billing-details")).toContainText("Alex Smith");
});

test("public creation shares the validated collection editor and keeps saved-only photographs", async ({
  page,
}) => {
  const collectionName = "Browser local picks and gifts for everyone";
  await useReferenceScenario(page, "saved-library");
  await page.goto("/account/public");
  await page
    .getByRole("button", { name: "Create public collection", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Create collection",
    exact: true,
  });
  await editor
    .getByRole("textbox", { name: "Collection name", exact: true })
    .fill("   ");
  await expect(
    editor.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole("textbox", { name: "Collection name", exact: true })
    .fill(`  ${collectionName}  `);
  await expect(
    editor.getByRole("button", { name: "Public", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/saved\?collection=.+&view=add$/);
  await page
    .getByRole("button", { name: "Add Pink rhode tube", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: collectionName, exact: true }),
  ).toBeVisible();
  await page.goto("/account/public");
  const cover = page.getByRole("link", { name: collectionName, exact: true });
  await expect(
    cover.locator('img[src="/api/reference-media/saved-pink-partial"]'),
  ).toBeVisible();
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(cover).toHaveAccessibleName(collectionName);
    await expect(cover.locator("strong")).toHaveText(collectionName);
    const bounds = await cover.evaluate((card) => {
      const title = card.querySelector("strong")!;
      const rect = title.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        cardBottom: card.getBoundingClientRect().bottom,
        clipped: title.scrollWidth > title.clientWidth,
        whiteSpace: getComputedStyle(title).whiteSpace,
      };
    });
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.cardBottom);
    expect(bounds.clipped).toBe(true);
    expect(bounds.whiteSpace).toBe("nowrap");
  }
  await cover.click();
  await expect(
    page.getByRole("heading", { name: collectionName, exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(cover).toBeFocused();
});
