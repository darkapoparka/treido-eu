import { test, expect, type Locator } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

async function settled(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
}

test("recent shops cart dismisses with focus and scroll return before sibling navigation", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-recent-shops");
  await page.goto("/?feed=recent-stores");
  const trigger = page.getByRole("button", { name: "Open cart", exact: true });
  const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(trigger).toBeVisible();
  await expect(trigger.locator('svg[fill="currentColor"]')).toHaveCount(1);
  await expect(trigger.locator(".dock-cart-count")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 160));
  const scroll = await page.evaluate(() => window.scrollY);
  for (const dismissal of ["close", "escape", "backdrop", "back"] as const) {
    await trigger.click();
    await settled(cart);
    await expect(
      cart.getByRole("heading", { name: "Your cart is empty", exact: true }),
    ).toBeVisible();
    if (dismissal === "close") {
      await cart
        .getByRole("button", { name: "Close cart", exact: true })
        .click();
    } else if (dismissal === "escape") {
      await page.keyboard.press("Escape");
    } else if (dismissal === "backdrop") {
      const bounds = await cart.boundingBox();
      if (!bounds || bounds.y <= 20)
        throw new Error("Cart has no exposed backdrop");
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y - 20);
    } else {
      await page.goBack();
    }
    await expect(cart).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/\/\?feed=recent-stores$/);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .not.toBe("hidden");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
    await expect
      .poll(() => page.evaluate(() => Boolean(window.history.state?.shopSheet)))
      .toBe(false);
  }
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(trigger).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Search", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(trigger).toHaveCount(0);
  await page.goBack();
  await expect(trigger).toBeVisible();
  await expect(cart).not.toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/search$/);
  await expect(trigger).toHaveCount(0);
});

for (const [scenario, route] of [
  ["home-welcome", "/"],
  ["home-recent-products", "/?feed=recent-products"],
  ["returning-home", "/?feed=tracking"],
  ["returning-home", "/?journey=returning"],
] as const) {
  test(`empty cart stays absent from sibling Home history ${route}`, async ({
    page,
  }) => {
    await useReferenceScenario(page, scenario);
    await page.goto(route);
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open cart", exact: true }),
    ).toHaveCount(0);
  });
}

test("sheet padding stays open while a geometric backdrop click closes and restores focus", async ({
  page,
}) => {
  await page.goto("/products/shea-butter");
  const trigger = page.getByRole("button", {
    name: "More options",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "More options",
    exact: true,
  });
  await settled(dialog);
  const bounds = await dialog.boundingBox();
  if (!bounds) throw new Error("Dialog has no bounds");
  await page.mouse.click(bounds.x + 3, bounds.y + bounds.height / 2);
  await expect(dialog).toBeVisible();
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y - 20);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("dragging a sheet header dismisses it without losing the originating route", async ({
  page,
}) => {
  await page.goto("/products/shea-butter");
  const trigger = page.getByRole("button", {
    name: "More options",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "More options",
    exact: true,
  });
  await settled(dialog);
  const header = await dialog.locator(".sheet-header").boundingBox();
  if (!header) throw new Error("Missing drag header");
  await page.mouse.move(header.x + 50, header.y + 12);
  await page.mouse.down();
  await page.mouse.move(header.x + 50, header.y + 132, { steps: 8 });
  await page.mouse.up();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/\/products\/shea-butter$/);
});

