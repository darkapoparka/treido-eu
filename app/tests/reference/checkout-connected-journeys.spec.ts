import { expect, test } from "@playwright/test";

import { useReferenceScenario } from "./helpers";

test("checkout keeps delivery and payment expanded together and re-quotes a selected method", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch");
  await expect(page.locator(".shop-cash-section")).toBeVisible();
  for (const name of [/^Ship to/, /^Shipping/, /^Plan/, /^Payment/]) {
    await page.getByRole("button", { name }).click();
  }
  await expect(
    page.locator('.checkout-section-toggle[aria-expanded="true"]'),
  ).toHaveCount(4);
  await expect(page.locator(".shop-cash-section")).toHaveCount(0);
  await expect(
    page.getByText("Installments unavailable", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Priority Shipping/ }).check();
  await expect(
    page.getByRole("button", { name: /Pay now \$15\.74/ }),
  ).toBeEnabled();
  await expect(
    page.locator('.checkout-section-toggle[aria-expanded="true"]'),
  ).toHaveCount(4);

  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const pay = await page.locator(".checkout-pay").boundingBox();
    expect(pay).not.toBeNull();
    expect(pay!.x).toBeGreaterThanOrEqual(0);
    expect(pay!.x + pay!.width).toBeLessThanOrEqual(width);
  }
  await page
    .locator(".checkout-section-toggle")
    .filter({ hasText: /^Payment/ })
    .click();
  await expect(page.locator(".shop-cash-section")).toBeVisible();
});

test("initial checkout address has compact details, preserves edits through Back and Forward, and reaches card entry", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch&stage=address-search");
  await page
    .getByRole("textbox", { name: "Search address" })
    .fill("1226 University Dr, Menlo");
  await page.getByRole("button", { name: /^1226 University Dr/ }).click();
  await expect(page).toHaveURL(/stage=address$/);
  await expect(page.locator(".source-selected-address")).toContainText(
    "1226 University Dr",
  );
  const first = page.getByRole("textbox", { name: "First name", exact: true });
  const last = page.getByRole("textbox", { name: "Last name", exact: true });
  await expect(first).toBeEmpty();
  await expect(last).toBeEmpty();
  await first.fill("Alex");
  await last.fill("Smith");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Address", exact: true }),
  ).toHaveValue("1226 University Dr");
  await expect(first).toHaveValue("Alex");
  await page.goBack();
  await expect(page).toHaveURL(/stage=address-search$/);
  await expect(
    page.getByRole("textbox", { name: "Search address" }),
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/stage=address$/);
  await expect(first).toHaveValue("Alex");
  await expect(last).toHaveValue("Smith");
  await page
    .getByRole("button", { name: "Continue to payment details", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Add a card", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(first).toHaveValue("Alex");
  await expect(last).toHaveValue("Smith");
});

test("phone-code URL survives reload without implying a code was sent to an unknown number", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch&stage=phone");
  await page
    .getByRole("textbox", { name: "Phone number", exact: true })
    .fill("6502137552");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/stage=phone&verification=code$/);
  await expect(
    page.getByRole("heading", { name: "Confirm it’s you", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Confirm it’s you", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Security code", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Enter your security code to continue.", { exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Add phone number", exact: true }),
  ).toBeVisible();
});

test("review address default, cancel and delete keep one default and restore a usable trigger", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch");
  await page.getByRole("button", { name: /^Ship to/ }).click();
  await page.getByRole("button", { name: /Use a different address/ }).click();
  const editor = page.getByRole("dialog", { name: "Add address", exact: true });
  await editor
    .getByRole("textbox", { name: "Address", exact: true })
    .fill("1226 University Dr, Menlo");
  await editor.locator(".source-address-result").click();
  await editor
    .getByRole("button", { name: "Save address", exact: true })
    .click();
  const addresses = page.locator(".checkout-addresses .address-radio");
  await expect(addresses).toHaveCount(2);
  await page.getByRole("button", { name: /Set .* as default address/ }).click();
  await expect(page.locator(".checkout-addresses .default-pill")).toHaveCount(
    1,
  );
  await expect(
    page.locator(".checkout-addresses .selected .default-pill"),
  ).toBeVisible();
  const options = page.locator(
    ".checkout-addresses .selected .context-trigger",
  );
  await options.click();
  await page.locator(".checkout-context-menu .danger-text").click();
  const confirmation = page.getByRole("dialog", {
    name: "Delete address",
    exact: true,
  });
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(addresses).toHaveCount(2);
  await expect(options).toBeFocused();
  await options.click();
  await page.locator(".checkout-context-menu .danger-text").click();
  await confirmation
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(addresses).toHaveCount(1);
  await expect(page.locator(".checkout-addresses .default-pill")).toHaveCount(
    1,
  );
  await expect(options).toBeFocused();
  await expect(
    page.getByRole("button", { name: /Pay now \$10\.82/ }),
  ).toBeEnabled();
});

