import { expect, test, type Page } from "@playwright/test";

async function openScenario(
  page: Page,
  baseURL: string | undefined,
  scenario: string,
  path = "/saved",
) {
  if (!baseURL)
    throw new Error("Reference tests require the configured preview URL");
  await page.context().addCookies([
    {
      name: "shop-reference-scenario",
      value: scenario,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute(
    "data-reference-scenario",
    scenario,
  );
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
}
const card = (page: Page, id: string) =>
  page.locator(`.saved-grid [data-product-id="${id}"]`);
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
async function openCollection(page: Page) {
  await button(page, "Private Favs").click();
  await expect(
    page.getByRole("heading", { name: "Favs", exact: true }),
  ).toBeVisible();
}

test("Saved renders the captured multi-brand library, price, variant and promotion", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-library");
  await expect(page.locator(".saved-grid > article")).toHaveCount(6);
  await expect(card(page, "rhode-glazing-milk")).toContainText("$32.00");
  await expect(card(page, "rhode-glazing-milk")).toContainText("big (4.2 oz)");
  await expect(card(page, "home-drmtlgy-eye")).toContainText("Save $30");
  await expect(card(page, "home-drmtlgy-eye")).toContainText("$44.00");
  await expect(
    card(page, "rhode-pink-captured").locator(":scope > b"),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator("main img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const tile = await page.locator(".collection-tile").boundingBox();
    expect(tile?.height).toBe(200);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("an obscured Saved listing never receives an invented price or purchase action", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-library");
  const trigger = button(page, "View captured Pink rhode tube");
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Captured item details",
    exact: true,
  });
  await expect(dialog).toContainText(
    "listing name, price and lower photograph are obscured",
  );
  await expect(
    dialog.getByRole("button", { name: /buy|pay|checkout/i }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Back to Saved", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await button(page, "Unsave Pink rhode tube").click();
  await expect(card(page, "rhode-pink-captured")).toHaveCount(0);
});

test("collection creation rejects whitespace and creates exactly one collection", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-pair");
  await button(page, "Create collection").click();
  const name = page.getByRole("textbox", {
    name: "Collection name",
    exact: true,
  });
  await expect(name).toBeFocused();
  await expect(button(page, "Save")).toBeDisabled();
  await name.fill("   ");
  await expect(button(page, "Save")).toBeDisabled();
  await name.fill("  Favs  ");
  await button(page, "Save").click();
  await button(page, "Add Shea Butter Exfoliating Body Wash").click();
  await button(page, "Add Rice Water Shampoo & Conditioner Combo").click();
  await button(page, "Done").click();
  await expect(
    page.getByRole("heading", { name: "Favs", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".saved-grid > article")).toHaveCount(2);
  await button(page, "Go back").click();
  await expect(page.locator(".collection-tile")).toHaveCount(1);
  await expect(button(page, "Private Favs")).toBeVisible();
});

test("every More ideas card selects a real item, including Jojoba at the captured price", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-collection");
  await openCollection(page);
  await button(page, "Find more ideas").click();
  await expect(page.locator(".saved-grid > article")).toHaveCount(6);
  const ids = [
    "idea-rice-wash",
    "idea-rosemary-bar",
    "idea-rosemary-bundle",
    "idea-purple-bundle",
    "idea-rosemary-liquid",
    "idea-jojoba",
  ];
  for (const id of ids) {
    const control = card(page, id).locator(".save-button");
    await expect(control).toHaveAttribute("aria-pressed", "false");
    await control.click();
    await expect(control).toHaveAttribute("aria-pressed", "true");
  }
  await expect(card(page, "idea-jojoba")).toContainText("$14.00");
  await button(page, "Done").click();
  await expect(page.locator(".saved-grid > article")).toHaveCount(8);
  await button(page, "Go back").click();
  await expect(
    page.getByRole("heading", { name: "Saved", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".saved-grid > article")).toHaveCount(8);
  await card(page, "idea-jojoba").locator(".saved-item-title").click();
  await expect(page).toHaveURL(/\/products\/idea-jojoba$/);
  await expect(
    page.getByRole("heading", {
      name: "Jojoba Bead Exfoliating Body Wash Bar",
      exact: true,
    }),
  ).toBeVisible();
});

test("removing a recommendation from a collection does not unsave the product", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-collection");
  await openCollection(page);
  await button(page, "Find more ideas").click();
  await card(page, "idea-jojoba").locator(".save-button").click();
  await card(page, "idea-jojoba").locator(".save-button").click();
  await button(page, "Done").click();
  await expect(card(page, "idea-jojoba")).toHaveCount(0);
  await button(page, "Go back").click();
  await expect(card(page, "idea-jojoba")).toBeVisible();
});

test("collaboration dismissal survives a real product navigation and return", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-collection");
  await openCollection(page);
  await button(page, "Dismiss collaboration suggestion").click();
  await expect(page.locator(".collection-invite-callout")).toHaveCount(0);
  await card(page, "rice-bundle").locator(".saved-item-title").click();
  await expect(page).toHaveURL(/\/products\/rice-bundle$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/saved\?collection=source-favs$/);
  await expect(page.locator(".collection-invite-callout")).toHaveCount(0);
  await expect(button(page, "Invite collaborators")).toBeVisible();
});

test("More ideas Back, Forward and Done preserve collection scroll and focus", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-collection");
  await openCollection(page);
  const ideas = button(page, "Find more ideas");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.querySelectorAll<HTMLImageElement>("main img")).map(
        (image) => image.decode(),
      ),
    );
  });
  // scrollIntoViewIfNeeded alone considers the target visible under the fixed
  // dock. Put the actual click point in view BEFORE measuring return scroll.
  await ideas.evaluate((element) =>
    element.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "instant",
    }),
  );
  await ideas.click({ trial: true });
  await expect
    .poll(() =>
      ideas.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return hit !== null && element.contains(hit);
      }),
    )
    .toBe(true);
  const scroll = await page.evaluate(() => scrollY);
  expect(scroll).toBeGreaterThan(0);
  await ideas.click();
  await expect(
    page.getByRole("heading", { name: "More ideas", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/saved\?collection=source-favs$/);
  await expect(ideas).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "More ideas", exact: true }),
  ).toBeVisible();
  await button(page, "Done").click();
  await expect(page).toHaveURL(/\/saved\?collection=source-favs$/);
  await expect(ideas).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
  await page.goBack();
  await expect(page).toHaveURL(/\/saved$/);
});

