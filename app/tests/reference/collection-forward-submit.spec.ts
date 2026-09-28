import { expect, test } from "@playwright/test";

test("a committed collection editor can be restored with Forward and submitted again", async ({
  page,
  baseURL,
}) => {
  if (!baseURL)
    throw new Error("This journey requires the local reference preview");
  await page.context().addCookies([
    {
      name: "shop-reference-scenario",
      value: "saved-collection-expanded",
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/saved?collection=source-favs");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page
    .getByRole("button", { name: "Collection options", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit name", exact: true }).click();
  const name = page.getByRole("textbox", {
    name: "Collection name",
    exact: true,
  });
  await name.fill("First revision");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "First revision", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("dialog", { name: "Collection options", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(name).toHaveValue("First revision");
  await name.fill("Second revision");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Second revision", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("Forward after creating a product collection permits a new deliberate submission", async ({
  page,
  baseURL,
}) => {
  if (!baseURL)
    throw new Error("This journey requires the local reference preview");
  await page.context().addCookies([
    {
      name: "shop-reference-scenario",
      value: "saved-empty",
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/products/shea-butter");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  const saveProduct = page.getByRole("button", {
    name: "Save product",
    exact: true,
  });
  await saveProduct.click();
  await page
    .getByRole("button", { name: "Create collection", exact: true })
    .click();
  const name = page.getByRole("textbox", {
    name: "Collection name",
    exact: true,
  });
  await name.fill("First product collection");
  await name.press("Enter");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("dialog", { name: "Save to collection", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(name).toHaveValue("First product collection");
  await name.fill("Second product collection");
  await name.press("Enter");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await saveProduct.click();
  await expect(
    page.getByRole("button", { name: "First product collection", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Second product collection",
      exact: true,
    }),
  ).toHaveCount(1);
});
