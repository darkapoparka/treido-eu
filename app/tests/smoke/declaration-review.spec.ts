import { expect, test } from "@playwright/test";

// These production smoke modes intentionally have no qualified Clerk/database
// bindings. They must never expose an actionable operator surface or private
// declaration facts, including when reference mode is requested.
const cases = [
  {
    language: "en",
    title: "Trader declarations",
    detail: "Review trader declaration",
    unavailable:
      "Declaration review is temporarily unavailable. Your input is retained.",
    width: 1440,
  },
  {
    language: "bg",
    title: "Декларации на търговци",
    detail: "Преглед на декларация",
    unavailable: "Прегледът временно не е достъпен. Въведеното е запазено.",
    width: 320,
  },
] as const;

for (const entry of cases) {
  for (const detail of [false, true]) {
    test(`${entry.language} unconfigured declaration ${detail ? "detail" : "queue"} fails closed`, async ({
      page,
    }) => {
      const errors: string[] = [];
      const writes: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (request.method() === "POST") writes.push(request.url());
      });
      await page.setViewportSize({ width: entry.width, height: 1000 });
      const route = detail
        ? "/ops/declarations/00000000-0000-4000-8000-000000000001"
        : "/ops/declarations";
      const response = await page.goto(`${route}?lang=${entry.language}`);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", {
          name: detail ? entry.detail : entry.title,
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole("status")).toHaveText(entry.unavailable);
      await expect(page.locator("main form")).toHaveCount(0);
      await expect(page.locator("main textarea")).toHaveCount(0);
      await expect(page.locator("main dl")).toHaveCount(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(entry.width);
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