test("public and private states match the captured controls without publishing or sending invitations", async ({
  page,
  baseURL,
}) => {
  await openScenario(
    page,
    baseURL,
    "saved-collection-edited",
    "/saved?collection=source-favs",
  );
  await button(page, "Collection options").click();
  await button(page, "Make collection public").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "Your collection will be discoverable by others and may appear on the feed.",
  );
  await expect(button(page, "Make public")).toHaveAttribute(
    "aria-describedby",
    "collection-public-boundary",
  );
  await button(page, "Cancel").click();
  await expect(button(page, "Share collection")).toHaveCount(0);
  await button(page, "Collection options").click();
  await button(page, "Make collection public").click();
  await button(page, "Make public").click();
  await expect(page.getByRole("status")).toHaveText("Collection is now public");
  await button(page, "Share collection").click();
  await expect(page.getByRole("dialog")).toContainText(
    "no public link is available",
  );
  await page.keyboard.press("Escape");
  await button(page, "Invite collaborators").click();
  await expect(page.getByRole("dialog")).toContainText(
    "no invitation can be sent",
  );
  await page.keyboard.press("Escape");
  await button(page, "Collection options").click();
  await button(page, "Make collection private").click();
  await expect(page.getByRole("status")).toHaveText(
    "Collection is now private",
  );
  await expect(button(page, "Share collection")).toHaveCount(0);
});

test("editing Cancel preserves the name and a later Save commits the emoji name", async ({
  page,
  baseURL,
}) => {
  await openScenario(
    page,
    baseURL,
    "saved-collection-expanded",
    "/saved?collection=source-favs",
  );
  await button(page, "Collection options").click();
  await button(page, "Edit name").click();
  const name = page.getByRole("textbox", {
    name: "Collection name",
    exact: true,
  });
  await name.fill("Discard this draft");
  await button(page, "Cancel").click();
  await expect(
    page.getByRole("heading", { name: "Favs", exact: true }),
  ).toBeVisible();
  await button(page, "Collection options").click();
  await button(page, "Edit name").click();
  await expect(name).toHaveValue("Favs");
  await name.fill("Favs💕");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 486 });
    await expect(name).toBeVisible();
    await expect(button(page, "Save")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 393, height: 793 });
  await button(page, "Save").click();
  await expect(
    page.getByRole("heading", { name: "Favs💕", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".saved-grid > article")).toHaveCount(3);
});

test("expanded collection deletion retains all saved products, not only the final capture's pair", async ({
  page,
  baseURL,
}) => {
  await openScenario(page, baseURL, "saved-collection-expanded");
  await openCollection(page);
  await button(page, "Collection options").click();
  await button(page, "Delete collection").click();
  await button(page, "Cancel").click();
  await expect(page.locator(".saved-grid > article")).toHaveCount(3);
  await button(page, "Collection options").click();
  await button(page, "Delete collection").click();
  await button(page, "Delete").click();
  await expect(
    page.getByRole("heading", { name: "Saved", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".collection-tile")).toHaveCount(0);
  await expect(page.locator(".saved-grid > article")).toHaveCount(3);
  for (const id of ["argan-liquid-combo", "rice-bundle", "shea-butter"]) {
    await expect(card(page, id)).toBeVisible();
  }
});

for (const width of [320, 393, 430]) {
  test(`deleting a local collection returns to Saved without a route request at ${width}px`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 793 });
    await openScenario(
      page,
      baseURL,
      "saved-collection",
      "/saved?collection=source-favs",
    );
    await expect(page.locator(".saved-grid > article")).toHaveCount(2);
    await button(page, "Collection options").click();
    await button(page, "Delete collection").click();
    // Collection membership and this same-page URL are local state. A slow or
    // unavailable server must not expose the deleted-collection error screen.
    await page.context().setOffline(true);
    try {
      await button(page, "Delete").click();
      await expect(page.locator(".saved-grid > article")).toHaveCount(2);
      await expect(page).toHaveURL(/\/saved$/);
      await expect(page.locator(".empty-state")).toHaveCount(0);
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(button(page, "Create collection")).toBeVisible();
      await expect(page.locator(".collection-tile")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      await page.context().setOffline(false);
    }
    await page.reload();
    await expect(page.locator(".saved-grid > article")).toHaveCount(2);
    await expect(page.locator(".collection-tile")).toHaveCount(0);
  });
}
