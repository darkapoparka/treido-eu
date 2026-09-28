import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("shop report restores its selected reason and focus after closed Back and Forward", async ({
  page,
}) => {
  await page.goto("/deals");
  const trigger = page.getByRole("button", {
    name: "More options for Rinse Bath & Body",
    exact: true,
  });
  await trigger.click();
  const menu = page.getByRole("dialog", {
    name: "Rinse Bath & Body",
    exact: true,
  });
  await menu.getByRole("button", { name: "Report shop", exact: true }).click();
  const report = page.getByRole("dialog", { name: "Report shop", exact: true });
  await report.getByRole("radio", { name: "Other", exact: true }).check();
  await page.goBack();
  await expect(
    menu.getByRole("button", { name: "Report shop", exact: true }),
  ).toBeFocused();
  await page.goBack();
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.goForward();
  await expect(menu).toBeVisible();
  await page.goForward();
  await expect(
    report.getByRole("radio", { name: "Other", exact: true }),
  ).toBeChecked();
  await expect(
    report.getByRole("radio", { name: "Other", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(report).not.toBeVisible();
  await page
    .getByRole("button", {
      name: "More options for Syman Says Farms",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Report shop", exact: true }).click();
  await expect(report.locator("input:checked")).toHaveCount(0);
});

test("Deals saves captured listings across navigation and reload without inventing checkout", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/deals");
  const card = page.locator('.deals-feed [data-product-id="rinse-tres"]');
  await card.getByRole("button", { name: /^Save / }).click();
  await expect(card.getByRole("button", { name: /^Unsave / })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await card.getByRole("button", { name: /^View Handmade/ }).click();
  const detail = page.getByRole("dialog", { name: /Handmade Tres Clay/ });
  await expect(detail).toContainText(
    "variants, inventory and purchase destination were not recorded",
  );
  await expect(
    detail.getByRole("button", { name: /Buy|Add to cart/ }),
  ).toHaveCount(0);
  await detail.getByRole("link", { name: "View Saved", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
  const saved = page.locator('.saved-product[data-product-id="rinse-tres"]');
  await expect(saved).toBeVisible();
  await page.reload();
  await expect(saved).toBeVisible();
  await page.goto("/deals");
  await expect(card.getByRole("button", { name: /^Unsave / })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Deals shop actions follow, open captured shelves, hide and undo with focus and Back", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/deals");
  const more = page.getByRole("button", {
    name: "More options for Rinse Bath & Body",
    exact: true,
  });
  await more.click();
  const menu = page.getByRole("dialog", {
    name: "Rinse Bath & Body",
    exact: true,
  });
  await menu.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    menu.getByRole("button", { name: "Following", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await menu.getByRole("button", { name: "Visit shop", exact: true }).click();
  const shop = page.locator(".deal-detail-sheet[open]");
  await expect(shop.locator(".deal-product")).toHaveCount(2);
  await page.goBack();
  await expect(shop).toHaveCount(0);
  await expect(
    menu.getByRole("button", { name: "Visit shop", exact: true }),
  ).toBeFocused();
  await menu
    .getByRole("button", { name: "Not interested", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Not interested", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(menu).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("dialog", { name: "Not interested", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Want to see less of Rinse Bath & Body",
      exact: true,
    })
    .click();
  const store = page.locator('.deals-feed [data-store-id="rinse-bath-body"]');
  await expect(store.getByRole("status")).toContainText(
    "We’ll show you less like this",
  );
  await store.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(store.locator(".deal-product")).toHaveCount(2);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Following", exact: true }).click();
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByRole("link", { name: "Rinse Bath & Body", exact: true })
    .click();
  await expect(page).toHaveURL(/\/stores\/rinse-bath-body$/);
  await expect(
    page.locator(".deal-detail-sheet[open] .deal-product"),
  ).toHaveCount(2);
  await page.reload();
  await expect(
    page.locator(".deal-detail-sheet[open] .deal-product"),
  ).toHaveCount(2);
});

for (const width of [320, 393, 430]) {
  test(`Deals ${width}px retains only captured trailing photos and dismisses boundaries`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 793 });
    await page.goto("/deals");
    await expect(page.locator(".deals-feed .deal-product")).toHaveCount(8);
    await expect(page.locator(".deal-source-tail")).toHaveCount(4);
    const tail = page.getByRole("button", {
      name: "Additional captured products from Rinse Bath & Body",
      exact: true,
    });
    await tail.click();
    const details = page.getByRole("dialog", {
      name: "Additional captured products",
      exact: true,
    });
    await expect(details).toContainText("Only the edge");
    await page.goBack();
    await expect(details).not.toBeVisible();
    await expect(tail).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
