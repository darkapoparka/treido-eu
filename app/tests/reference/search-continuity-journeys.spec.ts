import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const firstTitle = "X721 Dusted Skinny Denim - 4th Day Sun Washed Blue";
const secondTitle = "Tough Love Stretch Straight Leg Jean - Light Wash";

async function openJeans(page: import("@playwright/test").Page) {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=Jeans");
  await expect(
    page.locator('[data-result-id="carpenter-jeans"]'),
  ).toBeVisible();
}

test("the default Jeans surface continues past related searches with only the two captured lower results", async ({
  page,
}) => {
  await openJeans(page);
  const primaryRows = page
    .locator(".search-results")
    .first()
    .locator("[data-result-id]");
  await expect(primaryRows).toHaveCount(2);
  await expect(primaryRows.nth(0)).toHaveAttribute(
    "data-result-id",
    "carpenter-jeans",
  );
  await expect(primaryRows.nth(1)).toHaveAttribute(
    "data-result-id",
    "heritage-jeans",
  );
  const continuation = page.locator('[data-search-continuation="jeans"]');
  await expect(
    page.locator(
      '[class*="relatedSearches"] + [data-search-continuation="jeans"]',
    ),
  ).toHaveCount(1);
  const rows = continuation.locator("[data-result-id]");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute(
    "data-result-id",
    "x721-dusted-skinny",
  );
  await expect(rows.nth(1)).toHaveAttribute(
    "data-result-id",
    "tough-love-light-wash",
  );
  await expect(rows.nth(0)).toContainText(firstTitle);
  await expect(rows.nth(1)).toContainText(secondTitle);
  await expect(rows.nth(0)).toContainText("$78.00");
  await expect(rows.nth(1)).toContainText("$39.99");
  await continuation.scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "View answer for Jeans", exact: true }),
  ).toBeVisible();

  const detailsTrigger = rows.nth(0).getByRole("button", {
    name: `View captured ${firstTitle}`,
    exact: true,
  });
  await detailsTrigger.click();
  const boundary = page.getByRole("dialog", {
    name: "Captured result details",
    exact: true,
  });
  await expect(boundary).toContainText(
    "does not include the complete product page",
  );
  await boundary
    .getByRole("button", { name: "Back to search", exact: true })
    .click();
  await expect(boundary).not.toBeVisible();
  await expect(detailsTrigger).toBeFocused();

  const save = rows.nth(0).getByRole("button", {
    name: `Save ${firstTitle}`,
    exact: true,
  });
  await save.click();
  await expect(
    rows.nth(0).getByRole("button", {
      name: `Unsave ${firstTitle}`,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  const saved = page.locator('[data-product-id="x721-dusted-skinny"]');
  await expect(saved).toBeVisible();
  await expect(saved).toContainText(firstTitle);
  await expect(saved).toContainText("mmml");
});

test("the captured continuation is bounded to the unfiltered Jeans history and contains at reference widths", async ({
  page,
}) => {
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await openJeans(page);
    const continuation = page.locator('[data-search-continuation="jeans"]');
    await continuation.scrollIntoViewIfNeeded();
    const geometry = await continuation.evaluate((element) => {
      const rows = [
        ...element.querySelectorAll<HTMLElement>("[data-result-id]"),
      ];
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        contained: rows.every((row) => {
          const bounds = row.getBoundingClientRect();
          return bounds.left >= 0 && bounds.right <= innerWidth;
        }),
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.contained).toBe(true);
  }

  await page.goto("/search?q=Jeans&deals=true");
  await expect(page.locator('[data-result-id="heritage-jeans"]')).toBeVisible();
  await expect(page.locator('[data-search-continuation="jeans"]')).toHaveCount(
    0,
  );
  await page.goto("/search?q=shirts");
  await expect(page.locator('[data-search-continuation="jeans"]')).toHaveCount(
    0,
  );
});
