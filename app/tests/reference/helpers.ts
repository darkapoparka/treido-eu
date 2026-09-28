import { expect, test, type Page } from "@playwright/test";
import type { ReferenceScenarioName } from "../../apps/web/src/features/catalog/reference/scenarios";

export async function useReferenceScenario(
  page: Page,
  name: ReferenceScenarioName,
) {
  const url = test.info().project.use.baseURL;
  if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error("Reference fixtures require a configured local preview");
  await page.context().addCookies([
    {
      name: "shop-reference-scenario",
      value: name,
      url,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

// Preserve flow 20's visible added state before opening its offer. Flow 21's
// ordinary cart follows dismissal; no clicks through a modal or injected state.
export async function addShampooBag(page: Page) {
  await page.goto("/products/shampoo-bag");
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Added to cart", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.pdp-purchase-buttons [data-addition="idle"]'),
  ).toBeVisible();
  const cart = page.getByRole("button", { name: "Open cart", exact: true });
  await cart.click();
  const offer = page.getByRole("dialog", { name: /exclusive offer/ });
  await expect(offer).toBeVisible();
  await offer.getByRole("button", { name: /^Close / }).click();
  await expect(offer).not.toBeVisible();
  await expect(cart).toBeFocused();
}

export async function openBagCart(page: Page) {
  await addShampooBag(page);
  await page.getByRole("button", { name: "Open cart", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Your cart", exact: true }),
  ).toBeVisible();
}
