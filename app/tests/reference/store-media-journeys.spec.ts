import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

async function openChemical(page: Page) {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/stores/chemical-guys");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await expect(
    page.getByRole("heading", { name: "For you", exact: true }),
  ).toBeVisible();
}

test("the recorded Chemical clip opens its actual product and retains the unavailable playback boundary", async ({
  page,
}) => {
  await openChemical(page);
  await page
    .getByRole("link", { name: "Open Tire and Trim video", exact: true })
    .click();
  await expect(page).toHaveURL(/\/stores\/chemical-guys\/video$/);
  const playback = page.getByRole("button", {
    name: "Video playback unavailable",
    exact: true,
  });
  await playback.click();
  await expect(
    page.getByRole("dialog", { name: "Video preview", exact: true }),
  ).toContainText("matching motion and audio asset is not available");
  await page.keyboard.press("Escape");
  await expect(playback).toBeFocused();
  await page
    .locator('.video-bottom a[href="/products/order-tire-trim"]')
    .click();
  await expect(page).toHaveURL(/\/products\/order-tire-trim$/);
  await expect(
    page.getByRole("heading", {
      name: "Tire+Trim Gel Plastic and Rubber High-Glo…",
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/stores\/chemical-guys\/video$/);
  await page.getByRole("link", { name: "Close video", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/chemical-guys$/);
});

test("unknown Chemical clips and the partial product do not borrow unrelated playable or purchasable state", async ({
  page,
}) => {
  await openChemical(page);
  await expect(page.locator(".store-video-rail > :is(a, button)")).toHaveCount(
    4,
  );
  await expect(
    page.locator(
      '.store-video-rail img[src="/api/reference-media/chemical-store-clip-four-partial"]',
    ),
  ).toHaveCount(1);
  for (const name of [
    "Open Chemical Guys clip 2",
    "Open Chemical Guys clip 4",
    "Open Chemical Guys featured video 1",
  ]) {
    const trigger = page.getByRole("button", { name, exact: true });
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Video preview", exact: true }),
    ).toContainText("full video and audio are unavailable");
    await expect(page).toHaveURL(/\/stores\/chemical-guys$/);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  await page
    .locator('.store-recommendations a[href="/products/chemical-deep-partial"]')
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Deep Clea…", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeDisabled();
});

test("Chemical Featured keeps the captured thumbnail fragments anchored to their cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await openChemical(page);
  const featured = page.locator("section.store-recommendations").filter({
    has: page.getByRole("heading", { name: "Featured", exact: true }),
  });
  await expect(featured).toBeVisible();
  await expect(featured.locator(".product-rail > button")).toHaveCount(3);

  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const geometry = await featured.evaluate((section) =>
      [
        ...section.querySelectorAll<HTMLButtonElement>(
          ".product-rail > button",
        ),
      ].map((button) => {
        const image = button.querySelector<HTMLImageElement>("img");
        if (!image) throw new Error("Featured source fragment is missing");
        const buttonRect = button.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        return {
          buttonWidth: buttonRect.width,
          buttonHeight: buttonRect.height,
          imageLeftOffset: imageRect.left - buttonRect.left,
          imageTopOffset: imageRect.top - buttonRect.top,
          imageWidth: imageRect.width,
          imageHeight: imageRect.height,
        };
      }),
    );
    expect(geometry).toEqual([
      {
        buttonWidth: 135,
        buttonHeight: 160,
        imageLeftOffset: 3,
        imageTopOffset: 3,
        imageWidth: 129,
        imageHeight: 52,
      },
      {
        buttonWidth: 135,
        buttonHeight: 160,
        imageLeftOffset: 3,
        imageTopOffset: 3,
        imageWidth: 129,
        imageHeight: 52,
      },
      {
        buttonWidth: 135,
        buttonHeight: 160,
        imageLeftOffset: 3,
        imageTopOffset: 3,
        imageWidth: 55,
        imageHeight: 142,
      },
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("short honest store sale results retain the filter trigger viewport position", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await useReferenceScenario(page, "following-pair");
  await page.goto("/stores/kitsch");
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.locator("main img").evaluateAll(async (images) => {
    await document.fonts.ready;
    await Promise.all(
      images.map((image) => (image as HTMLImageElement).decode()),
    );
  });
  const heading = page.locator(".store-grid-heading");
  await heading.evaluate((element) =>
    window.scrollTo({
      top: element.getBoundingClientRect().top + scrollY - 79,
      behavior: "instant",
    }),
  );
  const trigger = page.getByRole("button", {
    name: "Filter store products",
    exact: true,
  });
  await trigger.click();
  const filter = page.getByRole("dialog", { name: "Filter", exact: true });
  await filter.getByRole("button", { name: "On sale", exact: true }).click();
  await filter.getByRole("button", { name: "Done", exact: true }).click();
  await expect(filter).not.toBeVisible();
  await expect(page.locator("#all-products .product-card")).toHaveCount(1);
  await expect(page.locator("#all-products .product-card")).toContainText(
    "Summer Mystery Box",
  );
  await expect(trigger).toBeFocused();
  await expect
    .poll(() =>
      heading.evaluate((element) =>
        Math.round(element.getBoundingClientRect().top),
      ),
    )
    .toBe(79);
});
