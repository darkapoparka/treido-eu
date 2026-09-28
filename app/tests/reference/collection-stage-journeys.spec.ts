import { expect, test, type Page } from "@playwright/test";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const dialog = (page: Page, name: string) =>
  page.getByRole("dialog", { name, exact: true });
async function openScenario(
  page: Page,
  baseURL: string | undefined,
  scenario: string,
  path: string,
) {
  if (!baseURL)
    throw new Error("Collection journeys require the local reference preview");
  await page.context().addCookies([
    {
      name: "shop-reference-scenario",
      value: scenario,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(path);
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
}

test("oversized collection rename preserves Saved memberships through reload", async ({
  page,
  baseURL,
}) => {
  await openScenario(
    page,
    baseURL,
    "saved-collection-expanded",
    "/saved?collection=source-favs",
  );
  const products = await page
    .locator(".saved-grid > article")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-product-id")),
    );
  const name = page.getByRole("textbox", {
    name: "Collection name",
    exact: true,
  });
  await button(page, "Collection options").click();
  await button(page, "Edit name").click();
  await name.fill("Retained custom name");
  await button(page, "Save").click();
  await expect(
    page.getByRole("heading", { name: "Retained custom name", exact: true }),
  ).toBeVisible();

  await button(page, "Collection options").click();
  await button(page, "Edit name").click();
  const boundaryName = "Collection " + "x".repeat(489);
  await name.fill(boundaryName + "over the limit");
  await expect(name).toHaveValue(boundaryName);
  await button(page, "Save").click();
  await expect(
    page.getByRole("heading", { name: boundaryName, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: boundaryName, exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".saved-grid > article")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-product-id")),
      ),
  ).toEqual(products);
});

test("oversized PDP collection creation keeps existing collections after reload", async ({
  page,
  baseURL,
}) => {
  await openScenario(
    page,
    baseURL,
    "saved-collection-expanded",
    "/products/shampoo-bag",
  );
  await button(page, "Save product").click();
  await button(page, "Create collection").click();
  const name = page.getByRole("textbox", {
    name: "Collection name",
    exact: true,
  });
  const boundaryName = "Product " + "x".repeat(492);
  await name.fill(boundaryName + "over the limit");
  await expect(name).toHaveValue(boundaryName);
  await name.press("Enter");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/saved");
  await expect(button(page, "Private Favs")).toBeVisible();
  await button(page, `Private ${boundaryName}`).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: boundaryName, exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.saved-grid [data-product-id="shampoo-bag"]'),
  ).toBeVisible();
});

for (const width of [320, 393, 430]) {
  test(`collection stages retain the draft and actual opener through Back/Forward at ${width}px`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 793 });
    await openScenario(
      page,
      baseURL,
      "saved-collection-expanded",
      "/saved?collection=source-favs",
    );
    const opener = button(page, "Collection options");
    await opener.click();
    await button(page, "Edit name").click();
    const name = page.getByRole("textbox", {
      name: "Collection name",
      exact: true,
    });
    await name.fill("Uncommitted collection draft");
    await page.goBack();
    await expect(dialog(page, "Collection options")).toBeVisible();
    await expect(button(page, "Edit name")).toBeFocused();
    await page.goForward();
    await expect(name).toHaveValue("Uncommitted collection draft");
    await expect(name).toBeFocused();
    await button(page, "Cancel").click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(opener).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Favs", exact: true }),
    ).toBeVisible();
    await opener.click();
    await button(page, "Edit name").click();
    await expect(name).toHaveValue("Favs");
    await name.fill("Retained name");
    await button(page, "Save").click();
    await expect(
      page.getByRole("heading", { name: "Retained name", exact: true }),
    ).toBeVisible();
    await expect(opener).toBeFocused();
    for (const [action, title] of [
      [
        "Make collection public",
        "Anyone on Shop will be able to view this collection",
      ],
      ["Delete collection", "Are you sure you want to delete this collection?"],
    ]) {
      await opener.click();
      await button(page, action).click();
      await expect(dialog(page, title)).toBeVisible();
      await page.goBack();
      await expect(dialog(page, "Collection options")).toBeVisible();
      await expect(button(page, action)).toBeFocused();
      await page.goForward();
      await expect(dialog(page, title)).toBeVisible();
      await button(page, "Cancel").click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(opener).toBeFocused();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".saved-grid > article")).toHaveCount(3);
  });
}