test("campaign following and not-interested undo retain the full card", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-pura-options");
  await page.goto("/?feed=pura-options");
  const card = page.getByRole("region", { name: "Pura campaign" });
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await expect
    .poll(() =>
      card.evaluate((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    )
    .toBe(630);
  await card.getByRole("button", { name: "More options for Pura" }).click();
  const dialog = page.getByRole("dialog", { name: "Pura", exact: true });
  await settled(dialog);
  await expect(page.locator(".home-shortcuts")).toBeInViewport();
  await dialog.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await expect(card.locator(".campaign-photo-partial")).toHaveAttribute(
    "src",
    "/api/reference-media/home-pura-photo",
  );
  await expect(card.locator(".campaign-header-photo")).toHaveAttribute(
    "src",
    "/api/reference-media/home-pura-menu-header",
  );
  await expect(card.locator(".campaign-wordmark-image")).toHaveAttribute(
    "src",
    "/api/reference-media/home-pura-menu-wordmark",
  );
  await dialog
    .getByRole("button", { name: "Not interested", exact: true })
    .click();
  await expect(card.locator(".campaign-photo-partial")).toHaveAttribute(
    "src",
    "/api/reference-media/home-pura-reason-photo",
  );
  await expect(card.locator(".campaign-header-photo")).toHaveAttribute(
    "src",
    "/api/reference-media/home-pura-reason-header",
  );
  await expect(card.locator(".campaign-wordmark-image")).toHaveAttribute(
    "src",
    "/api/reference-media/home-pura-reason-wordmark",
  );
  await page
    .getByRole("button", { name: "Want to see less of Pura", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await expect(card.locator(".campaign-hidden-photo")).toHaveAttribute(
    "src",
    "/api/reference-media/home-pura-hidden-photo",
  );
  expect((await card.boundingBox())?.height).toBe(630);
  await card.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "More options for Pura" }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0);
});

test("all five gallery photos are reachable and reduced motion removes sheet entry animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/products/shea-butter");
  await page
    .getByRole("button", { name: "View product image 1", exact: true })
    .click();
  const photos = page.getByRole("dialog", {
    name: "Product photos",
    exact: true,
  });
  await expect(photos.getByRole("button", { name: /Show photo/ })).toHaveCount(
    5,
  );
  await photos
    .getByRole("button", { name: "Show photo 5", exact: true })
    .click();
  await expect(photos.locator(".lightbox-swipe img")).toHaveAttribute(
    "src",
    "/api/reference-media/shea-gallery-shower",
  );
  await page.goBack();
  await page.getByRole("button", { name: "More options", exact: true }).click();
  const options = page.getByRole("dialog", {
    name: "More options",
    exact: true,
  });
  await expect(options).toBeVisible();
  expect(
    await options.evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("Home reflects the actual journey instead of always showing seeded history", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/");
  // Wait for streamed replacement, not merely the first loading surface.
  await expect(page.locator(".home-loading")).toHaveCount(0);
  await expect(page.locator("main.home-page")).toHaveCount(1);
  await expect(page.locator("main.home-page")).toHaveAttribute(
    "data-feed",
    "welcome",
  );
  await expect(page.getByLabel("Recently viewed products")).not.toBeVisible();
  await expect(page.locator(".following-shortcut-icon i")).toHaveCount(0);
  await expect(page.locator(".delivery-card")).not.toBeVisible();
  await expect(page.locator(".home-campaign").first()).toHaveAccessibleName(
    "PRINCESS POLLY campaign",
  );
  await page.goto("/products/cleo");
  await expect(
    page.getByRole("link", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByLabel("Recently viewed products")).toBeVisible();
  await expect(page.locator(".following-shortcut-icon i")).toBeVisible();
});

test("the returning campaign uses six real product cards and preserves saving", async ({
  page,
}) => {
  await useReferenceScenario(page, "returning-home");
  await page.goto("/?journey=returning");
  const campaigns = page.locator(".home-campaigns");
  await expect(campaigns).toHaveAttribute("data-campaign-history", "tracking");
  expect(
    await campaigns
      .locator(":scope > .home-campaign")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-campaign")),
      ),
  ).toEqual(["drmtlgy", "mountain", "tea", "accessories", "kitsch", "carpe"]);
  const campaign = page.getByRole("region", { name: "DRMTLGY campaign" });
  await expect(campaign.locator(".campaign-product")).toHaveCount(6);
  expect(
    await campaign
      .locator(".campaign-product > a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual(
    ["eye", "retinol", "tinted", "bundle", "eye", "masks"].map(
      (product) => `/products/home-drmtlgy-${product}`,
    ),
  );
  const retinol = campaign.getByRole("link", {
    name: "Retinol Body Lotion",
    exact: true,
  });
  await expect(retinol.locator("img")).toHaveAttribute(
    "src",
    "/api/reference-media/home-returning-drmtlgy-retinol",
  );
  await retinol.click();
  await expect(
    page.getByRole("heading", { name: "Retinol Body Lotion", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(retinol).toBeFocused();
  const accessories = page.getByRole("region", {
    name: "Accessories campaign",
  });
  const accessoryHearts = accessories.locator(
    '[data-campaign-source-save="accessory"]',
  );
  await expect(accessoryHearts).toHaveCount(2);
  await expect(accessoryHearts.locator("svg")).toHaveCount(2);
  await expect(accessories.locator(".campaign-accessory-dark")).toHaveCount(1);
  await expect(accessories.getByRole("button")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveCount(3);
  await expect
    .poll(() =>
      campaign
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  const save = campaign.locator(".save-button").first();
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(campaign.locator(".save-button").nth(4)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const email = page.locator(".email-card");
    const cardBounds = await email.boundingBox();
    const textBounds = await email.locator("strong").boundingBox();
    const arrowBounds = await email.locator("svg").boundingBox();
    expect(cardBounds).not.toBeNull();
    expect(textBounds).not.toBeNull();
    expect(arrowBounds).not.toBeNull();
    expect(textBounds!.x + textBounds!.width).toBeLessThanOrEqual(
      arrowBounds!.x,
    );
    expect(arrowBounds!.x + arrowBounds!.width).toBeLessThanOrEqual(
      cardBounds!.x + cardBounds!.width,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("the captured Pura context preserves its continuation, actual hide/Undo and an empty Cart", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-pura-options");
  await page.goto("/?feed=pura-options");
  const campaigns = page.locator(".home-campaigns > .home-campaign");
  await expect(campaigns).toHaveCount(2);
  await expect(campaigns.nth(0)).toHaveAccessibleName("Pura campaign");
  await expect(campaigns.nth(1)).toHaveAccessibleName("DRMTLGY campaign");
  await expect(
    page.getByRole("region", { name: "Carpe campaign", exact: true }),
  ).toHaveCount(0);
  const trigger = page.getByRole("button", {
    name: "More options for Pura",
    exact: true,
  });
  await trigger.click();
  const options = page.getByRole("dialog", { name: "Pura", exact: true });
  await options
    .getByRole("button", { name: "Close shop options", exact: true })
    .click();
  await expect(options).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await options
    .getByRole("button", { name: "Not interested", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Want to see less of Pura", exact: true })
    .click();
  const undo = campaigns
    .nth(0)
    .getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeVisible();
  await expect(campaigns.nth(0).locator(".campaign-art")).toHaveAttribute(
    "inert",
    "",
  );
  await page.getByRole("button", { name: "Open cart", exact: true }).click();
  const cart = page.getByRole("dialog", { name: "Your cart", exact: true });
  await expect(
    cart.getByRole("heading", { name: "Your cart is empty", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(cart).not.toBeVisible();
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(
    campaigns
      .nth(0)
      .getByRole("button", { name: "More options for Pura", exact: true }),
  ).toBeVisible();
  await expect(campaigns.nth(1)).toHaveAccessibleName("DRMTLGY campaign");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("the shared Kitsch continuation is a bounded Carpe header in the welcome history", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/");
  const campaigns = page.locator(".home-campaigns > .home-campaign");
  await expect(campaigns).toHaveCount(7);
  expect(
    await campaigns.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-campaign")),
    ),
  ).toEqual([
    "princess",
    "drmtlgy",
    "mountain",
    "tea",
    "accessories",
    "kitsch",
    "carpe",
  ]);
  await expect(
    page.getByRole("region", { name: "Pura campaign", exact: true }),
  ).toHaveCount(0);

  const carpe = page.locator(".campaign-kitsch + .campaign-carpe");
  await expect(carpe).toHaveAccessibleName("Carpe campaign");
  await expect(carpe).toHaveClass(/campaign-continuation/);
  expect(
    await carpe.evaluate((element) =>
      Math.round(element.getBoundingClientRect().height),
    ),
  ).toBe(96);
  await expect(carpe.locator(".campaign-brand")).toHaveAttribute(
    "href",
    "/stores/carpe",
  );
  await expect(carpe.locator(".campaign-brand img")).toHaveAttribute(
    "src",
    "/api/reference-media/home-carpe-wordmark",
  );
  await expect(
    carpe.locator(".campaign-product, .campaign-rating, .campaign-price"),
  ).toHaveCount(0);

  const trigger = carpe.getByRole("button", {
    name: "More options for Carpe",
    exact: true,
  });
  await trigger.click();
  const options = page.getByRole("dialog", { name: "Carpe", exact: true });
  await options.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    options.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await options
    .getByRole("button", { name: "Close shop options", exact: true })
    .click();
  await expect(options).not.toBeVisible();
  await expect(trigger).toBeFocused();

  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
