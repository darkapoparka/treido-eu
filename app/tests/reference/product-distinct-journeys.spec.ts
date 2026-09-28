import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const title =
  "Midi Shirtdress in Ultrasoft Cotton | Estate Blue/Open Air/White";
const description =
  "This midi-length style features classic details like a button front, cuffed sleeves, and a box pleat at the back. Easy to dress up for work or wear casually on the weekend.";
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
async function openMidi(page: Page) {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/products/midi-shirtdress");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("flow 17's dress retains its own price, promotion, availability and description without borrowing KITSCH media", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await openMidi(page);
  await expect(page.locator(".product-underlay .store-row")).toHaveCount(0);
  await expect(page.locator(".product-gallery")).toHaveCount(0);
  await expect(page.locator(".review-link")).toContainText("2 ratings");
  await expect(page.locator(".product-price")).toHaveText(
    "$118.00 $168.00 30% off",
  );
  await expect(page.getByText("Almost gone.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Arrives as soon as Wed, Jul 29", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".product-deal")).toHaveText(
    "20% off this item in cartApplied at checkout. Ends Aug 4",
  );
  await expect(page.locator(".pdp-description p")).toHaveText(description);
  await expect(page.locator(".variants button")).toHaveText([
    "XXS",
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
  ]);
  await expect(button(page, "XXS")).toHaveAttribute("aria-pressed", "true");
  for (const size of ["M", "L", "XL", "XXL"])
    await expect(button(page, size)).toBeDisabled();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.decode().catch(() => undefined),
      ),
    );
  });
  // Use the existing evidence-artifact path. This is an independent source
  // snapshot, not a claim that a KITSCH link navigates to a clothing product.
  await mkdir(".qa/shop-parity/media-review", { recursive: true });
  await page.screenshot({
    path: ".qa/shop-parity/media-review/f017-005-live.png",
  });
});

test("dress sizes reset quantity and its real cart line retains the selected variant", async ({
  page,
}) => {
  await openMidi(page);
  await button(page, "XS").click();
  await button(page, "Increase quantity").click();
  await expect(page.locator(".quantity output")).toHaveText("2");
  await button(page, "S").click();
  await expect(page.locator(".quantity output")).toHaveText("1");
  await expect(button(page, "Decrease quantity")).toBeDisabled();
  await button(page, "Add to cart").click();
  await expect(button(page, "Added to cart")).toBeVisible();
  await button(page, "Open cart").click();
  const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(cart).toBeVisible();
  await expect(cart.locator(".cart-variant")).toHaveText("S");
  await expect(cart.locator(".cart-subtotal")).toContainText("$118.00");
  await expect(
    cart.getByRole("link", { name: "Continue to checkout" }),
  ).toHaveCount(0);
  await cart.getByRole("button", { name: `Increase ${title}` }).click();
  await expect(cart.locator(".cart-subtotal")).toContainText("$236.00");
  await cart
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  await expect(
    cart.getByRole("heading", { name: "Saved for later" }),
  ).toBeVisible();
  await cart.getByRole("button", { name: "Move to cart", exact: true }).click();
  await expect(cart.locator(".seller-cart .cart-variant")).toHaveText("S");
  await expect(cart.locator(".seller-cart output")).toHaveText("2");
  await page.keyboard.press("Escape");
  await expect(cart).not.toBeVisible();
  await expect(button(page, "Open cart")).toBeFocused();
});

test("saving the distinct dress uses the same collection state and returns to the correct product", async ({
  page,
}) => {
  await openMidi(page);
  await button(page, "Save product").click();
  const picker = page.getByRole("dialog", { name: "Save to collection" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(picker).not.toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  const item = page.locator('.saved-grid [data-product-id="midi-shirtdress"]');
  await expect(item).toBeVisible();
  await expect(item.locator("img")).toHaveCount(0);
  await item.locator('a[href="/products/midi-shirtdress"]').first().click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator(".pdp-description p")).toHaveText(description);
  await expect(button(page, "Save product")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("uncaptured checkout stays an explicit local preview and the dress layout works at sibling widths", async ({
  page,
}) => {
  await openMidi(page);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(button(page, "XXS")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()))
      writes.push(`${request.method()} ${request.url()}`);
  });
  await button(page, "Buy now").click();
  const preview = page.getByRole("dialog", {
    name: "Checkout preview",
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Nothing will be charged");
  await expect(page).toHaveURL(/\/products\/midi-shirtdress$/);
  await preview.getByRole("button", { name: "View cart", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Your cart", exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});
