import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const product = "/products/shea-butter/reviews";
const store = "/stores/kitsch/reviews";
const row = (page: Page, id: string) =>
  page.locator(`[data-review-id="${id}"]`);
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

test("review previews retain their last partial word and full text through resize and expansion", async ({
  page,
}) => {
  await open(page, product);
  const review = row(page, "juanita");
  const paragraph = review.locator(":scope > p");
  const body =
    "I love the body soap you sent me and I use the liquid shampoo. I love it but it’s just great for my hair and everything I’ve had from you for all my hair products and all my ties and all I have loved everything.";
  await expect(paragraph).toHaveText(body);
  const bodyTransform = await paragraph.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return matrix.m42;
  });
  expect(bodyTransform).toBeCloseTo(0.4, 3);
  // At the source width, part of the final word belongs on the fourth line.
  // A whole-word clamp incorrectly moves all of it beyond the visible box.
  await expect
    .poll(() =>
      paragraph.evaluate((element) => {
        let offset = element.textContent!.lastIndexOf("everything");
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (offset < node.textContent!.length) {
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + 1);
            return (
              range.getBoundingClientRect().top <
              element.getBoundingClientRect().bottom
            );
          }
          offset -= node.textContent!.length;
        }
        return false;
      }),
    )
    .toBe(true);
  for (const width of [320, 430, 393]) {
    await page.setViewportSize({ width, height: 793 });
    await expect(paragraph).toHaveText(body);
    await expect
      .poll(() =>
        paragraph.evaluate((element) => {
          const lineHeight = Number.parseFloat(
            getComputedStyle(element).lineHeight,
          );
          return element.getBoundingClientRect().height <= lineHeight * 4 + 1;
        }),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await review.getByRole("button", { name: "Read more", exact: true }).click();
  await expect(paragraph).toHaveText(body);
  await expect(paragraph).not.toHaveClass("review-truncated");
  await review.getByRole("button", { name: "Read less", exact: true }).click();
  await expect(paragraph).toHaveClass("review-truncated");
  await expect(paragraph).toHaveText(body);
});

