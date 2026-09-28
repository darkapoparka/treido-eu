import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("tracking illustration advances through recorded stages without changing the URL", async ({
  page,
}) => {
  await useReferenceScenario(page, "onboarding-new");
  await page.setViewportSize({ width: 427, height: 876 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
  await page.goto("/onboarding?step=updates&journey=new");
  const demo = page.locator("[data-tracking-demo]");
  const video = demo.locator("video");
  await expect(video).toHaveAttribute(
    "data-video-key",
    "live-smart-onboarding-light-order-placed",
  );
  await expect(video).toHaveAttribute("data-video-ready", "true");
  await video.evaluate((element: HTMLVideoElement) => {
    element.pause();
    element.currentTime = 1;
  });
  await expect(demo).toHaveAttribute("data-tracking-demo", "Order placed");
  await page.clock.fastForward(4000);
  await expect(video).toHaveAttribute(
    "data-video-key",
    "live-smart-onboarding-light-in-transit",
  );
  await expect(video).toHaveAttribute("data-video-ready", "true");
  await expect(demo).toHaveAttribute("data-tracking-demo", "In transit");
  await expect(demo).toContainText("ETA: Monday Sep 1");
  const headingBox = await page
    .locator(".current-updates-intro > h1")
    .boundingBox();
  const cardBox = await demo.boundingBox();
  const actionBox = await page
    .getByRole("button", { name: "Get tracking updates", exact: true })
    .boundingBox();
  const disclosureBox = await page
    .locator(".current-updates-intro .onboarding-actions small")
    .boundingBox();
  // Native title position retained by e5f4dd3; measured at 427x876.
  expect(headingBox?.y).toBeCloseTo(109, 0);
  expect(cardBox?.x).toBeCloseTo(16, 0);
  expect(cardBox?.y).toBeCloseTo(386, 0);
  expect(cardBox?.width).toBeCloseTo(395, 0);
  expect(cardBox?.height).toBeCloseTo(96, 0);
  expect(actionBox?.y ?? 0).toBeGreaterThanOrEqual(768);
  expect(actionBox?.y ?? 0).toBeLessThan(769);
  expect(actionBox?.height).toBeCloseTo(48, 0);
  expect((disclosureBox?.y ?? 0) + (disclosureBox?.height ?? 0)).toBeCloseTo(
    860,
    0,
  );
  await page.screenshot({
    path: test.info().outputPath("tracking-in-transit.png"),
  });
  await page.clock.fastForward(4000);
  await expect(video).toHaveAttribute(
    "data-video-key",
    "live-smart-onboarding-light-out-for-delivery",
  );
  await expect(demo).toHaveAttribute("data-tracking-demo", "Out for delivery");
  await page.clock.fastForward(4000);
  await expect(video).toHaveAttribute(
    "data-video-key",
    "live-smart-onboarding-light-delivered",
  );
  await expect(demo).toHaveAttribute("data-tracking-demo", "Delivered");
  await expect(page).toHaveURL(/step=updates&journey=new$/);
  await expect(
    page.getByRole("button", { name: "Get tracking updates", exact: true }),
  ).toBeVisible();
});

test("current tracking updates preserves the native notification skip confirmation", async ({
  page,
}) => {
  await useReferenceScenario(page, "onboarding-new");
  await page.setViewportSize({ width: 427, height: 876 });
  await page.goto("/onboarding?step=updates&journey=new");

  const skipTrigger = page.getByRole("button", { name: "Skip", exact: true });
  await skipTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Skip notifications?" });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Get tracking updates", exact: true }),
  ).toBeDisabled();
  await expect(dialog).toHaveCSS("background-color", "rgb(236, 230, 240)");
  expect(
    await dialog.evaluate(
      (element) => getComputedStyle(element, "::backdrop").backgroundColor,
    ),
  ).toBe("rgba(0, 0, 0, 0.6)");
  await expect(
    dialog.getByText("You won’t be able to receive order updates from Shop.", {
      exact: true,
    }),
  ).toBeVisible();
  const skipAction = dialog.getByRole("button", { name: "Skip", exact: true });
  const turnOnAction = dialog.getByRole("button", {
    name: "Turn on",
    exact: true,
  });
  await expect(skipAction).toBeFocused();
  await expect(turnOnAction).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.x).toBeCloseTo(53.5, 0);
  expect(dialogBox?.y).toBeCloseTo(341, 0);
  expect(dialogBox?.width).toBeCloseTo(320, 0);
  expect(dialogBox?.height).toBeCloseTo(194, 0);
  await page.screenshot({
    path: test.info().outputPath("skip-notifications-dialog.png"),
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(skipTrigger).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Get tracking updates", exact: true }),
  ).toBeEnabled();

  await skipTrigger.click();
  await dialog.getByRole("button", { name: "Turn on", exact: true }).click();
  const permission = page.getByRole("dialog", {
    name: "Allow Shop to send you notifications?",
  });
  await expect(permission).toBeVisible();
  await expect(
    permission.getByRole("button", { name: "Allow", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(permission).toBeHidden();

  await skipTrigger.click();
  await dialog.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page).toHaveURL(/step=preferences&journey=new$/);
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeHidden();
});

test("intro headlines share one history entry and reduced motion keeps source stills", async ({
  page,
}) => {
  await useReferenceScenario(page, "onboarding-new");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Freeze before mounting timed UI: a remote round trip can consume a
  // Date.now() + 100 deadline and make pauseAt attempt to move backwards.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
  await page.goto("/onboarding?journey=new");
  const heading = page.locator("[data-intro-headline]");
  const objects = page.locator("[data-intro-phase]");
  await expect(heading).toHaveAttribute("data-intro-headline", "0");
  await expect(objects).toHaveAttribute("data-intro-phase", "0");
  await expect(page.locator(".live-welcome-poster")).toHaveAttribute(
    "src",
    "/api/reference-media/live-welcome-orbit-poster",
  );
  await expect(page.locator(".live-welcome-art")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator(".intro-objects img")).toHaveCount(0);
  const historyLength = await page.evaluate(() => history.length);
  await page.clock.fastForward(2000);
  await expect(heading).toContainText("Track your orders");
  await expect(objects).toHaveAttribute("data-intro-phase", "1");
  await page.screenshot({
    path: test.info().outputPath("intro-track-headline.png"),
  });
  await page.clock.fastForward(2000);
  await expect(heading).toContainText("Discover your next");
  await expect(objects).toHaveAttribute("data-intro-phase", "2");
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(heading).toHaveAttribute("data-intro-headline", "0");
  await expect(objects).toHaveAttribute("data-intro-phase", "0");
  await page.clock.fastForward(8000);
  await expect(heading).toHaveAttribute("data-intro-headline", "0");
  await page.goto("/onboarding?step=updates");
  await expect(page.locator("[data-tracking-demo]")).toHaveAttribute(
    "data-tracking-demo",
    "Delivered",
  );
});

test("Sol exposes Almost ready and leaving it cancels the pending greeting", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Freeze before mounting timed UI: a remote round trip can consume a
  // Date.now() + 100 deadline and make pauseAt attempt to move backwards.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
  await page.goto("/minis");
  await page.goto("/minis/sol?sol=connecting");
  await expect(page.locator('[data-sol-phase="connecting"]')).toBeVisible();
  await page.clock.fastForward(2400);
  await expect(
    page.getByRole("status", { name: "Almost ready" }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("sol-almost-ready.png"),
  });
  await page.goBack();
  await page.clock.fastForward(5000);
  await expect(page).toHaveURL(/\/minis$/);
  await page.goForward();
  await expect(page.locator('[data-sol-phase="ready"]')).toBeVisible();
  await page.clock.fastForward(500);
  await expect(page.locator('[data-sol-phase="greeting"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Type instead", exact: true }),
  ).toBeEnabled();
});

test("Saved header preview follows selection and cancels without replaying", async ({
  page,
}) => {
  await useReferenceScenario(page, "saved-pair");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/saved");
  await page
    .getByRole("button", { name: "Create collection", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Collection name", exact: true })
    .fill("Motion collection");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Add Shea Butter Exfoliating Body Wash",
      exact: true,
    })
    .click();
  const incoming = page.locator(".saved-preview-incoming");
  await expect(incoming).toBeVisible();
  const photo = await incoming.boundingBox();
  const header = await page.locator(".saved-heading").boundingBox();
  expect(photo?.width).toBe(32);
  expect(photo?.height).toBe(32);
  expect(photo?.y).toBeGreaterThanOrEqual(header?.y ?? 0);
  expect((photo?.y ?? 0) + 32).toBeLessThanOrEqual(
    (header?.y ?? 0) + (header?.height ?? 0) + 24,
  );
  await expect(page.locator(".saved-selection-flight")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(incoming).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(incoming).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Remove Shea Butter Exfoliating Body Wash",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", {
      name: "Add Rice Water Shampoo & Conditioner Combo",
      exact: true,
    })
    .click();
  await expect(page.locator(".saved-preview-outgoing")).toHaveCount(1);
  await expect(incoming).toHaveAttribute("alt", "2 selected items");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".saved-selection-preview")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Motion collection", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".saved-grid > article")).toHaveCount(2);
});
