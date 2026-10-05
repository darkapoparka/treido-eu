/* global document, window, innerWidth -- These callbacks execute in the browser. */
import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { URL } from "node:url";

/** Runs only against the existing loopback/native-PostgreSQL component harness. */
export async function runProductManagementChecks({
  origin,
  sellerId,
  emptyId,
  output,
}) {
  const target = new URL(origin);
  if (
    target.protocol !== "http:" ||
    target.hostname !== "127.0.0.1" ||
    !target.port
  )
    throw new Error("Owned loopback harness required");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const checks = [],
    pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const check = async (name, run) => {
    try {
      await run();
      checks.push({ name, result: "PASS" });
    } catch (error) {
      checks.push({ name, result: "FAIL", error: error.message });
      throw error;
    }
  };
  const list = (extra = "", seller = sellerId) =>
    origin + "/app/sellers/" + seller + "/listings?lang=en" + extra;
  const rows = () => page.locator("table tbody tr");
  const selected = (name) =>
    page.getByRole("checkbox", { name: "Select " + name, exact: true });
  const dialog = () => page.getByRole("dialog");
  const ready = async () => {
    await page.locator("table").waitFor();
    await page.evaluate(() => document.fonts.ready);
  };
  try {
    await page.goto(list());
    await ready();
    await check(
      "real authorized product index renders four saved fixture products",
      async () => {
        await expect(rows()).toHaveCount(4);
        await expect(
          page.getByText("0 selected", { exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: join(output, "products-desktop.png"),
          animations: "disabled",
        });
      },
    );
    await check("selection does not navigate into the editor", async () => {
      await selected("Blue jacket").check();
      await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
      expect(page.url()).toBe(list());
    });
    await check(
      "duplicate confirmation cancels with Escape and returns focus",
      async () => {
        const button = page.getByRole("button", {
          name: "Duplicate as draft",
          exact: true,
        });
        await button.click();
        await expect(dialog()).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog()).not.toBeVisible();
        await expect(button).toBeFocused();
        await expect(rows()).toHaveCount(4);
      },
    );
    await check(
      "a lost duplicate acknowledgement offers the same-request retry",
      async () => {
        await page.route(
          "**/__duplicate",
          async (route) => {
            await route.fetch();
            await route.abort("failed");
          },
          { times: 1 },
        );
        await page
          .getByRole("button", { name: "Duplicate as draft", exact: true })
          .click();
        await dialog()
          .getByRole("button", { name: "Create draft", exact: true })
          .click();
        await expect(dialog().getByRole("alert")).toContainText(
          "Retry the same request",
        );
      },
    );
    await check(
      "retry opens one persisted duplicate with original price and unconfirmed condition",
      async () => {
        await dialog()
          .getByRole("button", { name: "Retry this request", exact: true })
          .click();
        await page.waitForURL("**/edit?lang=en");
        await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
          "Blue jacket",
        );
        const draft = await page.evaluate(() => window.__initial.draft);
        expect(draft.payload.priceMinor).toBe(4900);
        expect(draft.payload.condition).toBe("");
        expect(draft.revision).toBe(1);
        await page.reload();
        await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
          "Blue jacket",
        );
      },
    );
    await check(
      "duplicate and original remain distinct after list reload",
      async () => {
        await page.goto(list());
        await ready();
        await expect(rows()).toHaveCount(5);
        await expect(
          page.getByRole("link", { name: "Blue jacket", exact: true }),
        ).toHaveCount(2);
      },
    );
    await check(
      "select-all is page-local and clear selection restores the table",
      async () => {
        await page
          .getByRole("checkbox", {
            name: "Select all products on this page",
            exact: true,
          })
          .check();
        await expect(
          page.getByText("5 selected", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Duplicate as draft", exact: true }),
        ).toBeDisabled();
        await page
          .getByRole("button", { name: "Clear selection", exact: true })
          .click();
        await expect(
          page.getByText("0 selected", { exact: true }),
        ).toBeVisible();
      },
    );
    await check(
      "bulk withdrawal reports confirmed and stale-state rows separately",
      async () => {
        await selected("Published acceptance product").check();
        await selected("100%_ literal product").check();
        await page
          .getByRole("button", { name: "Withdraw selected", exact: true })
          .click();
        await dialog()
          .getByRole("button", { name: "Confirm withdrawal", exact: true })
          .click();
        await expect(dialog()).not.toBeVisible();
        await expect(
          page.getByText("Withdrawn: 1 of 2.", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("region", { name: "Withdrawal results" }),
        ).toContainText("This product changed");
        await expect(
          rows().filter({ hasText: "Published acceptance product" }),
        ).toContainText("Withdrawn");
        await expect(
          page.getByText("1 selected", { exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: join(output, "withdrawal-results-desktop.png"),
          animations: "disabled",
        });
      },
    );
    await check(
      "retry retains the unresolved row without repeating the successful withdrawal",
      async () => {
        await page
          .getByRole("button", {
            name: "Retry unsuccessful items",
            exact: true,
          })
          .click();
        await dialog()
          .getByRole("button", { name: "Confirm withdrawal", exact: true })
          .click();
        await expect(
          page.getByText("Withdrawn: 0 of 1.", { exact: true }),
        ).toBeVisible();
        await expect(
          rows().filter({ hasText: "Published acceptance product" }),
        ).toContainText("Withdrawn");
        await page
          .getByRole("button", { name: "Reload list", exact: true })
          .click();
        await expect(
          page.getByText("0 selected", { exact: true }),
        ).toBeVisible();
      },
    );
    await check(
      "literal search still finds percent/underscore without changing results ownership",
      async () => {
        await page.goto(list("&q=%25_"));
        await ready();
        await expect(rows()).toHaveCount(1);
        await expect(rows()).toContainText("100%_ literal product");
      },
    );
    for (const width of [320, 393])
      for (const large of [false, true]) {
        await check(
          "Bulgarian product selection and dialog at " +
            width +
            (large ? " doubled text" : " normal text"),
          async () => {
            await page.setViewportSize({ width, height: 793 });
            await page.goto(
              list(large ? "&test-text=200" : "").replace("lang=en", "lang=bg"),
            );
            await ready();
            await page
              .getByRole("checkbox", {
                name: "Избери Телефон за преглед",
                exact: true,
              })
              .check();
            await page
              .getByRole("button", {
                name: "Дублирай като чернова",
                exact: true,
              })
              .click();
            await expect(dialog()).toBeVisible();
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            const bounds = await dialog().boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
            await page.screenshot({
              path: join(
                output,
                "product-dialog-bg-" + width + (large ? "-large" : "") + ".png",
              ),
              animations: "disabled",
            });
            await page.keyboard.press("Escape");
            await expect(dialog()).not.toBeVisible();
          },
        );
      }
    await check(
      "multi-product copying replays a lost response without creating duplicate drafts",
      async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(list());
        await ready();
        const before = await rows().count();
        await selected("Телефон за преглед").check();
        await selected("100%_ literal product").check();
        await page
          .getByRole("button", {
            name: "Duplicate selected as drafts",
            exact: true,
          })
          .click();
        await expect(dialog()).toBeVisible();
        await page.route(
          "**/__duplicate-many",
          async (route) => {
            await route.fetch();
            await route.abort("failed");
          },
          { times: 1 },
        );
        await dialog()
          .getByRole("button", { name: "Create drafts", exact: true })
          .click();
        await expect(dialog().getByRole("alert")).toContainText(
          "Retry this request",
        );
        await dialog()
          .getByRole("button", { name: "Retry this request", exact: true })
          .click();
        await expect(dialog()).not.toBeVisible();
        await expect(
          page.getByRole("region", { name: "Copy results" }),
        ).toContainText("Drafts created: 2 of 2.");
        await expect(
          page.getByRole("region", { name: "Copy results" }).getByRole("link"),
        ).toHaveCount(2);
        await expect(rows()).toHaveCount(before + 2);
        await page.screenshot({
          path: join(output, "bulk-copy-results-desktop.png"),
          animations: "disabled",
        });
        await page.reload();
        await ready();
        await expect(rows()).toHaveCount(before + 2);
      },
    );
    await check(
      "switching to the other seller shows its own empty catalog",
      async () => {
        await page.goto(list("", emptyId));
        await expect(
          page.getByRole("heading", { name: "Add your products", exact: true }),
        ).toBeVisible();
        await expect(page.locator("table")).toHaveCount(0);
        await expect(
          page.getByText("Blue jacket", { exact: true }),
        ).toHaveCount(0);
      },
    );
    await check(
      "component browser has no uncaught application errors",
      async () => {
        expect(pageErrors).toEqual([]);
      },
    );
    return { checks: checks.length };
  } finally {
    await writeFile(
      join(output, "product-management-checks.json"),
      JSON.stringify(
        {
          browser: browser.version(),
          checks,
          pageErrors,
          scope:
            "Actual components and native PostgreSQL, synthetic identity/action transport; not live Clerk/Neon.",
        },
        null,
        2,
      ),
    );
    await browser.close();
  }
}
