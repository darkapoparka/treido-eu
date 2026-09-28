import { expect, test } from "@playwright/test";

// Observe the invariant at showModal itself. Waiting for a timer or polling for
// a history marker before Back would conceal the race this test must detect.
test("visible filter sheets own history before immediate Back, including reopen and nesting", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const showModal = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      const stage = window.history.state?.shopFlowStage;
      this.dataset.historyAtOpen = stage
        ? `flow-${stage.owner}-${stage.depth}`
        : (window.history.state?.shopSheet ?? "missing");
      return showModal.call(this);
    };
  });
  const path = "/search?q=Jeans&q=Shampoo&ratings=4&ratings=5";
  await page.goto(path);
  await expect(
    page.locator('[data-shop-interactive="true"]').first(),
  ).toBeAttached();
  const filter = page.getByRole("button", { name: "Filter", exact: true });
  const root = page.getByRole("dialog", { name: "Filter", exact: true });
  const child = page.getByRole("dialog", { name: "Sort by", exact: true });
  const initialHistoryLength = await page.evaluate(() => history.length);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await filter.click();
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute("data-history-at-open", /^flow-/);
    expect(await page.evaluate(() => history.length)).toBe(
      initialHistoryLength + 1,
    );
    await page.goBack();
    await expect(root).not.toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`${path.replace(/[?&]/g, "\\$&")}$`),
    );
    await expect(filter).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
  }

  await filter.click();
  // A nested modal intentionally removes its parent from the accessibility
  // tree. Read the parent marker while that parent is still the active dialog.
  const parentMarker = await root.getAttribute("data-history-at-open");
  expect(parentMarker).toMatch(/^flow-/);
  const sort = root.getByRole("button", { name: /Sort by/ });
  await sort.click();
  await expect(child).toBeVisible();
  await expect(child).toHaveAttribute("data-history-at-open", /^flow-/);
  expect(await child.getAttribute("data-history-at-open")).not.toBe(
    parentMarker,
  );
  await page.goBack();
  await expect(child).not.toBeVisible();
  await expect(root).toBeVisible();
  await expect(root).toHaveAttribute("data-history-at-open", parentMarker!);
  await expect(sort).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  await page.goBack();
  await expect(root).not.toBeVisible();
  await expect(filter).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Search products" }),
  ).toHaveValue("Jeans");
  expect(
    await page.evaluate(() => window.history.state?.shopFlowStage),
  ).toBeUndefined();
});

test("filter Forward restores its selected stage and history jumps do not rewrite another query", async ({
  page,
}) => {
  await page.goto("/search?q=Shampoo");
  await page
    .getByRole("textbox", { name: "Search products", exact: true })
    .fill("Jeans");
  await page
    .getByRole("button", { name: "Submit search", exact: true })
    .click();
  await expect(page).toHaveURL(/\/search\?q=Jeans$/);
  const trigger = page.getByRole("button", { name: "Filter", exact: true });
  const root = page.getByRole("dialog", { name: "Filter", exact: true });
  const child = page.getByRole("dialog", { name: "Sort by", exact: true });
  await trigger.click();
  const sort = root.getByRole("button", { name: /Sort by/ });
  await sort.click();
  const newest = child.getByRole("button", { name: "Newest", exact: true });
  await newest.click();
  await page.goBack();
  await expect(sort).toBeFocused();
  await expect(sort).toContainText("Newest");
  await page.goForward();
  await expect(newest).toHaveAttribute("aria-pressed", "true");
  await expect(newest).toBeFocused();
  await page.evaluate(() => history.go(-3));
  await expect(page).toHaveURL(/\/search\?q=Shampoo$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search products", exact: true }),
  ).toHaveValue("Shampoo");
  await page.goForward();
  await expect(page).toHaveURL(/\/search\?q=Jeans$/);
  await page.goForward();
  await expect(sort).toContainText("Newest");
  await page.goForward();
  await expect(newest).toBeFocused();
  await expect(newest).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await page.goBack();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/\/search\?q=Jeans&sort=Newest$/);
});

test("one held Escape dismisses only the top sheet and a new Escape closes its parent", async ({
  page,
}) => {
  await page.goto("/search?q=Jeans");
  const trigger = page.getByRole("button", { name: "Filter", exact: true });
  const root = page.getByRole("dialog", { name: "Filter", exact: true });
  const child = page.getByRole("dialog", { name: "Sort by", exact: true });
  await trigger.click();
  const sort = root.getByRole("button", { name: /Sort by/ });
  await sort.click();
  await expect(child).toBeVisible();
  await page.keyboard.down("Escape");
  await expect(child).not.toBeVisible();
  await expect(root).toBeVisible();
  await expect(sort).toBeFocused();
  await page.keyboard.down("Escape");
  await expect(root).toBeVisible();
  await page.keyboard.up("Escape");
  await page.keyboard.press("Escape");
  await expect(root).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/\/search\?q=Jeans$/);
  await trigger.click();
  await root.dispatchEvent("cancel");
  await expect(root).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
