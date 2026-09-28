import { expect, test } from "@playwright/test";

import { useReferenceScenario } from "./helpers";

test("flows 60-61 expose empty, waiting, transit, and captured order-detail states", async ({
  page,
}) => {
  await page.goto("/orders?view=empty");
  await expect(
    page.getByRole("heading", { name: "Track all your orders here" }),
  ).toBeVisible();
  await page.goto("/orders?view=waiting");
  await expect(
    page.getByRole("heading", { name: "Expected by Aug 3" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Deals based on your orders" }),
  ).toHaveCount(0);
  await page.goto("/orders");
  await expect(
    page.getByRole("heading", { name: "Arrives Jul 31–Aug 1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Deals based on your orders/ }),
  ).toBeVisible();
  await page.goto("/orders/REF-1001?state=waiting");
  await expect(
    page.getByText("Order #12748251", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$3.65", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Expected by Aug 3/ }).click();
  await expect(
    page.getByText("Waiting for details", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Amazon Logistics", { exact: true })).toHaveCount(
    0,
  );
});

test("flows 64-65 show source tracking activity and editable tracking details", async ({
  page,
}) => {
  await page.goto("/orders/REF-1001?state=in-transit&view=tracking");
  await expect(
    page.getByText("Amazon Logistics", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("TBA333200762603", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".delivery-preview")
      .getByText("Jurupa Valley, CA, US · Jul 29, 4:26pm", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View all activity" }).click();
  const activity = page.getByRole("dialog", { name: "Delivery progress" });
  await expect(
    activity.getByText("Successfully delivered", { exact: true }),
  ).toBeVisible();
  // The captured activity sheet has no close glyph; Back dismisses its history entry.
  await page.goBack();
  await expect(activity).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "View all activity", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Edit tracking details" }).click();
  const editor = page.getByRole("dialog", { name: "Edit tracking details" });
  await expect(
    editor.getByRole("textbox", { name: "Tracking number" }),
  ).toHaveValue("TBA333200762603");
  await expect(editor.getByRole("textbox", { name: "Carrier" })).toHaveValue(
    "Amazon Logistics",
  );
  await editor
    .getByRole("textbox", { name: "Package name" })
    .fill("Shampoo Bar Bag KITSCH");
  await editor.getByRole("button", { name: "Update tracking details" }).click();
  await expect(page.getByRole("status")).toContainText("Changes saved");
});

test("flows 62, 66, and 67 preserve order actions, archive, and local review editing", async ({
  page,
}) => {
  await page.goto("/orders?view=waiting");
  await page.getByRole("link", { name: /KITSCH Expected by Aug 3/ }).click();
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  await page.bringToFront();
  await page.getByRole("button", { name: "Copy order number" }).click();
  await expect(page.getByRole("status")).toContainText("Order number copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "12748251",
  );
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page.getByRole("button", { name: "Archive order" }).click();
  await expect(
    page.getByRole("dialog", { name: "Your order", exact: true }),
  ).not.toBeVisible();
  // Closing the overlay retires its own asynchronous browser-history entry.
  // Verify that transition before issuing the separate page-level Back.
  await expect
    .poll(() => page.evaluate(() => Boolean(window.history.state?.shopSheet)))
    .toBe(false);
  await page.goBack();
  await expect(page).toHaveURL(/\/orders\?view=waiting$/);
  await page.getByRole("button", { name: "More order options" }).click();
  await page.getByRole("link", { name: "View order archive" }).click();
  await expect(
    page.locator(".archive-order-row").filter({ hasText: "$10.82" }),
  ).toContainText("Ordered Jul 27");

  await page.goto("/orders/REF-1001?state=delivered");
  await page.getByRole("link", { name: /Review your order/ }).click();
  await expect(
    page.getByText("Reviewing as Alex", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Tell us about the product" })
    .fill("Love it");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit your review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update review" }),
  ).toBeVisible();
});

test("flows 68 and 79 create a manual package and retain source order-history composition", async ({
  page,
}) => {
  await useReferenceScenario(page, "orders-transit-history");
  await page.goto("/orders");
  await page.getByRole("button", { name: "More order options" }).click();
  await page.getByRole("link", { name: "Add order manually" }).click();
  await page
    .getByRole("textbox", { name: "Tracking number" })
    .fill("68448512123");
  await page
    .getByRole("textbox", { name: "Package name" })
    .fill("Loose Fit Printed T-Shirt");
  await page.getByRole("textbox", { name: "Carrier" }).fill("DHL");
  await page
    .getByRole("button", { name: "DHL eCommerce", exact: true })
    .click();
  await page.getByRole("button", { name: "Add order" }).click();
  await expect(
    page.getByRole("heading", { name: "Label created" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Loose Fit Printed T-Shirt", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".manual-tracking-card")).toHaveCount(1);
  await expect(page.locator(".manual-tracking-card")).toHaveAttribute(
    "href",
    "/orders/REF-manual-shirt",
  );
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page
    .getByRole("link", { name: "Order history ›", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Order history" }),
  ).toBeVisible();
  await expect(
    page.getByText("Connect email to see more deliveries", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Loose Fit Printed T-Shirt", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("KITSCH", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("1 item · $10.82", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Search orders" })).toHaveCount(
    0,
  );
});

test("flow 63 marks a manually tracked DHL package delivered without a carrier side effect", async ({
  page,
}) => {
  await page.goto("/orders/new");
  await page
    .getByRole("textbox", { name: "Tracking number" })
    .fill("68448512123");
  await page
    .getByRole("textbox", { name: "Package name" })
    .fill("Loose Fit Printed T-Shirt");
  await page.getByRole("textbox", { name: "Carrier" }).fill("DHL");
  await page
    .getByRole("button", { name: "DHL eCommerce", exact: true })
    .click();
  await page.getByRole("button", { name: "Add order" }).click();
  await page
    .getByRole("link", { name: /Loose Fit Printed T-Shirt Label created/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Label created", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark as delivered" }).click();
  await expect(page.getByRole("status")).toContainText("Marked as delivered");
  await expect(
    page.getByRole("button", { name: "Unmark as delivered" }),
  ).toBeVisible();
});

test("copying an order number exposes the number when clipboard access is rejected", async ({
  page,
}) => {
  // Exercise the browser API rejection branch deterministically. The success
  // journey above uses the real clipboard with origin-scoped permissions.
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async () => {
        throw new DOMException("Clipboard access denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/orders/REF-1001?state=waiting");
  await page
    .getByRole("button", { name: "Order options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Copy order number", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Order number: 12748251");
  await expect(page.getByRole("status")).not.toContainText("copied");
  await expect(
    page.getByRole("dialog", { name: "Your order", exact: true }),
  ).not.toBeVisible();
});