test("collection featured brands preserve captured spacing with and without a sheet", async ({
  page,
  baseURL,
}) => {
  const heading = page.getByRole("heading", {
    name: "Featured brands",
    exact: true,
  });
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await openScenario(
      page,
      baseURL,
      "saved-collection-expanded",
      "/saved?collection=source-favs",
    );
    await expect(heading).toHaveCSS("margin-top", "17px");
    await button(page, "Collection options").click();
    await expect(dialog(page, "Collection options")).toBeVisible();
    await expect(heading).toHaveCSS("margin-top", "32px");
    await button(page, "Delete collection").click();
    await expect(
      dialog(page, "Are you sure you want to delete this collection?"),
    ).toBeVisible();
    await expect(heading).toHaveCSS("margin-top", "32px");
    await button(page, "Cancel").click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(heading).toHaveCSS("margin-top", "17px");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("first-save editor Back/Forward retains its draft and Cancel keeps the saved product", async ({
  page,
  baseURL,
}) => {
  await openScenario(
    page,
    baseURL,
    "saved-empty",
    "/stores/kitsch/collections/best-sellers",
  );
  await button(page, "Save Rice Water Shampoo & Conditioner Combo").click();
  await button(page, "Create collection").click();
  const name = page.getByRole("textbox", {
    name: "Collection name",
    exact: true,
  });
  await name.fill("First collection draft");
  await button(page, "Public").click();
  await page.goBack();
  await expect(dialog(page, "Start your first collection")).toBeVisible();
  await expect(button(page, "Create collection")).toBeFocused();
  await page.goForward();
  await expect(name).toHaveValue("First collection draft");
  await expect(button(page, "Public")).toHaveAttribute("aria-pressed", "true");
  await expect(name).toBeFocused();
  await button(page, "Cancel").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    button(page, "Unsave Rice Water Shampoo & Conditioner Combo"),
  ).toBeFocused();
});

test("Saved selection consumes options stages and Done returns once to the collection", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-collection", "/saved");
  await button(page, "Private Favs").click();
  await button(page, "Collection options").click();
  await button(page, "Add from saved").click();
  await expect(
    page.getByRole("heading", { name: "Add from saved", exact: true }),
  ).toBeVisible();
  await button(page, "Done").click();
  await expect(page).toHaveURL(/\/saved\?collection=source-favs$/);
  await expect(button(page, "Collection options")).toBeFocused();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/saved$/);
});

test("product collection editor has reversible stages and submits exactly once", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-empty", "/products/shea-butter");
  const opener = button(page, "Save product");
  await opener.click();
  await button(page, "Create collection").click();
  const name = page.getByRole("textbox", {
    name: "Collection name",
    exact: true,
  });
  await name.fill("Product picks");
  await page.goBack();
  await expect(dialog(page, "Save to collection")).toBeVisible();
  await expect(button(page, "Create collection")).toBeFocused();
  await page.goForward();
  await expect(name).toHaveValue("Product picks");
  await expect(name).toBeFocused();
  await button(page, "Back").click();
  await expect(dialog(page, "Save to collection")).toBeVisible();
  await button(page, "Create collection").click();
  await expect(name).toHaveValue("Product picks");
  await name.press("Enter");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(button(page, "Product picks")).toHaveCount(1);
  await expect(button(page, "Product picks")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/products\/shea-butter$/);
});

test("Saved's circular Create control keeps its captured glyph and full hit target", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-library", "/saved");
  const create = page.locator(".saved-heading > .icon-button");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(create).toHaveAccessibleName("Create collection");
    await expect(create).toHaveCSS("width", "44px");
    await expect(create).toHaveCSS("height", "44px");
    await expect(create).toHaveCSS("border-top-width", "1px");
    await expect(create.locator("svg")).toHaveCSS("width", "18px");
    await create.focus();
    await create.press("Enter");
    await expect(
      page.getByRole("textbox", { name: "Collection name" }),
    ).toBeFocused();
    await button(page, "Cancel").click();
    await expect(create).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
