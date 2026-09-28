import { expect, test } from "@playwright/test";

import { addShampooBag, useReferenceScenario } from "./helpers";

test("flows 21-23 preserve captured cart, remove, and save-later states", async ({
  page,
}) => {
  await addShampooBag(page);
  await page.getByRole("button", { name: "Open cart" }).click();
  const cart = page.getByRole("dialog", { name: "Your cart" });
  await expect(cart).toContainText("spring20orderdiscountold");
  await expect(cart).toContainText("Discount applied");
  await expect(cart).toContainText("$3.65");
  await cart.getByRole("button", { name: "Save for later" }).click();
  await expect(
    cart.getByRole("heading", { name: "Your cart is empty" }),
  ).toBeVisible();
  await expect(
    cart.getByRole("heading", { name: "Saved for later" }),
  ).toBeVisible();
  await expect(
    cart.getByRole("button", { name: "Move to cart" }),
  ).toBeEnabled();
});

test("flow 23 captured unavailable variant stays saved and cannot move to cart", async ({
  page,
}) => {
  await useReferenceScenario(page, "cart-later");
  await page.goto("/cart");
  await expect(
    page.getByRole("heading", { name: "Your cart is empty" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Saved for later" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Move to cart" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Remove saved Shampoo Bar Bag" })
    .click();
  await expect(page.locator(".cart-later")).toHaveCount(0);
});
test("flow 21 checkout stops at payment boundary before captured confirmation", async ({
  page,
}) => {
  await addShampooBag(page);
  await page.getByRole("button", { name: "Open cart" }).click();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout\?store=kitsch/);
  await expect(
    page.getByRole("heading", { name: "Review & Pay" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Ship to/ })).toContainText(
    "Alex Smith",
  );
  await expect(page.getByRole("button", { name: /^Payment/ })).toContainText(
    "Visa ···· 4263",
  );
  await page.getByRole("button", { name: /^Plan/ }).click();
  await expect(
    page.getByText("Installments unavailable", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Total/ }).click();
  await expect(
    page.getByText("TOTAL SAVINGS $1.35", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Pay now \$10\.82/ }).click();
  await expect(page.locator("main[aria-busy='true']")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Payment service is not connected" }),
  ).toBeVisible();
  await expect(
    page.getByText("No card was charged and no order was created."),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View captured source confirmation" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Order confirmed" }),
  ).toBeVisible();
  await expect(
    page.getByText("Order No. #12748251", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View order receipt" }).click();
  await expect(page.getByRole("heading", { name: "Receipt" })).toBeVisible();
  await expect(
    page.getByText("Order #12748251", { exact: true }),
  ).toBeVisible();
});
