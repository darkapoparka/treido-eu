import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { runMarketplaceBrowser } from "./marketplace-flow-browser.mjs";
/** Full controls on real native database rows, synthetic verified identity only. */
export async function runLibraryBrowser({ database, fixture, identity, api }) {
  await runMarketplaceBrowser({
    database,
    fixtures: [fixture],
    key: new Uint8Array(32),
    marker: "",
    api,
    library: { database, identity, api },
    evidenceName: "t41-library-browser",
    scenario: async ({ page, context, origin, out, expect, errors }) => {
      const product = "/products/" + fixture.draft.id;
      page.setDefaultTimeout(10000);
      await page.goto(origin + product + "?lang=en");
      const save = page.getByRole("button", {
        name: "Save Телефон за тест",
        exact: true,
      });
      await expect(save).toBeEnabled();
      await save.click();
      await expect(
        page.getByRole("button", {
          name: "Remove from Saved Телефон за тест",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.reload();
      await expect(
        page.getByRole("button", {
          name: "Remove from Saved Телефон за тест",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Follow", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Unfollow", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page
        .getByRole("button", { name: "Save to collection", exact: true })
        .click();
      const picker = page.locator("dialog[open]");
      await picker.getByLabel("Collection name", { exact: true }).fill("Gifts");
      await picker
        .getByRole("button", { name: "Create collection", exact: true })
        .click();
      await expect(
        picker.getByRole("button", { name: /Gifts/ }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({ path: join(out, "collection-picker-en.png") });
      await page.keyboard.press("Escape");
      await page.goto(origin + "/saved?lang=en");
      await expect(page.locator(".saved-product")).toHaveCount(1);
      await expect(page.locator(".collection-tile")).toHaveCount(1);
      await page.locator(".collection-tile").click();
      await expect(page.locator("h1")).toHaveText("Gifts");
      await page
        .getByRole("button", { name: "Collection options", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Edit name", exact: true })
        .click();
      await page
        .getByLabel("Collection name", { exact: true })
        .fill("Birthday gifts");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(page.locator("h1")).toHaveText("Birthday gifts");
      await page
        .getByRole("button", {
          name: "Remove from this collection",
          exact: true,
        })
        .click();
      await expect(page.locator(".saved-product")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Add from Saved", exact: true })
        .click();
      await expect(page.locator(".saved-product")).toHaveCount(1);
      await page
        .getByRole("button", {
          name: "Save to collection Телефон за тест",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Remove from this collection Телефон за тест",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.locator(".saved-selection-done").click();
      await expect(page.locator(".saved-product")).toHaveCount(1);
      for (const width of [320, 393, 1440]) {
        await page.setViewportSize({ width, height: 850 });
        expect(
          await page.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth,
          ),
        ).toBe(true);
        if (width !== 320)
          await page.screenshot({
            path: join(out, "saved-" + width + ".png"),
            fullPage: true,
          });
      }
      const collectionUrl = page.url();
      await page.goto(collectionUrl.replace("lang=en", "lang=bg"));
      await expect(
        page.getByRole("button", { name: "Добави от Запазени", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: join(out, "collection-bg.png"),
        fullPage: true,
      });
      await page.goto(origin + "/following?lang=en");
      await expect(
        page.getByRole("link", { name: /Publication test store/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Unfollow", exact: true }).click();
      await expect(
        page.getByRole("heading", {
          name: "You aren't following any sellers yet",
          exact: true,
        }),
      ).toBeVisible();
      await page.goto(collectionUrl);
      // A second tab uses its own controller and receives invalidation, not copied browser data.
      const another = await context.newPage();
      await another.goto(origin + "/saved?lang=en");
      await expect(another.locator(".saved-product")).toHaveCount(1);
      await another
        .getByRole("button", {
          name: "Remove from Saved Телефон за тест",
          exact: true,
        })
        .click();
      await expect(another.locator(".saved-product")).toHaveCount(0);
      await page.bringToFront();
      await expect(page.locator(".saved-product")).toHaveCount(0);
      await another.close();
      await page
        .getByRole("button", { name: "Collection options", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Delete collection", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "The items will remain in Saved.",
      );
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.locator(".collection-tile")).toHaveCount(0);
      expect(
        (await api.readLibrary(database, identity, { view: "saved" }))
          .savedCount,
      ).toBe(0);
      // Backend changes outside this browser still refresh correctly on a fresh device connection.
      const current = await api.readLibrary(database, identity, {});
      await api.changeLibrary(database, identity, {
        requestId: randomUUID(),
        expectedRevision: current.revision,
        actorKey: current.actorKey,
        operation: { kind: "save", listingId: fixture.draft.id, saved: true },
      });
      await page.reload();
      await expect(page.locator(".saved-product")).toHaveCount(1);
      expect(errors).toEqual([]);
      globalThis.console.log(
        "Buyer library browser: real save/reload, seller follow/unfollow, atomic collection creation, rename, selection, removal, delete, BG/EN, 320/393/1440 layouts and cross-tab/account reload persistence passed. Synthetic identity; no live Clerk or storage-provider acceptance claimed.",
      );
    },
  });
}
