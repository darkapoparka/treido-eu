import { expect, test, type Page } from "@playwright/test";

async function dockState(page: Page) {
  return page.locator(".floating-nav a").evaluateAll((links) =>
    links.map((link) => {
      const icon = link.querySelector("svg")!;
      const style = getComputedStyle(icon),
        box = icon.getBoundingClientRect();
      return {
        kind: link.getAttribute("data-nav-kind"),
        label: link.getAttribute("aria-label"),
        current: link.getAttribute("aria-current"),
        metrics: {
          width: style.width,
          height: style.height,
          color: style.color,
          transform: style.transform,
          stroke: style.strokeWidth,
          x: box.x,
          y: box.y,
          boxWidth: box.width,
          boxHeight: box.height,
        },
      };
    }),
  );
}
for (const width of [320, 393, 1440])
  for (const large of [false, true]) {
    test(
      "dock keeps geometry across BG/EN at " +
        width +
        (large ? " with large text" : ""),
      async ({ page }, info) => {
        await page.setViewportSize({
          width,
          height: width === 1440 ? 900 : 793,
        });
        const states: Awaited<ReturnType<typeof dockState>>[] = [];
        for (const language of ["en", "bg"]) {
          await page.goto("/?lang=" + language);
          await expect(page.locator(".floating-nav")).toBeVisible();
          await expect(
            page.locator('[data-shop-interactive="true"]').first(),
          ).toBeAttached();
          await page.evaluate(() => document.fonts.ready);
          if (large)
            await page.addStyleTag({
              content: ".floating-nav { font-size: 200%; }",
            });
          const state = await dockState(page);
          expect(state.length).toBeGreaterThanOrEqual(3);
          expect(state.every((item) => !!item.kind && !!item.label)).toBe(true);
          expect(state.find((item) => item.kind === "home")?.label).toBe(
            language === "bg" ? "Начало" : "Home",
          );
          states.push(state);
          await info.attach("dock-" + language, {
            body: await page
              .locator(".floating-dock")
              .screenshot({ animations: "disabled" }),
            contentType: "image/png",
          });
        }
        expect(
          states[1].map(({ kind, current, metrics }) => ({
            kind,
            current,
            metrics,
          })),
        ).toEqual(
          states[0].map(({ kind, current, metrics }) => ({
            kind,
            current,
            metrics,
          })),
        );
        await page.locator('.floating-nav a[data-nav-kind="home"]').focus();
        await expect(
          page.locator('.floating-nav a[data-nav-kind="home"]'),
        ).toBeFocused();
        expect(
          new URL(
            (await page
              .locator('.floating-nav a[data-nav-kind="home"]')
              .getAttribute("href")) ?? "/",
            page.url(),
          ).searchParams.get("lang"),
        ).toBe("bg");
      },
    );
  }
