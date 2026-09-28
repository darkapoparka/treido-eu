import { expect, test } from "@playwright/test";

import { useReferenceScenario } from "./helpers";

test("checkout card Edit, summary help and country selector preserve local details and focus", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch");
  await page.getByRole("button", { name: /^Payment/ }).click();
  const options = page.getByRole("button", {
    name: "Payment method options 4263",
    exact: true,
  });
  await options.click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", {
    name: "Edit payment method",
    exact: true,
  });
  await expect(edit).toContainText("4263");
  await expect(
    edit.getByRole("textbox", { name: "Card number", exact: true }),
  ).toHaveCount(0);
  await edit
    .getByRole("textbox", { name: "Expiry", exact: true })
    .fill("12/30");
  await edit.getByRole("button", { name: "Save card", exact: true }).click();
  await expect(edit).not.toBeVisible();
  await expect(options).toBeFocused();
  await options.click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    edit.getByRole("textbox", { name: "Expiry", exact: true }),
  ).toHaveValue("12/30");
  await expect(edit).toContainText("1226 University Dr");
  await page.keyboard.press("Escape");

  const country = page.getByRole("button", {
    name: "Text offers country: United States (+1)",
    exact: true,
  });
  await page
    .getByRole("textbox", { name: "Phone number for text offers" })
    .fill("6502137552");
  await country.click();
  const selector = page.getByRole("dialog", {
    name: "Country or region",
    exact: true,
  });
  await selector
    .getByRole("button", { name: "Use United States (+1)", exact: true })
    .click();
  await expect(country).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Phone number for text offers" }),
  ).toHaveValue("6502137552");
  await page.locator(".source-total-row").click();
  for (const [button, title, amount] of [
    ["About shipping", "Shipping", "$6.82"],
    ["About estimated taxes", "Estimated taxes", "$0.35"],
  ]) {
    const trigger = page.getByRole("button", { name: button, exact: true });
    await trigger.click();
    const help = page.getByRole("dialog", { name: title, exact: true });
    await expect(help).toContainText(amount);
    await page.goBack();
    await expect(help).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});

test("payment field helpers preserve entered values and let the buyer correct the card name", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch");
  await page.getByRole("button", { name: /^Payment/ }).click();
  await page.getByRole("button", { name: /Pay another way/ }).click();
  const editor = page.getByRole("dialog", {
    name: "Payment methods",
    exact: true,
  });
  const name = editor.getByRole("textbox", {
    name: "Name on card",
    exact: true,
  });
  await expect(name).toHaveValue("Alex Smith");
  await editor
    .getByRole("textbox", { name: "Card number", exact: true })
    .fill("4242424242424242");
  await editor
    .getByRole("textbox", { name: "Security code", exact: true })
    .fill("123");
  await editor
    .getByRole("button", { name: "Clear name on card", exact: true })
    .click();
  await expect(name).toBeEmpty();
  await expect(name).toBeFocused();
  await name.fill("Alex Smith");
  const help = editor.getByRole("button", {
    name: "About security code",
    exact: true,
  });
  await help.click();
  await expect(editor.getByRole("status")).toContainText(
    "3 or 4 digit security code",
  );
  await help.click();
  await expect(editor.getByRole("status")).toHaveCount(0);
  await editor.getByRole("button", { name: /^Bill to/ }).click();
  await expect(
    editor.locator(".source-billing-options .selected"),
  ).toContainText("Alex Smith, 1226 University Dr");
  await expect(
    editor.locator(".source-billing-options .selected"),
  ).toContainText("+16502137552");
  await expect(
    editor.getByRole("textbox", { name: "Card number", exact: true }),
  ).toHaveValue("4242424242424242");
  await expect(
    editor.getByRole("textbox", { name: "Security code", exact: true }),
  ).toHaveValue("123");
  await editor.evaluate((dialog) => {
    dialog.scrollTop = 60;
    dialog.dispatchEvent(new Event("scroll"));
  });
  const paymentForm = editor.locator(".source-payment-editor");
  await expect(paymentForm).toHaveClass(/source-payment-editor-scrolled/);
  for (const selector of [
    ".source-card-method",
    ".source-apple-choice",
    ".source-billing-group",
  ]) {
    await expect(editor.locator(selector)).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, 1, 0, -17)",
    );
  }
  await editor.evaluate((dialog) => {
    dialog.scrollTop = 0;
    dialog.dispatchEvent(new Event("scroll"));
  });
  await expect(paymentForm).not.toHaveClass(/source-payment-editor-scrolled/);
  await expect(editor.locator(".source-card-method")).toHaveCSS(
    "transform",
    "none",
  );
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Pay another way/ }),
  ).toBeFocused();
});

test("captured confirmation opens related products and keeps receipt sharing available after scrolling", async ({
  page,
  context,
}) => {
  await useReferenceScenario(page, "checkout");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/orders/REF-1001/confirmation");
  await page
    .getByRole("link", { name: "Black Conditioner Bar Bag", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/products\/black-conditioner-bag/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Order confirmed", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View order receipt", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Email address", exact: true })
    .scrollIntoViewIfNeeded();
  const share = page.getByRole("button", {
    name: "Share receipt",
    exact: true,
  });
  await expect(share).toBeInViewport();
  await share.click();
  await expect(page.getByRole("status")).toHaveText("Receipt link copied");
});

test("confirmation preserves its captured shelf, fractional rating and saved state at mobile widths", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/orders/REF-1001/confirmation");
  const first = page.locator(
    '.order-confirmation-page [data-product-id="black-conditioner-bag"]',
  );
  const second = page.locator(
    '.order-confirmation-page [data-product-id="chocolate-body-bag"]',
  );
  await expect(first.locator(".product-media img")).toHaveAttribute(
    "src",
    "/api/reference-media/confirmation-black-conditioner-photo",
  );
  await expect(second.locator(".product-media img")).toHaveAttribute(
    "src",
    "/api/reference-media/confirmation-chocolate-body-photo",
  );
  await expect(
    first.getByRole("img", { name: "4.5 out of 5 stars" }),
  ).toBeVisible();
  // SSR and hydrated DOM serialize spacing differently; assert the same fill.
  await expect
    .poll(() =>
      first
        .locator(".review-rating-stars-fill")
        .evaluate((element) => (element as HTMLElement).style.width),
    )
    .toBe("90%");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const geometry = await page
      .locator(".order-confirmation-page > .product-rail")
      .evaluate((rail) => ({
        right: rail.getBoundingClientRect().right,
        width: rail.querySelector(".product-media")!.getBoundingClientRect()
          .width,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
    expect(geometry.overflow).toBe(false);
    expect(geometry.right).toBeCloseTo(width, 0);
    expect(geometry.width).toBeCloseTo(173, 0);
  }
  const dockFade = await page.locator(".floating-dock").evaluate((dock) => {
    const fade = getComputedStyle(dock, "::before");
    return { pointerEvents: fade.pointerEvents, height: fade.height };
  });
  expect(dockFade).toEqual({ pointerEvents: "none", height: "128px" });
  const save = first.getByRole("button", {
    name: "Save Black Conditioner Bar Bag",
    exact: true,
  });
  await save.focus();
  await save.press("Enter");
  await expect(
    first.getByRole("button", {
      name: "Unsave Black Conditioner Bar Bag",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await first
    .getByRole("link", { name: "Black Conditioner Bar Bag", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products\/black-conditioner-bag$/);
  await page.goBack();
  await expect(
    first.getByRole("button", {
      name: "Unsave Black Conditioner Bar Bag",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
});
