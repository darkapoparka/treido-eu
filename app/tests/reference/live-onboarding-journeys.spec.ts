import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test.beforeEach(async ({ page }) => {
  await useReferenceScenario(page, "onboarding-new");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("live permission matches the Android dialog and owns focus and Back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 427, height: 876 });
  await page.goto("/onboarding?step=updates&journey=new");
  const trigger = page.getByRole("button", {
    name: "Get tracking updates",
    exact: true,
  });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(252, 252, 252)",
  );
  await expect(page.locator(".current-updates-intro > h1")).toHaveCSS(
    "font-size",
    "24px",
  );
  await expect(trigger).toHaveCSS("border-top-width", "2px");
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Allow Shop to send you notifications?",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("animation-name", "none");
  const box = await dialog.boundingBox();
  expect(box?.x).toBeCloseTo(26.833, 0);
  expect(box?.y).toBeCloseTo(295.667, 0);
  expect(box?.width).toBeCloseTo(373.333, 0);
  expect(box?.height).toBeCloseTo(284.667, 0);
  await expect(dialog.locator(".live-notification-heading strong")).toHaveText(
    "Shop",
  );
  const allow = dialog.getByRole("button", { name: "Allow", exact: true });
  const deny = dialog.getByRole("button", { name: "Don’t allow", exact: true });
  await expect(allow).toHaveCSS("border-radius", "12px 12px 3px 3px");
  await expect(deny).toHaveCSS("border-radius", "3px 3px 12px 12px");
  await expect(allow).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(deny).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(allow).toBeFocused();
  await page.screenshot({
    path: test.info().outputPath("live-permission.png"),
  });
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/step=updates&journey=new$/);
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const outcome of ["Allow", "Don’t allow"] as const) {
  test(`live ${outcome} reaches preferences without changing real notification permission`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 427, height: 876 });
    await page.goto("/onboarding?step=updates&journey=new");
    const nativePermission = await page.evaluate(() => Notification.permission);
    if (outcome === "Allow") {
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Skip notifications?" })
        .getByRole("button", { name: "Turn on", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: "Get tracking updates", exact: true })
        .click();
    }
    const dialog = page.getByRole("dialog", {
      name: "Allow Shop to send you notifications?",
    });
    await expect(
      dialog.getByRole("button", { name: "Allow", exact: true }),
    ).toBeFocused();
    await dialog.getByRole("button", { name: outcome, exact: true }).click();
    await expect(page).toHaveURL(/step=preferences&journey=new$/);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    expect(await page.evaluate(() => Notification.permission)).toBe(
      nativePermission,
    );
    const next = page.locator(
      ".current-preferences-intro .onboarding-actions .primary",
    );
    await expect(next).toBeDisabled();
    await expect(next).toBeHidden();
    const everything = page.getByRole("button", {
      name: "Everything",
      exact: true,
    });
    await everything.click();
    await expect(everything).toHaveAttribute("aria-pressed", "true");
    await expect(next).toBeEnabled();
    await page.goBack();
    await expect(page).toHaveURL(/step=updates&journey=new$/);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.goForward();
    await expect(page).toHaveURL(/step=preferences&journey=new$/);
    await expect(everything).toHaveAttribute("aria-pressed", "true");
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/$/);
  });
}

for (const [width, height] of [
  [320, 568],
  [393, 793],
  [427, 876],
  [430, 568],
  [430, 932],
]) {
  test(`live onboarding controls and imagery stay contained at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/onboarding?step=updates&journey=new");
    await page
      .getByRole("button", { name: "Get tracking updates", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Allow Shop to send you notifications?",
    });
    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(16);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
      width - 16,
    );
    for (const button of await dialog.getByRole("button").all()) {
      await expect(button).toBeInViewport();
      const box = await button.boundingBox();
      expect(box?.height).toBe(56);
      expect(box?.x).toBeGreaterThan(bounds?.x ?? 0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThan(
        (bounds?.x ?? 0) + (bounds?.width ?? 0),
      );
    }
    await dialog
      .getByRole("button", { name: "Don’t allow", exact: true })
      .click();
    await expect(page).toHaveURL(/step=preferences&journey=new$/);
    const photos = page.locator(
      ".current-preferences-intro .preference-onboarding-art img",
    );
    await expect(photos).toHaveCount(11);
    await photos.evaluateAll((images) =>
      Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
    );
    await page.getByRole("button", { name: "Women's", exact: true }).click();
    const next = page.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeInViewport();
    const nextBox = await next.boundingBox();
    expect((nextBox?.y ?? 0) + (nextBox?.height ?? 0)).toBeLessThanOrEqual(
      height,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: test.info().outputPath("live-preferences.png"),
    });
  });
}

test("cold launch offers the captured guest Skip path through preferences to Home", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
  await page.goto("/");
  const skipIntro = page.getByRole("button", {
    name: "Skip Get Started",
    exact: true,
  });
  await expect(skipIntro).toBeVisible({ timeout: 5000 });
  const skipBox = await skipIntro.boundingBox();
  expect(skipBox?.x).toBeCloseTo(371.667, 0);
  expect(skipBox?.y).toBeCloseTo(12.333, 0);
  expect(skipBox?.width).toBe(48);
  expect(skipBox?.height).toBe(48);
  await page.screenshot({
    path: test.info().outputPath("welcome-guest-skip.png"),
  });
  await skipIntro.click();
  await expect(page).toHaveURL(/step=updates/);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Skip notifications?" })
    .getByRole("button", { name: "Skip", exact: true })
    .click();
  await expect(page).toHaveURL(/step=preferences/);
  await page.getByRole("button", { name: "Men's", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.goto("/onboarding?reference=captured&journey=new");
  await expect(
    page.getByRole("button", { name: "Skip Get Started", exact: true }),
  ).toHaveCount(0);
});
