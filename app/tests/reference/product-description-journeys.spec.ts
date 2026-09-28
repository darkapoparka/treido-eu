import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

for (const id of ["shampoo-bag", "shea-butter"] as const) {
  test(`${id} preserves its own description, paragraph layout and return focus`, async ({
    page,
  }) => {
    await useReferenceScenario(page, "home-welcome");
    await page.goto(`/products/${id}`);
    await expect(
      page.locator('[data-shop-interactive="true"]').first(),
    ).toBeAttached();
    const preview = page.locator(".pdp-description");
    const paragraphs = preview.locator(":scope > p");
    const readMore = preview.getByRole("button", {
      name: "Read more",
      exact: true,
    });
    await expect(paragraphs).toHaveCount(2);
    await expect(readMore).toHaveCount(1);
    await expect(paragraphs.last()).toContainText(
      id === "shampoo-bag"
        ? "Our patented design preserves the life..."
        : "Small plant-derived exfoliants gently exfoliate to reveal softer skin...",
    );

    for (const width of [320, 393, 430]) {
      await page.setViewportSize({ width, height: 793 });
      await expect(readMore).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 393, height: 793 });
    if (id === "shampoo-bag") {
      await expect(paragraphs.last()).toHaveCSS("margin-top", "16px");
    }
    await readMore.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await readMore.click({ trial: true });
    const scroll = await page.evaluate(() => scrollY);
    expect(scroll).toBeGreaterThan(0);
    await readMore.click();
    const dialog = page.getByRole("dialog", {
      name: "Description",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const dialogFontFamily = await dialog.evaluate(
      (element) => getComputedStyle(element).fontFamily,
    );
    if (id === "shea-butter") {
      expect(dialogFontFamily).toContain("ShopProductDescriptionGeist");
      const copyTransform = await dialog
        .locator(".sheet-copy")
        .evaluate((element) => {
          const matrix = new DOMMatrix(getComputedStyle(element).transform);
          return { x: matrix.m41, y: matrix.m42 };
        });
      expect(copyTransform.x).toBeCloseTo(-0.3, 3);
      expect(copyTransform.y).toBeCloseTo(0.4, 3);
      const wrap = await dialog.getByRole("listitem").evaluateAll((items) => {
        const wordTop = (item: Element, word: string) => {
          const node = item.firstChild;
          const text = node?.textContent ?? "";
          const index = text.indexOf(word);
          if (!node || node.nodeType !== Node.TEXT_NODE || index < 0) {
            throw new Error(`Missing text node or word: ${word}`);
          }
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + word.length);
          return range.getBoundingClientRect().top;
        };
        return {
          letterSpacing: getComputedStyle(items[0]).letterSpacing,
          first: {
            your: wordTop(items[0], "your"),
            skin: wordTop(items[0], "skin"),
            post: wordTop(items[0], "post-"),
            shower: wordTop(items[0], "shower!"),
          },
          second: {
            gently: wordTop(items[1], "gently"),
            exfoliate: wordTop(items[1], "exfoliate"),
            to: wordTop(items[1], "to"),
          },
        };
      });
      expect(wrap.letterSpacing).toBe("-0.1px");
      expect(wrap.first.your).toBe(wrap.first.skin);
      expect(wrap.first.post).not.toBe(wrap.first.shower);
      expect(wrap.second.gently).toBe(wrap.second.exfoliate);
      expect(wrap.second.exfoliate).not.toBe(wrap.second.to);
    } else {
      expect(dialogFontFamily).not.toContain("ShopProductDescriptionGeist");
    }
    if (id === "shampoo-bag") {
      await expect(dialog).toContainText(
        "Our patented design preserves the life of your bar.",
      );
      await expect(dialog).not.toContainText("Ingredients:");
    } else {
      await expect(dialog.getByRole("list")).toBeVisible();
      await expect(dialog.getByRole("listitem")).toHaveCount(4);
      await expect(dialog).toContainText("Ingredients:");
      await expect(dialog).toContainText("Fragrance: Almond & Cherry");
      await expect(dialog).not.toContainText("Mesh fabric");
    }
    await page.goBack();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/products/${id}$`));
    await expect(readMore).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
    await readMore.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(readMore).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
  });
}
