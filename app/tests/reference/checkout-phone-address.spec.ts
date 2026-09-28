import { expect, test } from "@playwright/test";

import { useReferenceScenario } from "./helpers";

for (const entry of ["manual", "suggested"] as const) {
  test(`phone continuation preserves one country code through ${entry} address entry and history`, async ({
    page,
  }) => {
    await useReferenceScenario(
      page,
      entry === "manual" ? "onboarding-new" : "profile-before-payment",
    );
    await page.goto("/products/shampoo-bag");
    if (entry === "manual") {
      await page.getByRole("button", { name: "Buy now", exact: true }).click();
    } else {
      await page
        .getByRole("button", { name: "Add to cart", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Added to cart", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator('.pdp-purchase-buttons [data-addition="idle"]'),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Open cart", exact: true })
        .click();
      const offer = page.getByRole("dialog", { name: /exclusive offer/ });
      await expect(offer).toBeVisible();
      await offer
        .getByRole("link", { name: "Continue to checkout", exact: true })
        .click();
    }
    await expect(page).toHaveURL(/\/checkout\?store=kitsch&stage=phone$/);
    await expect(
      page.getByRole("heading", { name: "Add phone number", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Review & Pay", exact: true }),
    ).not.toBeVisible();
    const phoneDraft = entry === "manual" ? "(650) 213-7552" : "6502137552";
    await page
      .getByRole("textbox", { name: "Phone number", exact: true })
      .fill(phoneDraft);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Security code", exact: true })
      .fill("123456");
    const boundary = page.getByRole("dialog", {
      name: "Phone verification is not connected",
      exact: true,
    });
    await expect(boundary).toContainText("this number has not been verified");
    await boundary
      .getByRole("button", {
        name: "Continue to captured shipping address",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/stage=address-search$/);
    const search = page.getByRole("textbox", {
      name: "Search address",
      exact: true,
    });
    if (entry === "manual") {
      await search.focus();
      await page
        .getByRole("button", { name: "Enter address manually", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Address", exact: true })
        .fill("1226 University Dr");
      await page
        .getByRole("textbox", { name: "City", exact: true })
        .fill("Menlo Park");
      await page
        .getByRole("combobox", { name: "State", exact: true })
        .selectOption("CA");
      await page
        .getByRole("textbox", { name: "ZIP code", exact: true })
        .fill("94025");
    } else {
      await search.fill("1226 University Dr, Menlo");
      await page.getByRole("button", { name: /^1226 University Dr/ }).click();
    }
    await expect(page).toHaveURL(/stage=address$/);
    const addressPhone = page.getByRole("textbox", {
      name: "Phone (optional)",
      exact: true,
    });
    await expect(addressPhone).toHaveValue("+16502137552");
    await page
      .getByRole("textbox", { name: "First name", exact: true })
      .fill("Alex");
    await page
      .getByRole("textbox", { name: "Last name", exact: true })
      .fill("Smith");
    const savedPhone = entry === "manual" ? "+44 20 7946 0100" : "+16502137552";
    if (entry === "manual") await addressPhone.fill(savedPhone);
    await page
      .getByRole("button", { name: "Continue to payment details", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Add a card", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/stage=address$/);
    await expect(addressPhone).toHaveValue(savedPhone);
    await page.goBack();
    await expect(page).toHaveURL(/stage=address-search$/);
    await page.goBack();
    await expect(page).toHaveURL(/stage=phone&verification=code$/);
    await page.goBack();
    await expect(page).toHaveURL(/stage=phone$/);
    await expect(
      page.getByRole("textbox", { name: "Phone number", exact: true }),
    ).toHaveValue(phoneDraft);
  });
}