async function open(page: Page, path: string) {
  await useReferenceScenario(page, "home-welcome");
  await page.goto(path);
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test("bag review navigation keeps its own captured aggregate and returns to its preview", async ({
  page,
}) => {
  await open(page, "/products/shampoo-bag");
  const preview = page.locator(
    '.pdp-review-preview[data-product-id="shampoo-bag"]',
  );
  await expect(preview).toContainText("3.8K ratings");
  await expect(preview).toContainText("Jessica");
  await preview
    .getByRole("link", { name: "Read all reviews", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products\/shampoo-bag\/reviews$/);
  await expect(
    page.getByRole("heading", { name: "Shampoo Bar Bag", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("3.8K ratings", { exact: false })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "The full review list was not captured for this product.",
  );
  await expect(
    page.getByText("Girlfriend loves it and I can breathe .", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("searchbox", { name: "Search reviews" }),
  ).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("bag-reviews.png") });
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/shampoo-bag$/);
  await expect(preview).toContainText("Jessica");
  await expect(preview).toContainText("Great…");
});

test("product review search sort expansion and helpful state survive a product visit and browser Back", async ({
  page,
}) => {
  await open(page, product);
  const wes = row(page, "wes");
  await wes.getByRole("button", { name: "Read more", exact: true }).click();
  await wes.getByRole("button", { name: "Helpful", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search reviews" });
  await search.fill("nice");
  await expect(page.locator(".review-card")).toHaveCount(4);
  const tammy = row(page, "tammy");
  await tammy.getByRole("button", { name: "Helpful", exact: true }).click();
  await button(page, "Filter reviews").click();
  await button(page, "Highest rating").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/q=nice.*sort=Highest/);
  await page.getByRole("link", { name: "Close reviews", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/shea-butter$/);
  await page.goBack();
  await expect(search).toHaveValue("nice");
  await expect(page).toHaveURL(/q=nice.*sort=Highest/);
  await expect(tammy.locator(".review-helpful")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await search.fill("");
  await expect(wes.getByRole("button", { name: "Read less" })).toBeVisible();
  await expect(wes.locator(".review-helpful")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("review reporting validates a reason, cancels without a mark, and preserves a submitted local mark", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await open(page, product);
  await page.screenshot({ path: test.info().outputPath("review-default.png") });
  const wes = row(page, "wes");
  await wes.getByRole("button", { name: "Read more", exact: true }).click();
  await wes.getByRole("button", { name: "Helpful", exact: true }).click();
  const options = button(page, "More options for Wes's review");
  await options.click();
  await button(page, "Report this review").click();
  const reasons = page.getByRole("dialog", {
    name: "Why are you reporting this review?",
    exact: true,
  });
  await expect(reasons.getByRole("radio")).toHaveCount(9);
  await expect(button(page, "Report")).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath("review-reasons.png") });
  await button(page, "Cancel").click();
  await expect(reasons).not.toBeVisible();
  await expect(options).toBeFocused();
  await expect(wes.locator(".review-reported-label")).toHaveCount(0);
  await options.click();
  await button(page, "Report this review").click();
  await page.getByRole("radio", { name: "It’s spam", exact: true }).check();
  await button(page, "Report").click();
  const thanks = page.getByRole("dialog", { name: "Thanks for reporting" });
  await expect(thanks).toBeVisible();
  await expect(thanks.getByRole("status")).toContainText("No report was sent");
  await expect(thanks.getByRole("status")).toHaveCSS("min-height", "90px");
  await button(page, "Close").click();
  const reportedLabel = wes.locator(".review-reported-label");
  await expect(reportedLabel).toBeVisible();
  await expect(reportedLabel).toHaveText("You reported this review");
  await expect(reportedLabel).not.toContainText("local preview");
  await expect(reportedLabel).toHaveCSS("font-size", "13.5px");
  await expect(reportedLabel).toHaveCSS("margin-top", "1px");
  await expect(reportedLabel).toHaveCSS("padding-right", "5px");
  await expect(wes.locator(".review-helpful")).toBeDisabled();
  await expect(wes.getByRole("button", { name: "Read less" })).toBeVisible();
  await expect(options).toBeFocused();
  await page.screenshot({
    path: test.info().outputPath("review-reported.png"),
  });
  await page.getByRole("link", { name: "Close reviews", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/shea-butter$/);
  await page.goBack();
  await expect(wes.locator(".review-reported-label")).toBeVisible();
  await expect(wes.locator(".review-helpful")).toBeDisabled();
});

test("store review filters recover from empty results and retain scoped helpful state through navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  await open(page, store);
  await page.screenshot({ path: test.info().outputPath("store-reviews.png") });
  const first = row(page, "store-review-1");
  await first.getByRole("button", { name: "Helpful", exact: true }).click();
  await button(page, "Rating").click();
  await button(page, "4 stars").click();
  await expect(
    page.getByRole("heading", { name: "No matching reviews" }),
  ).toBeVisible();
  await button(page, "Clear filters").click();
  await expect(page.locator(".store-review-list article")).toHaveCount(3);
  await button(page, "Filter reviews").click();
  await page.getByRole("searchbox", { name: "Search reviews" }).fill("Coastal");
  await button(page, "Done").click();
  await expect(page.locator(".store-review-list article")).toHaveCount(1);
  await expect(row(page, "store-review-2")).toBeVisible();
  await button(page, "Sort by").click();
  await button(page, "Most helpful").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Close reviews", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/kitsch\/info$/);
  await page.goBack();
  await expect(page).toHaveURL(/q=Coastal.*sort=Most/);
  await expect(row(page, "store-review-2")).toBeVisible();
  await button(page, "Filter reviews").click();
  await page.getByRole("searchbox", { name: "Search reviews" }).fill("");
  await button(page, "Done").click();
  await expect(
    page.locator(".store-review-list article").first(),
  ).toHaveAttribute("data-review-id", "store-review-1");
  await expect(first.locator(".review-helpful")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("link", { name: "Close reviews", exact: true }).click();
  await page.getByRole("link", { name: "Shop all", exact: true }).click();
  await page.locator('a[href="/products/shea-butter"]').first().click();
  await page
    .getByRole("link", { name: "Read all reviews", exact: true })
    .click();
  await expect(row(page, "wes").locator(".review-helpful")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("all report reasons and closing controls remain usable at 320, 393 and 430 pixels", async ({
  page,
}) => {
  await open(page, product);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const options = button(page, "More options for Wes's review");
    await options.click();
    await button(page, "Report this review").click();
    await page.evaluate(() => document.fonts.ready);
    const reasonFamilies = await page
      .locator(".review-reason-options :is(strong, small)")
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).fontFamily),
      );
    expect(reasonFamilies.every((family) => family.includes("Segoe UI"))).toBe(
      true,
    );
    await expect(
      page.locator(".review-reason-options strong").first(),
    ).toHaveCSS("letter-spacing", "0.145px");
    await expect(
      page.locator(".review-reason-options small").first(),
    ).toHaveCSS("letter-spacing", "0.01px");
    expect(
      await page
        .locator(".review-report-title")
        .evaluate((element) => getComputedStyle(element).fontFamily),
    ).not.toContain("Segoe UI");
    const reason = page.getByRole("radio", { name: "It’s spam", exact: true });
    await reason.check();
    await expect(reason).toBeChecked();
    await expect(button(page, "Report")).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await button(page, "Cancel").click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(options).toBeFocused();
  }
});

test("review footer controls retain source geometry and keyboard behavior at mobile widths", async ({
  page,
}) => {
  await open(page, product);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const wes = row(page, "wes");
    const helpful = wes.locator(".review-helpful");
    await expect(page.locator(".section-heading h1")).toHaveCSS(
      "font-size",
      "28.4px",
    );
    await expect(page.locator(".section-heading h1")).toHaveCSS(
      "letter-spacing",
      "-1.7px",
    );
    await expect(page.locator(".review-summary strong")).toHaveCSS(
      "font-size",
      "28.2px",
    );
    await expect(page.locator(".review-summary strong")).toHaveCSS(
      "letter-spacing",
      "-0.4px",
    );
    await expect(wes.locator("h2")).toHaveCSS("letter-spacing", "-0.4px");
    const body = wes.locator(":scope > p");
    await expect(body).toHaveCSS("font-size", "14.2px");
    await expect(body).toHaveCSS("letter-spacing", "0.025px");
    expect(
      await body.evaluate((element) => getComputedStyle(element).fontFamily),
    ).toContain("Segoe UI");
    await expect(wes.locator(".review-author")).toHaveCSS(
      "letter-spacing",
      "0.1px",
    );
    await expect(helpful).toHaveCSS("font-size", "12.3px");
    await expect(helpful).toHaveCSS("letter-spacing", "-0.1px");
    if (width === 393) {
      const wrap = await body.evaluate((element) => {
        const node = element.firstChild;
        const text = node?.textContent ?? "";
        const wordTop = (phrase: string) => {
          const index = text.indexOf(phrase);
          if (!node || node.nodeType !== Node.TEXT_NODE || index < 0) {
            throw new Error(`Missing text node or phrase: ${phrase}`);
          }
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + phrase.length);
          return range.getBoundingClientRect().top;
        };
        return {
          think: wordTop("think"),
          all: wordTop("all products"),
          products: wordTop("products need"),
          man: wordTop("Being a man"),
          allergies: wordTop("with allergies"),
          someone: wordTop("someone"),
          final: wordTop("has finally"),
          works: wordTop("works"),
        };
      });
      expect(wrap.think).toBe(wrap.all);
      expect(wrap.all).not.toBe(wrap.products);
      expect(wrap.products).toBe(wrap.man);
      expect(wrap.man).not.toBe(wrap.allergies);
      expect(wrap.allergies).toBe(wrap.someone);
      expect(wrap.someone).not.toBe(wrap.final);
      expect(wrap.final).toBe(wrap.works);
    }
    await helpful.focus();
    await page.keyboard.press("Space");
    await expect(helpful).toHaveAttribute("aria-pressed", "true");
    const count = await helpful.locator(".helpful-count").boundingBox();
    expect(count?.width).toBe(24);
    const controls = await wes
      .locator("footer button")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          const card = element.closest("article")!.getBoundingClientRect();
          return bounds.left >= card.left && bounds.right <= card.right;
        }),
      );
    expect(controls.every(Boolean)).toBe(true);
    const options = wes.getByRole("button", {
      name: "More options for Wes's review",
    });
    await options.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "More options", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(options).toBeFocused();
    await helpful.focus();
    await page.keyboard.press("Space");
    await expect(helpful).toHaveAttribute("aria-pressed", "false");
  }
});
