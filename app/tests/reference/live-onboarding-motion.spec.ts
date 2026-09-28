import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 427, height: 876 });
});

test("native welcome plays continuous decorative motion while copy and controls remain DOM", async ({
  page,
  request,
}) => {
  await page.goto("/onboarding?journey=new");
  const video = page.locator('video[data-video-key="live-welcome-orbit"]');
  await expect(video).toHaveAttribute("data-video-ready", "true");
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.2);
  expect(
    await video.evaluate((v: HTMLVideoElement) => ({
      width: v.videoWidth,
      height: v.videoHeight,
      loop: v.loop,
      muted: v.muted,
      error: v.error,
    })),
  ).toEqual({ width: 854, height: 1200, loop: true, muted: true, error: null });
  const pixels = await video.evaluate(async (v: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    v.pause();
    async function frame(time: number) {
      const ready = new Promise<void>((resolve) =>
        v.addEventListener("seeked", () => resolve(), { once: true }),
      );
      v.currentTime = time;
      await ready;
      ctx.drawImage(v, 0, 0, 128, 180);
      return ctx.getImageData(0, 0, 128, 180).data;
    }
    const first = await frame(0.5),
      second = await frame(2.5);
    return Array.from(first).filter(
      (value, index) => index % 4 !== 3 && Math.abs(value - second[index]) > 16,
    ).length;
  });
  expect(pixels).toBeGreaterThan(1500);
  await expect(
    page.getByRole("button", { name: "Skip Get Started" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Get Started", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(
      ".live-welcome-art button,.live-welcome-art a,.live-welcome-art h1",
    ),
  ).toHaveCount(0);
  expect(
    (
      await request.get("/api/reference-video/live-welcome-orbit", {
        headers: { Range: "bytes=0-31" },
      })
    ).status(),
  ).toBe(206);
});

test("Skip and the native lockup share a stable baseline across all four headlines", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
  await page.goto("/onboarding?journey=new");
  await page.evaluate(() => document.fonts.ready);
  const skip = page.getByRole("button", { name: "Skip Get Started" });
  const powered = page.locator(".intro-powered");
  const history = await page.evaluate(() => window.history.length);
  for (let phase = 0; phase < 4; phase++) {
    await expect(page.locator("[data-intro-headline]")).toHaveAttribute(
      "data-intro-headline",
      String(phase),
    );
    const skipBox = (await skip.boundingBox())!,
      poweredBox = (await powered.boundingBox())!;
    expect(skipBox.y + skipBox.height / 2).toBeCloseTo(
      poweredBox.y + poweredBox.height / 2,
      1,
    );
    expect(skipBox.x).toBeCloseTo(371.667, 0);
    expect(skipBox.y).toBeCloseTo(12.333, 0);
    expect((await page.locator("h1").boundingBox())!.y).toBeCloseTo(375.333, 0);
    if (phase)
      await expect(page.locator("h1 > span")).toHaveCSS("opacity", "1");
    await page.clock.fastForward(1999);
    await expect(page.locator("[data-intro-headline]")).toHaveAttribute(
      "data-intro-headline",
      String(phase),
    );
    await page.clock.fastForward(1);
  }
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  await skip.click();
  await expect(page).toHaveURL(/step=updates/);
  await expect(
    page.locator('video[data-video-key="live-welcome-orbit"]'),
  ).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/onboarding\?journey=new$/);
  await expect(skip).toBeVisible();
});

