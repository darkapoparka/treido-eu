import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("standalone Jeans preserves its draft and exact product/conversation return controls", async ({
  page,
}) => {
  await useReferenceScenario(page, "search-recent");
  await page.goto("/search");
  const entry = page.getByRole("link", {
    name: "Continue Finding the right pair of jeans",
    exact: true,
  });
  await entry.click();
  const draft = page.getByRole("textbox", {
    name: "Ask a follow-up",
    exact: true,
  });
  await draft.fill("Prefer a relaxed fit");
  const product = page
    .locator(
      '.assistant-product-rail a[href="/products/assistant-signature-straight"]',
    )
    .first();
  await product.click();
  await expect(page).toHaveURL(/\/products\/assistant-signature-straight$/);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(product).toBeFocused();
  await expect(draft).toHaveValue("Prefer a relaxed fit");
  await page.reload();
  await expect(draft).toHaveValue("Prefer a relaxed fit");
  // Reload has no document-local return token; native Back still retains the
  // actual Search entry, while fresh visits must not inherit this draft.
  await page.goBack();
  await expect(page).toHaveURL(/\/search$/);
  await entry.click();
  await expect(draft).toBeEmpty();
  await draft.fill("A second question");
  await page
    .getByRole("link", { name: "Close assistant", exact: true })
    .click();
  await expect(entry).toBeFocused();
  await page.goForward();
  await expect(draft).toHaveValue("A second question");
});

test("embedded Jeans owns its draft separately and consumed product navigation returns to View answer", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=jeans");
  const search = page.getByRole("textbox", {
    name: "Search products",
    exact: true,
  });
  const trigger = page.getByRole("button", {
    name: "View answer for Jeans",
    exact: true,
  });
  await trigger.click();
  const answer = page.getByRole("dialog", {
    name: "Jeans answer",
    exact: true,
  });
  const draft = answer.getByRole("textbox", {
    name: "Ask a follow-up",
    exact: true,
  });
  await draft.fill("Keep this answer draft");
  await page.reload();
  await expect(draft).toHaveValue("Keep this answer draft");
  await answer
    .locator(
      '.assistant-product-rail a[href="/products/assistant-signature-straight"]',
    )
    .first()
    .click();
  await expect(page).toHaveURL(/\/products\/assistant-signature-straight$/);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=jeans$/);
  await expect(search).toHaveValue("jeans");
  await expect(answer).not.toBeVisible();
  // The in-memory source-return token cannot survive reload, but the draft
  // owner was serialized in the answer and is restored to its parent entry.
  await trigger.click();
  await expect(draft).toHaveValue("Keep this answer draft");
  await answer
    .locator(
      '.assistant-product-rail a[href="/products/assistant-signature-straight"]',
    )
    .first()
    .click();
  await expect(page).toHaveURL(/\/products\/assistant-signature-straight$/);
  await page.goBack();
  await expect(trigger).toBeFocused();
  await page.reload();
  await trigger.click();
  await expect(draft).toHaveValue("Keep this answer draft");
  await answer
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await expect(trigger).toBeFocused();
  await page.goForward();
  await expect(draft).toHaveValue("Keep this answer draft");
  await page.goto("/assistant?example=photo");
  await expect(
    page.getByRole("textbox", { name: "Ask a follow-up", exact: true }),
  ).toBeEmpty();
  await page.goto("/search?q=jeans");
  await trigger.click();
  await expect(draft).toBeEmpty();
});

test("reloaded embedded answer Close consumes exactly its owned entry", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/minis/gift?gift=results");
  await page.goto("/search?q=jeans");
  const trigger = page.getByRole("button", {
    name: "View answer for Jeans",
    exact: true,
  });
  await trigger.click();
  const answer = page.getByRole("dialog", {
    name: "Jeans answer",
    exact: true,
  });
  await answer
    .getByRole("textbox", { name: "Ask a follow-up", exact: true })
    .fill("Keep after reload Close");
  await page.reload();
  await answer
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search\?q=jeans$/);
  await expect(trigger).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/minis\/gift\?gift=results$/);
  await expect(page.locator('[data-gift-phase="results"]')).toBeVisible();
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.goForward();
  await expect(page).toHaveURL(/\/search\?q=jeans$/);
  await expect(trigger).toBeVisible();
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.goForward();
  await expect(answer).toBeVisible();
  await expect(
    answer.getByRole("textbox", { name: "Ask a follow-up", exact: true }),
  ).toHaveValue("Keep after reload Close");
});

