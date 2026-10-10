import { URL } from "node:url";
import { randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { join } from "node:path";
import console from "node:console";
import { runMarketplaceBrowser } from "./marketplace-flow-browser.mjs";
export async function runImportBrowser({
  database,
  owner,
  sellerId,
  csv,
  api,
  drain,
}) {
  const identityForRequest = (request) =>
    /(?:^|;\s*)csv-actor=owner(?:;|$)/.test(request.headers.cookie ?? "")
      ? owner
      : null;
  const catalogue = {
    database,
    api,
    identityForRequest,
    async readInitial(request, url) {
      const actor = identityForRequest(request);
      if (!actor) throw Error("No test identity");
      const common = {
        actorSubject: actor.subject,
        adminSeller: await api.readSellerContext(database, actor, sellerId),
      };
      const base = "/app/sellers/" + sellerId;
      if (url.pathname === base + "/imports")
        return {
          ...common,
          importIndex: await api.readCatalogueImports(database, actor, {
            sellerId,
          }),
        };
      if (url.pathname.startsWith(base + "/imports/"))
        return {
          ...common,
          importDetail: await api.readCatalogueImport(database, actor, {
            sellerId,
            importId: url.pathname.split("/").at(-1),
            after: Number(url.searchParams.get("after") ?? 0),
          }),
        };
      if (url.pathname === base + "/inventory")
        return {
          ...common,
          inventoryIndex: await api.readInventoryIndex(
            database,
            actor,
            sellerId,
            Object.fromEntries(url.searchParams),
          ),
        };
      return null;
    },
  };
  await runMarketplaceBrowser({
    database,
    fixtures: [],
    key: randomBytes(32),
    marker: "csv-flow",
    api,
    catalogue,
    inventory: {
      database,
      api,
      identityForRequest,
      readInitial: async () => null,
    },
    evidenceName: "t42-import-browser",
    async scenario({ context, page, origin, out, expect, errors }) {
      const base = "/app/sellers/" + sellerId;
      await context.addCookies([
        { name: "csv-actor", value: "owner", url: origin },
      ]);
      await page.goto(origin + base + "/imports?lang=en");
      await expect(
        page.getByRole("heading", { name: "Import products", exact: true }),
      ).toBeVisible();
      await page.locator("input[type=file]").setInputFiles({
        name: "catalogue.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv, "utf8"),
      });
      await page
        .getByRole("button", { name: "Upload and review", exact: true })
        .click();
      await expect(page.locator("[data-import-row]")).toHaveCount(2);
      await expect(page.locator('[data-import-row="2"]')).toContainText(
        "Invalid row",
      );
      await page
        .locator('[data-import-row="2"]')
        .getByRole("button", { name: "Edit row", exact: true })
        .click();
      await page.locator("dialog[open] input[name=price]").fill("140.25");
      await page.screenshot({ path: join(out, "row-edit-en.png") });
      await page.getByRole("button", { name: "Save row", exact: true }).click();
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await page
        .getByRole("button", {
          name: "Select the first 2 valid rows",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("checkbox", { name: "Select row 2", exact: true }),
      ).toBeChecked();
      await page.reload();
      await expect(
        page.getByRole("checkbox", { name: "Select row 2", exact: true }),
      ).toBeChecked();
      await page
        .getByRole("button", { name: "Create selected drafts", exact: true })
        .click();
      await expect(page.locator("[data-catalogue-import]")).toContainText(
        "Waiting for processing",
      );
      const importId = new URL(page.url()).pathname.split("/").at(-1);
      await drain({ sellerId, importId });
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await expect(page.locator("[data-import-row] a")).toHaveCount(2);
      await expect(page.locator("[data-catalogue-import]")).toContainText(
        "Finished",
      );
      for (const width of [319, 393, 1440]) {
        await page.setViewportSize({ width, height: 850 });
        await page.goto(origin + base + "/imports/" + importId + "?lang=bg");
        await expect(page.locator("[data-import-row] a")).toHaveCount(2);
        await page.evaluate(() => globalThis.document.fonts.ready);
        expect(
          await page
            .locator("[data-catalogue-import] > section")
            .evaluateAll((cards) =>
              cards.every(
                (card) =>
                  card.getBoundingClientRect().right <= globalThis.innerWidth &&
                  card.getBoundingClientRect().left >= 0,
              ),
            ),
        ).toBe(true);
        expect(
          await page.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: join(out, "import-bg-" + width + ".png"),
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 393, height: 850 });
      await page.goto(origin + base + "/inventory?lang=en");
      await expect(page.locator("[data-inventory-index] tbody tr")).toHaveCount(
        2,
      );
      await page
        .locator("[data-inventory-index] tbody tr")
        .first()
        .getByRole("button", { name: "Adjust stock", exact: true })
        .click();
      await page.getByLabel("On hand", { exact: true }).fill("7");
      await page
        .getByLabel("Reason", { exact: true })
        .fill("Counted stock at warehouse");
      await page
        .locator("dialog[open]")
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await page.reload();
      await expect(
        page.locator("[data-inventory-index] tbody tr").first(),
      ).toContainText("7");
      await page
        .getByRole("checkbox", {
          name: "Select inventory on this page",
          exact: true,
        })
        .check();
      await page
        .getByRole("button", { name: "Adjust selected stock", exact: true })
        .click();
      await page.locator("dialog[open] input[type=number]").nth(0).fill("9");
      await page.locator("dialog[open] input[type=number]").nth(1).fill("11");
      await page
        .getByLabel("Reason", { exact: true })
        .fill("Full warehouse recount");
      await page.screenshot({ path: join(out, "bulk-stock-en-393.png") });
      await page.setViewportSize({ width: 319, height: 850 });
      expect(
        await page
          .locator("dialog[open]")
          .evaluate(
            (dialog) =>
              dialog.getBoundingClientRect().left >= 0 &&
              dialog.getBoundingClientRect().right <= globalThis.innerWidth,
          ),
      ).toBe(true);
      await page
        .locator("dialog[open]")
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await page.reload();
      await expect(
        page.locator("[data-inventory-index] tbody tr").first(),
      ).toContainText("9");
      await expect(
        page.locator("[data-inventory-index] tbody tr").nth(1),
      ).toContainText("11");
      const downloadEvent = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export this page", exact: true })
        .click();
      const exported = await downloadEvent,
        stream = await exported.createReadStream();
      let exportedCsv = "";
      for await (const chunk of stream) exportedCsv += chunk.toString("utf8");
      expect(exportedCsv).toContain("on_hand");
      expect(exportedCsv).toContain('"9"');
      expect(exportedCsv).toContain('"11"');
      for (const width of [319, 1440]) {
        await page.setViewportSize({ width, height: 850 });
        await page.goto(origin + base + "/inventory?lang=bg");
        await page.evaluate(() => globalThis.document.fonts.ready);
        expect(
          await page.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: join(out, "seller-stock-bg-" + width + ".png"),
          fullPage: true,
        });
      }
      await page.evaluate(() => {
        globalThis.__marketplace.actorSubject = "user_changed_context";
        globalThis.dispatchEvent(new globalThis.Event("focus"));
      });
      await expect(page.locator("[data-inventory-index]")).toBeHidden();
      await page.goto(origin + base + "/imports/" + importId + "?lang=en");
      await page.evaluate(() => {
        globalThis.__marketplace.actorSubject = "user_changed_context";
        globalThis.dispatchEvent(new globalThis.Event("focus"));
      });
      await expect(page.locator("[data-catalogue-import]")).toBeHidden();
      expect(errors).toEqual([]);
      console.log(
        "CSV and seller-stock browser passed: actual upload, validation, row correction, selection/reload, durable batch processing, created draft links and stock adjustment/reload; BG/EN 319/393/1440 layouts. Synthetic Clerk transport and native PostgreSQL, not provider acceptance.",
      );
    },
  });
}
