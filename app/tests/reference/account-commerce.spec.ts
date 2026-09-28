import { test, expect } from "@playwright/test";
import { capturedReceipts } from "../../apps/web/src/features/commerce/receipt-data";

test("captured receipt net amount does not subtract its informational discount twice", () => {
  const receipt = capturedReceipts["REF-1001"];
  expect(receipt.discount).toBe(135);
  expect(receipt.itemAmount + receipt.shipping + receipt.tax).toBe(
    receipt.total,
  );
  expect(receipt.total).toBe(1082);
});

test("archived order uses compact source row and supports the empty archive state", async ({
  page,
}) => {
  await page.goto("/orders/archived");
  await expect(
    page.getByRole("heading", { name: "Archived", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".archive-order-row")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /Buy again/ })).toHaveCount(0);
  await page.locator(".archive-order-row").click();
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Unarchive order", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await page.getByRole("button", { name: "More order options" }).click();
  await page
    .getByRole("link", { name: "View order archive", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No archived orders yet" }),
  ).toBeVisible();
  await expect(page.locator(".archive-empty-package")).toBeVisible();
});

test("review product composition transitions to local edit review", async ({
  page,
}) => {
  await page.goto("/orders/REF-1001/review");
  await expect(page.getByAltText("Shampoo Bar Bag")).toBeVisible();
  await expect(
    page.getByText("1 of 1 products", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "5 stars", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Tell us about the product", exact: true })
    .fill("Love it");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Edit your review", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update review", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "It has not been published",
  );
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
});

test("existing order opens the complete captured receipt without a new purchase", async ({
  page,
}) => {
  await page.goto("/orders/REF-1001");
  await page.getByRole("link", { name: "View receipt", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Receipt", exact: true }),
  ).toBeVisible();
  for (const text of ["Billing address", "Shipping method", "Email address"])
    await expect(
      page.getByRole("heading", { name: text, exact: true }),
    ).toBeVisible();
  await expect(page.locator(".receipt-total")).toContainText("$10.82");
  await expect(page.getByText("-$1.35", { exact: true })).toBeVisible();
  const shipping = page.locator(".receipt-section").filter({
    has: page.getByRole("heading", { name: "Shipping address", exact: true }),
  });
  const receiptSpacing = await shipping.evaluate((section) => {
    const heading = section.querySelector("h2");
    if (!heading) throw new Error("Receipt section heading is missing");
    return {
      sectionMargin: getComputedStyle(section).marginTop,
      headingGap: getComputedStyle(heading).marginBottom,
    };
  });
  expect(receiptSpacing).toEqual({ sectionMargin: "47px", headingGap: "17px" });
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("email auth has source-specific code stage and stops at verification boundary", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("mira@example.test");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verify your email", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change email address", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Verification code", exact: true })
    .fill("123456");
  await expect(
    page.getByRole("dialog", {
      name: "Authentication is not connected",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("No code was sent and no account was signed in.", {
      exact: true,
    }),
  ).toBeVisible();
});
