import { expect, test, type Page } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const phase = (page: Page, name: string) =>
  page.locator(`[data-gift-phase="${name}"]`);
async function reachNotes(
  page: Page,
  scenario: "profile-named" | "home-welcome" = "profile-named",
) {
  await useReferenceScenario(page, scenario);
  await page.goto("/minis/gift");
  await button(page, "Let’s Begin").click();
  await expect(
    page.getByText(
      "Welcome to Gift Sense, your smart guide to finding gifts that truly fit.",
      { exact: false },
    ),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Gift answer", exact: true })
    .fill("Support");
  await button(page, "Continue gift questions").click();
  for (const trait of ["Creative", "Thoughtful", "Tech-Savvy", "Homebody"])
    await button(page, trait).click();
  await button(page, "Continue").click();
  await button(page, "Under $25").click();
  await expect(phase(page, "notes")).toBeVisible();
}

async function giftResultGeometry(page: Page) {
  return page.evaluate(() => {
    const rows = [
      ...document.querySelectorAll<HTMLElement>(".gift-result-row"),
    ];
    const bounds = rows.map((row) => row.getBoundingClientRect());
    return {
      firstTop: bounds.length ? Math.round(bounds[0].top) : -1,
      gaps: bounds
        .slice(1)
        .map((bound, index) => Math.round(bound.top - bounds[index].bottom)),
      margins: rows.map((row) => {
        const style = getComputedStyle(row);
        return { top: style.marginTop, bottom: style.marginBottom };
      }),
    };
  });
}

test("Gift Sense keeps the captured custom recipient, selected traits, budget and notes through history", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 393, height: 793 });
  await reachNotes(page);
  const notes = page.getByRole("textbox", {
    name: "Optional gift notes",
    exact: true,
  });
  await expect(notes).toBeFocused();
  await notes.fill("He likes black color");
  await page.goBack();
  await expect(phase(page, "budget")).toBeVisible();
  await expect(button(page, "Under $25")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.goBack();
  await expect(phase(page, "personality")).toBeVisible();
  await expect(page.locator('[data-gift-step="2"] > .gift-answer')).toHaveText(
    "Support",
  );
  for (const trait of ["Creative", "Thoughtful", "Tech-Savvy", "Homebody"])
    await expect(button(page, trait)).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await page.goForward();
  await expect(notes).toHaveValue("He likes black color");
  await button(page, "Continue gift questions").click();
  const access = page.getByRole("dialog", {
    name: "Continue as Alex?",
    exact: true,
  });
  await expect(access).toBeVisible();
  await expect(access).toContainText("does not send them to Gift Sense");
  await expect(page.getByLabel("Gift questions 10 of 10")).toBeVisible();
  await expect(
    access.getByLabel("Alex's profile").locator("img"),
  ).toHaveAttribute("src", "/api/reference-media/auth-reference-avatar");
  const geometry = await access.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { height: bounds.height, bottomGap: innerHeight - bounds.bottom };
  });
  expect(geometry.height).toBeLessThan(260);
  expect(geometry.bottomGap).toBeLessThanOrEqual(40);
  const note = await page.locator("[data-gift-note]").boundingBox();
  expect(note?.y).toBeLessThan(515);
  await expect(button(page, "Skip")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(access).not.toBeVisible();
  await expect(notes).toBeFocused();
  await expect(notes).toHaveValue("He likes black color");
});