test("Home product checkout keeps the selected seller and omits uncaptured merchandising", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/");
  const campaign = page.getByRole("region", {
    name: "PRINCESS POLLY campaign",
    exact: true,
  });
  await campaign
    .getByRole("link", { name: "Sage green top", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products\/home-princess-top$/);
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: "Open cart", exact: true }).click();
  const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(cart.getByText("PRINCESS POLLY", { exact: true })).toBeVisible();
  await cart
    .getByRole("link", { name: "Continue to checkout", exact: true })
    .click();

  await expect(page).toHaveURL(/\/checkout\?store=princess-polly$/);
  await expect(page.locator(".checkout-terms")).toContainText("PRINCESS POLLY");
  for (const label of ["Terms of Service", "Privacy Policy"]) {
    const trigger = page
      .locator(".checkout-terms")
      .getByRole("button", { name: label, exact: true });
    await trigger.click();
    const boundary = page.getByRole("dialog", { name: label, exact: true });
    await expect(boundary).toContainText(
      `PRINCESS POLLY’s ${label} are not included in this reference preview.`,
    );
    await page.goBack();
    await expect(boundary).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await expect(page.locator(".shop-cash-section")).toHaveCount(0);
  await expect(page.locator(".checkout-text-offers")).toHaveCount(0);
  await expect(page.locator(".checkout-recommendations")).toHaveCount(0);
  await expect(page.locator(".checkout-terms")).not.toContainText("Kitsch");

  await page
    .getByRole("button", { name: /^Total 1 item USD \$40\.82/ })
    .click();
  await expect(page.getByText("Sage green top", { exact: true })).toBeVisible();
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 393, height: 793 });
  await page.getByRole("button", { name: /Pay now \$40\.82/ }).click();
  await expect(
    page.getByRole("heading", { name: "Payment service is not connected" }),
  ).toBeVisible();
  await expect(
    page.getByText(/does not have a captured confirmation/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View captured source confirmation" }),
  ).toHaveCount(0);
});

test("captured Kitsch checkout retains its source-specific offers and recommendations", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch");
  await expect(page.locator(".checkout-terms")).toContainText("Kitsch");
  await expect(
    page.getByRole("link", { name: "Terms of Service", exact: true }).last(),
  ).toHaveAttribute("href", "https://www.mykitsch.com/pages/terms-of-service");
  await expect(
    page.getByRole("link", { name: "Privacy Policy", exact: true }).last(),
  ).toHaveAttribute("href", "https://www.mykitsch.com/pages/privacy-policy");
  await expect(page.locator(".shop-cash-section")).toContainText(
    "Get $20.00 off on orders over $50.00",
  );
  await expect(page.locator(".checkout-text-offers")).toContainText(
    "haircare tips",
  );
  await expect(page.locator(".checkout-recommendations")).toContainText(
    "Shea Butter Exfoliating Body Wash",
  );
  await expect(page.locator(".checkout-recommendations")).toContainText(
    "Strengthening Rosemary & Biotin Scalp & Hair Oil",
  );
  await page.getByRole("button", { name: /Pay now \$10\.82/ }).click();
  const boundary = page.getByRole("dialog", {
    name: "Payment service is not connected",
  });
  await expect(boundary).toBeVisible();
  await expect(
    boundary.getByRole("link", { name: "View captured source confirmation" }),
  ).toHaveAttribute("href", "/orders/REF-1001/confirmation");
});

test("expanded review matches the source section boundaries and keeps the address action keyboard accessible", async ({
  page,
}) => {
  await useReferenceScenario(page, "checkout");
  await page.setViewportSize({ width: 393, height: 793 });
  await page.goto("/checkout?store=kitsch");
  for (const name of [/^Ship to/, /^Shipping/, /^Plan/]) {
    await page.getByRole("button", { name }).click();
  }
  const geometry = await page
    .locator(".checkout-section")
    .evaluateAll((sections) =>
      sections.slice(0, 3).map((section) => ({
        top: section.getBoundingClientRect().top,
        cardHeight: section
          .querySelector(".shipping-option,.installment-unavailable")!
          .getBoundingClientRect().height,
      })),
    );
  expect(geometry.map((section) => section.top)).toEqual([125, 304, 531]);
  expect(geometry.map((section) => section.cardHeight)).toEqual([90, 86, 96]);
  const address = page.getByRole("button", {
    name: "Use a different address",
    exact: true,
  });
  await expect(address.locator("svg")).toHaveCount(1);
  await address.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Add address", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(address).toBeFocused();
  await expect(
    page.locator('.checkout-section-toggle[aria-expanded="true"]'),
  ).toHaveCount(3);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(page.locator(".checkout-pay button")).toBeEnabled();
  }
});

test("Checkout typography keeps the bundled Geist face scoped to checkout", async ({
  page,
}) => {
  const fontFamily = async (selector: string) => {
    await page.evaluate(() => document.fonts.ready);
    return page
      .locator(selector)
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily);
  };

  await useReferenceScenario(page, "checkout");
  await page.goto("/checkout?store=kitsch");
  await expect(page.locator(".source-checkout")).toBeVisible();
  expect(await fontFamily(".source-checkout")).toContain("ShopCheckoutGeist");

  for (const route of [
    "/profile",
    "/cart",
    "/orders",
    "/stores/kitsch",
    "/search?q=Jeans",
  ]) {
    await page.goto(route);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.locator(".source-checkout")).toHaveCount(0);
    expect(await fontFamily("main")).not.toContain("ShopCheckoutGeist");
  }

  await useReferenceScenario(page, "onboarding-new");
  await page.goto(
    "/onboarding?step=preferences&journey=new&reference=captured",
  );
  await expect(page.locator(".onboarding-page")).toBeVisible();
  expect(await fontFamily(".onboarding-page")).not.toContain(
    "ShopCheckoutGeist",
  );
});
