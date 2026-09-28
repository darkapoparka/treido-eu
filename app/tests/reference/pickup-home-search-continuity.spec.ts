import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("pickup choices and its discount draft survive payment settings Back and Forward", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=white-rock");
  const pickup = page.getByRole("tab", { name: "Pickup", exact: true });
  const offers = page.getByRole("checkbox", {
    name: "Sign me up for news and offers from this store",
    exact: true,
  });
  await pickup.click();
  await offers.uncheck();
  await page.getByRole("button", { name: "Add discount", exact: true }).click();
  const code = page.getByRole("textbox", {
    name: "Discount code",
    exact: true,
  });
  await code.fill("LOCAL-DRAFT");
  await page.locator(".pickup-total").click();
  const edit = page.getByRole("link", {
    name: "Edit payment method",
    exact: true,
  });
  await edit.click();
  await expect(page).toHaveURL(/\/account\/payments$/);
  for (let visit = 0; visit < 2; visit += 1) {
    await page.goBack();
    await expect(pickup).toHaveAttribute("aria-selected", "true");
    await expect(offers).not.toBeChecked();
    await expect(code).toHaveValue("LOCAL-DRAFT");
    await expect(page.locator(".pickup-total")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.locator(".pickup-total")).toContainText("$3.80");
    await expect(edit).toBeFocused();
    if (visit === 0) {
      await page.goForward();
      await expect(page).toHaveURL(/\/account\/payments$/);
    }
  }
  await page.goto("/");
  await page.goto("/checkout?store=white-rock");
  await expect(pickup).toHaveAttribute("aria-selected", "false");
  await expect(offers).toBeChecked();
  await expect(code).toHaveCount(0);
  await expect(page.locator(".pickup-total")).toContainText("$10.83");
});

test("StoreSearch uncommitted Cancel and Escape return to header or pinned origins without duplicate entries", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/stores/kitsch");
  const header = page
    .locator('.store-actions a[aria-label="Search store"]')
    .first();
  const input = page.getByRole("textbox", {
    name: "Search KITSCH",
    exact: true,
  });
  await header.click();
  await input.fill("rice");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/kitsch$/);
  await expect(header).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/stores\/kitsch\/search$/);
  await expect(input).toBeEmpty();
  await input.fill("discard again");
  await input.press("Escape");
  await expect(header).toBeFocused();
  await page.locator(".store-grid-heading").scrollIntoViewIfNeeded();
  const pinned = page.locator(
    '.store-compact-actions a[aria-label="Search store"]',
  );
  await expect(pinned).toBeVisible();
  const y = await page.evaluate(() => scrollY);
  await pinned.click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(pinned).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  const info = page.locator(
    '.store-compact-actions a[aria-label="Store information"]',
  );
  await info.click();
  await page
    .getByRole("link", { name: "Close store information", exact: true })
    .click();
  await expect(info).toBeFocused();
  await page.goto("/stores/kitsch/search");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/kitsch$/);
});

test("recent-product Home uses canonical shop reasons, reporting and Hide Undo", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-recent-products");
  await page.goto("/?feed=recent-products");
  const feed = page.locator(".store-feed");
  const more = feed.getByRole("button", { name: "More options", exact: true });
  const menu = page.getByRole("dialog", { name: "VEHLA", exact: true });
  await more.click();
  await menu
    .getByRole("button", { name: "Not interested", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Not interested", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    menu.getByRole("button", { name: "Not interested", exact: true }),
  ).toBeFocused();
  await page.goBack();
  await expect(more).toBeFocused();
  await page.goForward();
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Report shop", exact: true }).click();
  const report = page.getByRole("dialog", { name: "Report shop", exact: true });
  const other = report.getByRole("radio", { name: "Other", exact: true });
  await other.check();
  await page.goBack();
  await expect(
    menu.getByRole("button", { name: "Report shop", exact: true }),
  ).toBeFocused();
  await page.goForward();
  await expect(other).toBeChecked();
  await expect(other).toBeFocused();
  await report.getByRole("button", { name: "Report", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Report saved", exact: true }),
  ).toContainText("No report was sent");
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await more.click();
  await menu
    .getByRole("button", { name: "Not interested", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Want to see less of VEHLA", exact: true })
    .click();
  await expect(feed.locator(".home-product-row")).toHaveCount(0);
  await feed.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(feed.locator(".home-product-row")).toBeVisible();
  const scroll = await page.evaluate(() => scrollY);
  await more.click();
  await menu.getByRole("link", { name: "Visit shop", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/vehla$/);
  await page.goBack();
  await expect(more).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
});

test("Pura Visit shop returns to the actual campaign options opener", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-pura-options");
  await page.goto("/?feed=pura-options");
  const more = page.getByRole("button", {
    name: "More options for Pura",
    exact: true,
  });
  await more.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await more.click();
  await page
    .getByRole("dialog", { name: "Pura", exact: true })
    .getByRole("link", { name: "Visit shop", exact: true })
    .click();
  await expect(page).toHaveURL(/\/stores\/pura$/);
  await page.goBack();
  await expect(more).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
});