for (const mode of ["reduced motion", "media failure"] as const) {
  test(`native welcome preserves the verified still and guest actions during ${mode}`, async ({
    page,
  }) => {
    if (mode === "reduced motion")
      await page.emulateMedia({ reducedMotion: "reduce" });
    else
      await page.route("**/api/reference-video/live-welcome-orbit", (route) =>
        route.abort(),
      );
    await page.goto("/onboarding?journey=new");
    const poster = page.locator(".live-welcome-poster");
    await expect(poster).toBeVisible();
    await expect(poster).toHaveJSProperty("naturalWidth", 854);
    await expect(page.locator('video[data-video-ready="true"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Skip Get Started" }).click();
    await expect(page).toHaveURL(/step=updates/);
  });
}

test("native tracking uses the parcel fallback when original animation media fails", async ({
  page,
}) => {
  await page.route("**/api/reference-video/live-smart-onboarding-*", (route) =>
    route.abort(),
  );
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
  await page.goto("/onboarding?step=updates&journey=new");
  const card = page.locator("[data-tracking-demo]");
  const parcel = card.locator(".tracking-parcel");
  await expect(parcel).toHaveAttribute(
    "src",
    "/api/reference-media/live-onboarding-parcel",
  );
  await page.clock.fastForward(8000);
  await expect(card).toHaveAttribute("data-tracking-demo", "Out for delivery");
  await expect(parcel).toHaveAttribute(
    "src",
    "/api/reference-media/live-onboarding-parcel",
  );
  await page.clock.fastForward(4000);
  await expect(card).toHaveAttribute("data-tracking-demo", "Delivered");
  await expect(parcel).toHaveAttribute(
    "src",
    "/api/reference-media/live-onboarding-delivered",
  );
  await expect(
    page.getByRole("button", { name: "Get tracking updates", exact: true }),
  ).toBeEnabled();
});

for (const [width, height] of [
  [320, 568],
  [393, 793],
  [430, 568],
  [430, 932],
]) {
  test(`native welcome and parcel entry stay usable at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/onboarding?journey=new");
    await page.evaluate(() => document.fonts.ready);
    const skip = page.getByRole("button", { name: "Skip Get Started" });
    const action = page.getByRole("link", { name: "Get Started", exact: true });
    await expect(skip).toBeInViewport();
    await expect(action).toBeInViewport();
    const art = (await page.locator(".live-welcome-art").boundingBox())!;
    const actionBox = (await action.boundingBox())!;
    expect(art.y + art.height).toBeLessThan(actionBox.y);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: test.info().outputPath(`welcome-${width}-${height}.png`),
    });
    await action.click();
    await page.waitForURL(/\/login\?screen=track&journey=new$/);
    await expect(page.locator(".current-track-intro > img")).toHaveAttribute(
      "src",
      "/api/reference-media/live-onboarding-track-parcel",
    );
    await expect(
      page.getByRole("button", { name: "Track my order" }),
    ).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "Skip", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}

test("native 3x welcome decodes the decorative recording without a full-screen screenshot", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 427, height: 876 },
    deviceScaleFactor: 3,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const page = await context.newPage();
    await page.goto(
      String(test.info().project.use.baseURL) + "/onboarding?journey=new",
    );
    await expect(
      page.locator('video[data-video-key="live-welcome-orbit"]'),
    ).toHaveAttribute("data-video-ready", "true");
    await expect(page.locator(".live-welcome-poster")).toHaveAttribute(
      "height",
      "1200",
    );
    await page.screenshot({ path: test.info().outputPath("welcome-3x.png") });
  } finally {
    await context.close();
  }
});

test("returning welcome reveals guest Skip after sign-in cancellation, not an invented timer", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
  await page.goto("/onboarding?step=signout");
  await page.clock.fastForward(1400);
  await page.waitForURL(/welcome=returning/);
  await expect(
    page.getByRole("button", { name: "Skip Get Started" }),
  ).toHaveCount(0);
  await page.clock.fastForward(8000);
  await expect(
    page.getByRole("button", { name: "Skip Get Started" }),
  ).toHaveCount(0);
  expect((await page.locator(".intro-powered").boundingBox())!.y).toBeCloseTo(
    16,
    0,
  );
  await page.getByRole("link", { name: "Get Started", exact: true }).click();
  await page.waitForURL(/screen=track&journey=new$/);
  await page.getByRole("link", { name: "Skip", exact: true }).click();
  await page.waitForURL(/\/login\?journey=new$/);
  await page.getByRole("link", { name: "Close sign in" }).click();
  await page.waitForURL(/\/onboarding$/);
  await expect(
    page.getByRole("button", { name: "Skip Get Started" }),
  ).toBeVisible();
  expect((await page.locator(".intro-powered").boundingBox())!.y).toBeCloseTo(
    28.333,
    0,
  );
});

for (const [route, selector, attribute, first, next, interval] of [
  [
    "/onboarding?journey=new",
    "[data-intro-headline]",
    "data-intro-headline",
    "0",
    "1",
    2000,
  ],
  [
    "/onboarding?step=updates&journey=new",
    "[data-tracking-demo]",
    "data-tracking-demo",
    "Order placed",
    "In transit",
    4000,
  ],
] as const) {
  test(`onboarding clock preserves foreground time on ${route}`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
    await page.goto(route);
    const owner = page.locator(selector);
    await expect(owner).toHaveAttribute(attribute, first);
    await page.clock.fastForward(1000);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.fastForward(20000);
    await expect(owner).toHaveAttribute(attribute, first);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.fastForward(interval - 1001);
    await expect(owner).toHaveAttribute(attribute, first);
    await page.clock.fastForward(1);
    await expect(owner).toHaveAttribute(attribute, next);
  });
}
