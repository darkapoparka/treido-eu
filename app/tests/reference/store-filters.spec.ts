import { test, expect } from "@playwright/test";

for (const dismissal of ["Done", "Back"] as const) {
  test(`store sort stays a draft through ${dismissal}, then commits and survives reload`, async ({
    page,
  }) => {
    await page.goto("/stores/kitsch/collections/whats-new");
    await page
      .getByRole("button", { name: "Filter collection", exact: true })
      .click();
    const filter = page.getByRole("dialog", { name: "Filter", exact: true });
    await filter.getByRole("button", { name: /Sort by/ }).click();
    const sort = page.getByRole("dialog", { name: "Sort by", exact: true });
    await sort
      .getByRole("button", { name: "Price: low to high", exact: true })
      .click();
    await expect(sort).toBeVisible();
    await expect(
      sort.getByRole("button", { name: "Price: low to high", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(new URL(page.url()).searchParams.get("sort")).toBeNull();
    if (dismissal === "Back") {
      await page.goBack();
      await expect(filter).toBeVisible();
      await expect(
        filter.getByRole("button", { name: /Sort by/ }),
      ).toContainText("Best selling");
      expect(new URL(page.url()).searchParams.get("sort")).toBeNull();
      await page.goForward();
      await expect(sort).toBeVisible();
      await expect(
        sort.getByRole("button", { name: "Price: low to high", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await sort.getByRole("button", { name: "Done", exact: true }).click();
    await expect(sort).not.toBeVisible();
    await expect(filter).not.toBeVisible();
    await expect(page).toHaveURL(/sort=Price%3A\+low\+to\+high/);
    await expect(
      page.locator(".product-grid .product-card").first(),
    ).toContainText("Beachy Gelato");
    await page.reload();
    await expect(
      page.locator(".product-grid .product-card").first(),
    ).toContainText("Beachy Gelato");
    await page
      .getByRole("button", { name: "Filter collection", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Filter", exact: true })
        .getByRole("button", { name: /Sort by/ }),
    ).toContainText("Price: low to high");
  });
}

test("collection sale and stock chips own their criteria", async ({ page }) => {
  await page.goto("/stores/kitsch/collections/whats-new");
  await page.getByRole("button", { name: "On sale", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".product-grid .product-card")).toHaveCount(1);
  await expect(page.locator(".product-grid .product-card")).toContainText(
    "Summer Mystery Box",
  );
  await page.getByRole("button", { name: "In-stock", exact: true }).click();
  await expect(page).toHaveURL(/stock=0/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "On sale", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "In-stock", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("store on-sale draft hides its sort value but keeps the choice connected", async ({
  page,
}) => {
  await page.goto("/stores/kitsch");
  await page
    .getByRole("button", { name: "Filter store products", exact: true })
    .click();
  const filter = page.getByRole("dialog", { name: "Filter", exact: true });
  const sortRow = filter.getByRole("button", { name: /Sort by/ });
  await expect(sortRow).toContainText("Best selling");

  await filter.getByRole("button", { name: "On sale", exact: true }).click();
  await expect(
    filter.getByRole("button", { name: "On sale", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(sortRow).not.toContainText("Best selling");
  await filter.getByRole("button", { name: "Close Filter" }).click();
  await expect(filter).not.toBeVisible();
  expect(new URL(page.url()).searchParams.get("sale")).toBeNull();

  await page
    .getByRole("button", { name: "Filter store products", exact: true })
    .click();
  await expect(filter).toBeVisible();
  await expect(
    filter.getByRole("button", { name: "On sale", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(sortRow).toContainText("Best selling");
  await filter.getByRole("button", { name: "On sale", exact: true }).click();
  await expect(sortRow).not.toContainText("Best selling");

  await sortRow.click();
  const sort = page.getByRole("dialog", { name: "Sort by", exact: true });
  await expect(
    sort.getByRole("button", { name: "Best selling", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(filter).toBeVisible();
  await expect(sortRow).not.toContainText("Best selling");
  await page.goForward();
  await expect(sort).toBeVisible();
  await sort
    .getByRole("button", { name: "Price: low to high", exact: true })
    .click();
  await page.goBack();
  await expect(filter).toBeVisible();
  await expect(sortRow).not.toContainText("Best selling");
  await page.goForward();
  await expect(sort).toBeVisible();
  await expect(
    sort.getByRole("button", { name: "Price: low to high", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await sort.getByRole("button", { name: "Done", exact: true }).click();
  await expect(filter).not.toBeVisible();
  await expect(page).toHaveURL(/sale=1/);
  await expect(page).toHaveURL(/sort=Price%3A\+low\+to\+high/);

  await page.reload();
  await page
    .getByRole("button", { name: "Filter store products", exact: true })
    .click();
  const savedFilter = page.getByRole("dialog", {
    name: "Filter",
    exact: true,
  });
  await expect(
    savedFilter.getByRole("button", { name: "On sale", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const savedSortRow = savedFilter.getByRole("button", { name: /Sort by/ });
  await expect(savedSortRow).not.toContainText("Best selling");
  await savedSortRow.click();
  await expect(
    page
      .getByRole("dialog", { name: "Sort by", exact: true })
      .getByRole("button", { name: "Price: low to high", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