test("captured wide-leg cards open truthful details boundaries and restore their exact entry", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/search?q=jeans");
  await page
    .getByRole("button", { name: "View answer for Jeans", exact: true })
    .click();
  for (const number of [1, 2]) {
    const entry = page.getByRole("button", {
      name: `View captured wide leg recommendation ${number}`,
      exact: true,
    });
    await entry.focus();
    await entry.press("Enter");
    const boundary = page.getByRole("dialog", {
      name: "Product details unavailable",
      exact: true,
    });
    await expect(boundary).toContainText(
      "has not been opened, saved, or added to a cart",
    );
    await boundary
      .getByRole("button", {
        name: "Close Product details unavailable",
        exact: true,
      })
      .click();
    await expect(entry).toBeFocused();
  }
  await expect(page.locator(".assistant-wide-rail .save-button")).toHaveCount(
    0,
  );
});

test("Sol retains a muted draft through reload and Close return, while a submitted reply starts empty", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/minis/sol?sol=greeting&mode=text&reference=captured");
  const draft = page.getByRole("textbox", { name: "Message Sol", exact: true });
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    await draft.fill(`black sunglasses ${width}`);
    const toggle = page.getByRole("button", {
      name: /^(Mute|Unmute) microphone preview$/,
    });
    await toggle.click();
    await page.reload();
    await expect(draft).toHaveValue(`black sunglasses ${width}`);
  }
  await page
    .getByRole("link", { name: "Close Sol: Browse by Voice", exact: true })
    .click();
  await expect(page).toHaveURL(/\/minis$/);
  await page.goBack();
  await expect(draft).toHaveValue("black sunglasses 430");
  await draft.fill("Baseball cap");
  await draft.press("Enter");
  await expect(page.locator('[data-sol-phase="choices"]')).toBeVisible();
  await expect(draft).toBeEmpty();
  await page.reload();
  await expect(draft).toBeEmpty();
  await page.goBack();
  await expect(draft).toHaveValue("Baseball cap");
  await page.goForward();
  await expect(draft).toBeEmpty();
});

test("Gift saves one collection across product return and reload, and allows resaving after deletion", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/minis/gift?gift=results");
  const save = page.getByRole("button", {
    name: "Save as Collection",
    exact: true,
  });
  const saved = page.getByRole("button", {
    name: "Saved as Collection",
    exact: true,
  });
  await save.click();
  await expect(saved).toBeVisible();
  const product = page.locator(
    '.gift-result-row a[href="/products/gift-logic"]',
  );
  await product.click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(product).toBeFocused();
  await expect(saved).toBeVisible();
  await page.reload();
  await expect(saved).toBeVisible();
  await saved.click();
  await page.goto("/saved");
  const collection = page
    .locator(".collection-tile")
    .filter({ hasText: "Gift ideas" });
  await expect(collection).toHaveCount(1);
  await collection.click();
  await page
    .getByRole("button", { name: "Collection options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete collection", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Saved", exact: true }),
  ).toBeVisible();
  await expect(collection).toHaveCount(0);
  // Collection options/deletion own their nested history entries. Return
  // through those real entries to the existing Gift conversation.
  for (
    let back = 0;
    back < 6 && new URL(page.url()).pathname === "/saved";
    back += 1
  )
    await page.goBack();
  await expect(page).toHaveURL(/\/minis\/gift\?gift=results$/);
  await expect(save).toBeVisible();
  await save.click();
  await expect(saved).toBeVisible();
  await page.goto("/saved");
  await expect(collection).toHaveCount(1);
});

test("bounded Skin photographs expose genuine hearts with an honest local disclosure at mobile widths", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.goto("/minis/skin?skin=results");
  const cards = page.locator(".skin-partial-grid > div");
  await expect(cards).toHaveCount(2);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    for (const name of [
      "Skin Laundry Hydrating Gentle Cleanser",
      "goPure Gentle Gel Cleanser",
    ]) {
      const heart = page.getByRole("button", {
        name: `Save ${name}`,
        exact: true,
      });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const point = await heart.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        return {
          x,
          y,
          exposed: element.contains(document.elementFromPoint(x, y)),
        };
      });
      expect(point.exposed).toBe(true);
      // Click the real exposed coordinate; locator auto-scrolling must not
      // conceal an overlap with the fixed Home control at the scroll limit.
      await page.mouse.click(point.x, point.y);
      const disclosure = page.getByRole("dialog", {
        name: "Product details unavailable",
        exact: true,
      });
      await expect(disclosure).toContainText(
        "has not been opened, saved, or added to a cart",
      );
      await page.keyboard.press("Escape");
      await expect(heart).toBeFocused();
      await expect(heart).not.toHaveAttribute("aria-pressed", "true");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
