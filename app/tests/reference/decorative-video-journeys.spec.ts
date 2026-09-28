import { expect, test } from "@playwright/test";
import { useReferenceScenario } from "./helpers";

test("allowlisted local video supports seeking and rejects unknown assets", async ({
  request,
}) => {
  const path = "/api/reference-video/kitsch-hero";
  const head = await request.head(path);
  expect(head.status()).toBe(200);
  expect(head.headers()["content-type"]).toBe("video/mp4");
  expect(head.headers()["content-length"]).toBe("1913702");
  const start = await request.get(path, { headers: { Range: "bytes=0-63" } });
  expect(start.status()).toBe(206);
  expect(start.headers()["content-range"]).toBe("bytes 0-63/1913702");
  expect((await start.body()).byteLength).toBe(64);
  const suffix = await request.get(path, { headers: { Range: "bytes=-16" } });
  expect(suffix.status()).toBe(206);
  expect((await suffix.body()).byteLength).toBe(16);
  expect(
    (
      await request.get(path, { headers: { Range: "bytes=1913702-" } })
    ).status(),
  ).toBe(416);
  expect((await request.get("/api/reference-video/toString")).status()).toBe(
    404,
  );
  expect((await request.get("/api/reference-video/unknown")).status()).toBe(
    404,
  );
});

test("Kitsch plays only while visible and reduced motion restores the poster", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/stores/kitsch");
  const video = page.locator('video[data-video-key="kitsch-hero"]');
  await expect(video).toHaveAttribute("data-video-ready", "true");
  await video.evaluate((element: HTMLVideoElement) => {
    element.currentTime = 4;
    element.addEventListener("loadstart", () => {
      element.dataset.reloaded = "true";
    });
  });
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.seeking))
    .toBe(false);
  const originalSource = await video.getAttribute("src");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await expect(video).toHaveAttribute("src", originalSource!);
  await expect(video).not.toHaveAttribute("data-reloaded", "true");
  expect(
    await video.evaluate((element: HTMLVideoElement) => element.currentTime),
  ).toBeGreaterThanOrEqual(4);
  await video.evaluate((element: HTMLVideoElement) => {
    element.currentTime = 4;
  });
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
  const pausedTime = await video.evaluate(
    (element: HTMLVideoElement) => element.currentTime,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);
  expect(
    await video.evaluate((element: HTMLVideoElement) => element.currentTime),
  ).toBeGreaterThanOrEqual(pausedTime);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(video).toHaveCount(0);
  await expect(page.locator(".store-hero-kitsch")).toHaveCSS(
    "background-image",
    /store-kitsch-followed-hero/,
  );
});

test("Sol decorative layers share one non-looping timeline and stop for permission", async ({
  page,
}) => {
  await useReferenceScenario(page, "home-welcome");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/minis/sol");
  await page.getByRole("button", { name: /Continue without/ }).click();
  const top = page.locator('video[data-video-key="sol-welcome-motion"]');
  const left = page.locator(
    'video[data-video-key="sol-welcome-lower-left-motion"]',
  );
  const right = page.locator(
    'video[data-video-key="sol-welcome-lower-right-motion"]',
  );
  await expect(top).toHaveAttribute("data-video-ready", "true");
  await expect(left).toHaveAttribute("data-video-ready", "true");
  await expect(right).toHaveAttribute("data-video-ready", "true");
  expect(await top.evaluate((element: HTMLVideoElement) => element.loop)).toBe(
    false,
  );
  await top.evaluate((element: HTMLVideoElement) => {
    element.currentTime = 4.8;
  });
  await expect
    .poll(async () =>
      Math.abs(
        (await top.evaluate(
          (element: HTMLVideoElement) => element.currentTime,
        )) -
          (await left.evaluate(
            (element: HTMLVideoElement) => element.currentTime,
          )),
      ),
    )
    .toBeLessThan(0.15);
  await expect
    .poll(async () =>
      Math.abs(
        (await top.evaluate(
          (element: HTMLVideoElement) => element.currentTime,
        )) -
          (await right.evaluate(
            (element: HTMLVideoElement) => element.currentTime,
          )),
      ),
    )
    .toBeLessThan(0.15);
  const settledMask = await right.evaluate((element) => element.style.clipPath);
  for (const seconds of [0.15, 7.15]) {
    await page
      .locator(".sol-welcome video")
      .evaluateAll(async (elements, time) => {
        const videos = elements as HTMLVideoElement[];
        await Promise.all(
          videos.map(
            (video) =>
              new Promise<void>((resolve) => {
                video.pause();
                video.addEventListener("seeked", () => resolve(), {
                  once: true,
                });
                video.currentTime = time;
              }),
          ),
        );
        videos.forEach((video) => video.pause());
      }, seconds);
    await expect
      .poll(() => right.evaluate((element) => element.style.clipPath))
      .not.toBe(settledMask);
    await expect(right).toHaveAttribute("data-video-ready", "true");
    await page.screenshot({
      path: test.info().outputPath(`sol-right-flip-${seconds}.png`),
    });
  }
  await page
    .getByRole("button", { name: "Allow & Continue ›", exact: true })
    .click();
  await expect(top).toHaveCount(0);
  await expect(
    page.locator('img[src="/api/reference-media/sol-welcome-permission-art"]'),
  ).toBeVisible();
});

test("captured and failed video states retain existing artwork", async ({
  page,
}) => {
  await useReferenceScenario(page, "onboarding-new");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/onboarding?step=updates&reference=captured");
  await expect(page.locator("[data-tracking-demo]")).toHaveAttribute(
    "data-tracking-demo",
    "Delivered",
  );
  await expect(page.locator("video")).toHaveCount(0);
  await page.route("**/api/reference-video/*", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/onboarding?step=updates");
  await expect(page.locator(".tracking-parcel")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((element: HTMLVideoElement) => element.error?.code),
    )
    .toBeTruthy();
  await expect(page.locator("video")).not.toHaveAttribute(
    "data-video-ready",
    "true",
  );
  await expect(page.locator(".tracking-parcel")).toBeVisible();
});
