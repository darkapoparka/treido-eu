import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

async function prepare(page: Page, path: string) {
  await useReferenceScenario(page, "cart-bag");
  await page.goto(path);
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
}

async function pause(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 60_000)),
  );
}

async function capturedReview(page: Page) {
  await prepare(page, "/checkout?store=kitsch&stage=payment-setup");
  await page
    .getByRole("textbox", { name: "Card number", exact: true })
    .fill("4242424242424242");
  await page.getByRole("textbox", { name: "Expiry (MM/YY)" }).fill("12/30");
  await page.getByRole("textbox", { name: "CVV", exact: true }).fill("123");
  await page.getByRole("textbox", { name: "Name on card" }).fill("Alex Smith");
  await page
    .getByRole("button", { name: "Continue to review", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Payment service is not connected" }),
  ).toBeVisible();
  await pause(page);
  await page
    .getByRole("button", { name: "Continue with saved payment method" })
    .click();
  await page.clock.runFor(1);
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
}

test("payment processing hides the captured close control at mobile widths", async ({
  page,
}) => {
  await prepare(page, "/checkout?store=kitsch");
  const pay = page.getByRole("button", { name: /Pay now \$10\.82/ });
  const close = page.getByRole("link", { name: "Close checkout", exact: true });
  await expect(pay).toBeEnabled();
  await expect(close).toBeVisible();

  await pause(page);
  await pay.click();
  await page.clock.fastForward(800);
  await expect(page.locator("main.source-checkout")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.locator(".processing-label")).toHaveAttribute(
    "data-processing-caption",
    "true",
  );

  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(close).toBeHidden();
  }

  await page.clock.fastForward(400);
  await expect(
    page.getByRole("dialog", { name: "Payment service is not connected" }),
  ).toBeVisible();
  await expect(close).toBeVisible();
});

test("captured review resolves its rows and shelves before enabling payment", async ({
  page,
}) => {
  await capturedReview(page);
  const root = page.locator("main.source-checkout");
  const pay = page.locator(".checkout-pay > button.primary");
  await expect(root).toHaveAttribute("data-review-stage", "1");
  await expect(
    page.getByRole("status", { name: "Loading captured checkout" }),
  ).toBeVisible();
  await expect(pay).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: "Close checkout" }),
  ).toBeVisible();
  await capture(page, "review-loader");
  await page.clock.fastForward(1000);
  await expect(root).toHaveAttribute("data-review-stage", "2");
  await expect(page.locator(".checkout-identity")).toBeVisible();
  await expect(page.locator(".payment-summary-value")).not.toBeVisible();
  await expect(page.locator(".shop-cash-section")).not.toBeVisible();
  await capture(page, "review-partial");
  await page.clock.fastForward(750);
  await expect(root).toHaveAttribute("data-review-stage", "3");
  await expect(page.locator(".payment-summary-value")).toBeVisible();
  await expect(pay).toBeVisible();
  await expect(pay).toBeDisabled();
  await expect(pay).toContainText("$3.65");
  await capture(page, "review-shipping-skeleton");
  await page.clock.fastForward(500);
  await expect(root).toHaveAttribute("data-review-stage", "4");
  await expect(page.locator(".shop-cash-section")).toBeVisible();
  await expect(page.locator(".checkout-text-offers")).not.toBeVisible();
  await expect(pay).toContainText("$10.47");
  await capture(page, "review-shipping-resolved");
  await page.clock.fastForward(750);
  await expect(root).toHaveAttribute("data-review-stage", "5");
  await expect(page.locator(".checkout-text-offers")).toBeVisible();
  await expect(pay).toBeDisabled();
  await page.clock.fastForward(500);
  await expect(root).toHaveAttribute("data-review-stage", "0");
  await expect(pay).toBeEnabled();
  await expect(pay).toContainText("$10.82");
});

test("leaving a captured review cancels its timers and direct review is settled", async ({
  page,
}) => {
  await capturedReview(page);
  await page.goBack();
  await page.clock.runFor(1);
  await expect(page.getByRole("heading", { name: "Add a card" })).toBeVisible();
  await page.clock.fastForward(5000);
  await page.goForward();
  await page.clock.runFor(1);
  await expect(page.locator("main.source-checkout")).toHaveAttribute(
    "data-review-stage",
    "0",
  );
  await page.reload();
  await expect(page.locator(".checkout-pay > button.primary")).toBeEnabled();
});

test("explicit confirmation loads once, resolves details before shelves, and reload settles", async ({
  page,
}) => {
  await prepare(page, "/checkout?store=kitsch");
  await page.getByRole("button", { name: /Pay now \$10\.82/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Payment service is not connected" }),
  ).toBeVisible();
  await pause(page);
  await page
    .getByRole("link", { name: "View captured source confirmation" })
    .click();
  await page.clock.runFor(1);
  const heading = page.locator(".confirmation-heading");
  await expect(heading).toHaveAttribute("data-confirmation-stage", "1");
  await expect(
    page.getByRole("heading", { name: "Order confirmed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Close confirmation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View order receipt" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Order No. #12748251", { exact: true }),
  ).toHaveCount(0);
  await capture(page, "confirmation-skeleton");
  await page.clock.fastForward(2000);
  await expect(heading).toHaveAttribute("data-confirmation-stage", "2");
  await expect(
    page.getByRole("link", { name: "View order receipt" }),
  ).toBeVisible();
  await expect(
    page.getByText("Order No. #12748251", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".confirmation-shelves-skeleton")).toBeVisible();
  await capture(page, "confirmation-details");
  await page.clock.fastForward(250);
  await expect(heading).toHaveAttribute("data-confirmation-stage", "0");
  await expect(
    page.locator(".order-confirmation-page > .product-rail"),
  ).toBeVisible();
  await page.getByRole("link", { name: "View order receipt" }).click();
  await expect(
    page.getByRole("heading", { name: "Receipt", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await page.clock.runFor(1);
  await expect(heading).toHaveAttribute("data-confirmation-stage", "0");
  await page.reload();
  await expect(heading).toHaveAttribute("data-confirmation-stage", "0");
});