test("Gift's captured loading states resolve to the right products without submitting answers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 793 });
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await reachNotes(page);
  await page
    .getByRole("textbox", { name: "Optional gift notes", exact: true })
    .fill("He likes black color");
  await button(page, "Continue gift questions").click();
  await button(page, "Agree").click();
  await expect(phase(page, "finding")).toBeVisible();
  await expect(page.locator("[data-gift-note]")).toHaveText(
    "He likes black color",
  );
  const findingBottomGap = await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>(".gift-conversation");
    const finding = document.querySelector<HTMLElement>('[data-gift-step="6"]');
    if (!scroller || !finding) return -1;
    return Math.round(
      scroller.getBoundingClientRect().bottom -
        finding.getBoundingClientRect().bottom,
    );
  });
  expect(findingBottomGap).toBeGreaterThanOrEqual(22);
  expect(findingBottomGap).toBeLessThanOrEqual(26);

  await expect(phase(page, "results-loading")).toBeVisible();
  await expect(page.getByLabel("Loading captured product image")).toHaveCount(
    3,
  );
  const loadingGeometry = await giftResultGeometry(page);
  expect(loadingGeometry.margins).toEqual([
    { top: "0px", bottom: "0px" },
    { top: "0px", bottom: "0px" },
    { top: "0px", bottom: "0px" },
  ]);
  expect(loadingGeometry.gaps).toEqual([12, 12]);
  expect(loadingGeometry.firstTop).toBeGreaterThanOrEqual(286);
  expect(loadingGeometry.firstTop).toBeLessThanOrEqual(292);

  await expect(phase(page, "results")).toBeVisible();
  await expect(page.locator(".gift-result-row")).toHaveCount(3);
  await expect(page.locator(".gift-result-row img")).toHaveCount(3);
  await expect(
    page.getByText("Recorded gift example", { exact: true }),
  ).toHaveCount(0);
  const resultGeometry = await giftResultGeometry(page);
  expect(resultGeometry.gaps).toEqual([12, 12]);
  expect(resultGeometry.firstTop).toBeGreaterThanOrEqual(222);
  expect(resultGeometry.firstTop).toBeLessThanOrEqual(228);
  await expect(
    page.locator('.gift-result-row a[href="/products/gift-logic"]'),
  ).toContainText("$18.99");
  await expect(
    page.locator('.gift-result-row a[href="/products/gift-buds"]'),
  ).toContainText("$24.95");
  await expect(
    page.locator('.gift-result-row a[href="/products/gift-nirvana"]'),
  ).toContainText("$24.00");
  await button(page, "Show Similar Gifts").click();
  await expect(
    page.getByRole("dialog", { name: "Recorded gift ideas", exact: true }),
  ).toContainText("More recommendations are not connected");
  await button(page, "Keep these ideas").click();
  await button(page, "Save as Collection").click();
  await expect(button(page, "Saved as Collection")).toBeVisible();
  expect(writes).toEqual([]);
});

test("Gift restores the current history entry after reload and a Mini route remount", async ({
  page,
}) => {
  await reachNotes(page);
  const notes = page.getByRole("textbox", {
    name: "Optional gift notes",
    exact: true,
  });
  await notes.fill("He likes black color");
  await page.reload();
  await expect(phase(page, "notes")).toBeVisible();
  await expect(notes).toHaveValue("He likes black color");
  await expect(page.locator('[data-gift-step="2"] > .gift-answer')).toHaveText(
    "Support",
  );
  await expect(button(page, "Under $25")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const trait of ["Creative", "Thoughtful", "Tech-Savvy", "Homebody"])
    await expect(button(page, trait)).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("link", { name: "Close Gift Sense", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Minis", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(phase(page, "notes")).toBeVisible();
  await expect(notes).toHaveValue("He likes black color");
});

test("Gift uses an unnamed profile fallback instead of inventing a name", async ({
  page,
}) => {
  await reachNotes(page, "home-welcome");
  await button(page, "Skip").click();
  const access = page.getByRole("dialog", {
    name: "Continue to Gift Sense?",
    exact: true,
  });
  await expect(access).toBeVisible();
  await expect(access).not.toContainText("Continue as Alex?");
  const profile = access.getByLabel("Your profile", { exact: true });
  await expect(profile).toBeVisible();
  await expect(profile.locator("img")).toHaveCount(0);
  await expect(access).toContainText("does not send them to Gift Sense");
});

test("Restart and browser Back cancel Gift playback, and the composer stays inside sibling widths", async ({
  page,
}) => {
  await reachNotes(page);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 793 });
    const contained = await page
      .locator(".gift-composer")
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth
        );
      });
    expect(contained, `Gift composer at ${width}px`).toBe(true);
  }
  await button(page, "Skip").click();
  await button(page, "Continue without access").click();
  await expect(phase(page, "finding")).toBeVisible();
  await page.goBack();
  await expect(phase(page, "notes")).toBeVisible();
  await page.waitForTimeout(2700);
  await expect(phase(page, "finding")).toHaveCount(0);
  await expect(phase(page, "results")).toHaveCount(0);
  await button(page, "Restart gift questions").click();
  await expect(phase(page, "welcome")).toBeVisible();
  await button(page, "Let’s Begin").click();
  await expect(
    page.getByRole("textbox", { name: "Gift answer", exact: true }),
  ).toHaveValue("");
});
