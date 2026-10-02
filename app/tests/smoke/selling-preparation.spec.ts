import { expect, test, type Page } from "@playwright/test";

async function selectCategory(page: Page, query: string, name: string) {
  await page.goto("/sell?lang=en");
  await page.getByRole("searchbox", { name: "Search categories" }).fill(query);
  await page
    .getByRole("button")
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
  await expect(page.locator('[aria-current="step"]')).toHaveText("2Details");
}

test("keyboard navigation selects only leaves and searches Bulgarian labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 793 });
  await page.goto("/sell?lang=en");
  const root = page
    .getByRole("button")
    .filter({ has: page.getByText("Electronics", { exact: true }) });
  await root.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Electronics", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "All categories", exact: false })
    .click();
  await expect(root).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('[aria-current="step"]')).toHaveText("1Category");
  await expect(page.locator("#selling-condition")).toHaveCount(0);
  await page.getByRole("button", { name: "BG", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Търси категория" });
  await search.fill("няма такава категория 987654");
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Няма намерени категории",
  );
  await search.fill("телефони");
  const phone = page
    .getByRole("button")
    .filter({ has: page.getByText("Телефони", { exact: true }) });
  await phone.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("h1")).toBeFocused();
  await expect(page.getByLabel("Марка · задължително")).toBeVisible();
});

test("phone preparation validates, preserves Back edits and restores only a device buffer", async ({
  page,
}) => {
  await selectCategory(page, "phones", "Phones");
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await expect(page.locator("#selling-condition")).toBeFocused();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "highlighted fields",
  );
  await page.getByLabel("Item condition · required").selectOption("good");
  await page.getByLabel("Brand · required").fill("Example");
  await page.getByLabel("Model · required").fill("One");
  await page.getByLabel("Storage (GB) · required").fill("128");
  await page.getByLabel("Working status · required").selectOption("working");
  await expect(page.getByLabel("RAM (GB) · optional")).toBeHidden();
  await page.getByText("More details", { exact: true }).click();
  await page.getByLabel("RAM (GB) · optional").fill("1.5");
  await page.getByText("More details", { exact: true }).click();
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await expect(page.locator("#selling-ramGB")).toBeFocused();
  await expect(page.locator("details")).toHaveAttribute("open", "");
  await page.getByLabel("RAM (GB) · optional").fill("8");
  await page.getByLabel("Carrier locked · optional").selectOption("yes");
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await expect(page.locator("#selling-carrier")).toBeFocused();
  await page.getByLabel("Carrier · required").fill("Example carrier");
  await expect(page.locator("#selling-carrier")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search categories" }),
  ).toHaveValue("phones");
  await page
    .getByRole("button", { name: "Phones Electronics", exact: true })
    .click();
  await expect(page.getByLabel("Storage (GB) · required")).toHaveValue("128");
  await expect(page.getByLabel("RAM (GB) · optional")).toHaveValue("8");
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("dl")).toContainText("128 GB");
  await page
    .getByRole("button", { name: "Save on this device", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved on this device");
  await page.reload();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator("dl")).toContainText("Example carrier");
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Delete saved preparation", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Restore", exact: true }),
  ).toHaveCount(0);
});

test("furniture supports dimensions and Bulgarian decimal input with bilingual controls", async ({
  page,
}) => {
  await selectCategory(page, "tables", "Tables and chairs");
  await page.getByLabel("Item condition · required").selectOption("good");
  await page.getByLabel("Width", { exact: true }).fill("120");
  await page.getByLabel("Height", { exact: true }).fill("75");
  await page.getByLabel("Depth", { exact: true }).fill("60");
  await page.getByText("More details", { exact: true }).click();
  await page.getByLabel("Weight · optional").fill("12,34");
  await page.getByRole("button", { name: "BG", exact: true }).click();
  await expect(page.getByLabel("Ширина", { exact: true })).toHaveValue("120");
  await page
    .getByRole("button", { name: "Прегледай характеристиките", exact: true })
    .click();
  await expect(page.locator("dl")).toContainText("120 × 75 × 60 cm");
  await expect(page.locator("dl")).toContainText("12.34 kg");
});

test("accessory selections are mapped and sealed cosmetics reject an explicit no", async ({
  page,
}) => {
  await selectCategory(page, "headphones", "Headphones");
  await page.getByLabel("Item condition · required").selectOption("like_new");
  await page.getByLabel("Brand · required").fill("Example");
  await page.getByLabel("Model · required").fill("Two");
  await page.getByLabel("Working status · required").selectOption("working");
  await page.getByText("More details", { exact: true }).click();
  await page.getByLabel("Charger", { exact: true }).check();
  await page.getByLabel("Case", { exact: true }).check();
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await expect(page.locator("dl")).toContainText("Charger, Case");
  await selectCategory(page, "skincare", "Sealed skincare");
  await expect(page.locator("#selling-condition option")).toHaveCount(2);
  await page.getByLabel("Item condition · required").selectOption("new");
  await page.getByLabel("Brand · required").fill("Example");
  await page.getByLabel("Product type · required").fill("Cream");
  await page.getByLabel("Factory sealed · required").selectOption("no");
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await expect(page.locator("#selling-sealed")).toBeFocused();
  await page.getByLabel("Factory sealed · required").selectOption("yes");
  await page.getByText("More details", { exact: true }).click();
  await page.getByLabel("Expiry date · optional").fill("2027-01-15");
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await expect(page.locator("dl")).toContainText("2027-01-15");
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();
});

test("stale device buffers and storage failures never report a successful save", async ({
  page,
}) => {
  await page.goto("/sell?lang=en");
  await page.evaluate(() =>
    localStorage.setItem("treido-category-preparation-v1", '{"version":0}'),
  );
  await page.reload();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "older category version",
  );
  await page
    .getByRole("button", { name: "Delete saved preparation", exact: true })
    .click();
  await selectCategory(page, "phones", "Phones");
  await page.getByLabel("Item condition · required").selectOption("good");
  await page.getByLabel("Brand · required").fill("Example");
  await page.getByLabel("Model · required").fill("One");
  await page.getByLabel("Storage (GB) · required").fill("128");
  await page.getByLabel("Working status · required").selectOption("working");
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await page
    .getByRole("button", { name: "Save on this device", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("did not allow saving");
  await expect(page.locator("dl")).toContainText("128 GB");
});
