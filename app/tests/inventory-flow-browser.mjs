import { randomBytes } from "node:crypto";
import { join } from "node:path";
import console from "node:console";
import { runMarketplaceBrowser } from "./marketplace-flow-browser.mjs";
/** One connected UI journey using actual stock/cart/offer use cases and native PostgreSQL. */
export async function runInventoryBrowser({
  database,
  fixture,
  owner,
  buyer,
  api,
}) {
  const identityForRequest = (request) =>
    /(?:^|;\s*)stock-actor=owner(?:;|$)/.test(request.headers.cookie ?? "")
      ? owner
      : /(?:^|;\s*)stock-actor=buyer(?:;|$)/.test(request.headers.cookie ?? "")
        ? buyer
        : null;
  let threadId;
  const inventory = {
    database,
    api,
    identityForRequest,
    async readInitial(request, url) {
      const identity = identityForRequest(request);
      if (url.pathname === "/__stock/editor")
        return {
          actorSubject: identity?.subject,
          inventoryEditor: await api.readInventory(database, identity, {
            sellerId: fixture.sellerId,
            listingId: fixture.draft.id,
          }),
          adminSeller: await api.readSellerContext(
            database,
            identity,
            fixture.sellerId,
          ),
        };
      if (url.pathname === "/__stock/offers") {
        const sellerId =
          identity?.subject === owner.subject ? fixture.sellerId : null;
        const conversation = await api.readConversation(database, identity, {
          sellerId,
          threadId,
        });
        return {
          actorSubject: identity.subject,
          offers: { threadId, sellerId },
          offerMessages: conversation.messages.flatMap((message) =>
            message.offer ? [message.offer] : [],
          ),
        };
      }
      if (url.pathname === "/cart")
        return {
          actorSubject: identity?.subject,
          cart: await api.readBuyerCart(database, identity),
        };
      if (url.pathname === "/products/" + fixture.draft.id) {
        const listing = await api.readPublishedListing(
          database,
          fixture.draft.id,
        );
        return {
          actorSubject: identity?.subject,
          listing,
          paymentEntryAvailable: await api.readPaymentEntry(listing),
          inventory: await api.readPublicInventory(
            database,
            fixture.draft.id,
            listing.revision,
          ),
        };
      }
      return null;
    },
  };
  await runMarketplaceBrowser({
    database,
    fixtures: [fixture],
    key: randomBytes(32),
    marker: "stock-journey",
    api,
    inventory,
    evidenceName: "t42-stock-browser",
    async scenario({ context, page, origin, out, expect, errors }) {
      const actor = async (value, path) => {
        await context.addCookies([{ name: "stock-actor", value, url: origin }]);
        await page.goto(origin + path);
      };
      const button = (name) => page.getByRole("button", { name, exact: true });
      const modal = () => page.locator("dialog[open]");
      await actor("owner", "/__stock/editor?lang=en");
      await button("Set up inventory").click();
      await page
        .getByLabel("Inventory type", { exact: true })
        .selectOption("stocked");
      await page.getByLabel("On hand", { exact: true }).fill("3");
      await modal().getByRole("button", { name: "Save", exact: true }).click();
      await expect(modal()).toHaveCount(0);
      await expect(page.locator("[data-sku-id]")).toHaveCount(1);
      await button("Edit variant").click();
      await page
        .getByLabel("Variant price · EUR", { exact: true })
        .fill("129.00");
      await button("Add option").click();
      await page.getByLabel("Option name", { exact: true }).fill("Color");
      await page.getByLabel("Option value", { exact: true }).fill("Black");
      // Recheck foreground access without throwing away a partly entered variant.
      await page.evaluate(() => globalThis.dispatchEvent(new Event("blur")));
      await page.evaluate(() => globalThis.dispatchEvent(new Event("focus")));
      await expect(
        page.getByLabel("Option value", { exact: true }),
      ).toHaveValue("Black");
      await modal().getByRole("button", { name: "Save", exact: true }).click();
      await expect(modal()).toHaveCount(0);
      await button("Add variant").click();
      await page
        .getByLabel("Variant price · EUR", { exact: true })
        .fill("149.00");
      await page.getByLabel("Option value", { exact: true }).fill("White");
      await page.getByLabel("On hand", { exact: true }).fill("2");
      await page.screenshot({ path: join(out, "variant-sheet-en.png") });
      await modal().getByRole("button", { name: "Save", exact: true }).click();
      await expect(modal()).toHaveCount(0);
      await expect(page.locator("[data-sku-id]")).toHaveCount(2);
      await page.reload();
      await expect(page.locator("[data-sku-id]")).toHaveCount(2);
      const saved = await api.readInventory(database, owner, {
        sellerId: fixture.sellerId,
        listingId: fixture.draft.id,
      });
      const black = saved.skus.find((sku) => sku.options.Color === "Black");
      expect(black.onHand).toBe(3);
      expect(
        saved.skus.find((sku) => sku.options.Color === "White").onHand,
      ).toBe(2);
      const publication = await api.publishListing(database, owner, {
        ...fixture.input,
        expectedRevision: saved.listingRevision,
      });
      await actor("buyer", "/products/" + fixture.draft.id + "?lang=en");
      // Publication alone is contact-only. Enable only through the same native
      // registry read as production, never a hardcoded browser success flag.
      await expect(button("Add to cart")).toHaveCount(0);
      await expect(page.getByText("Arrange payment and handover directly with the seller.", { exact: false })).toBeVisible();
      await api.approvePaymentEntry(publication.revision);
      await page.reload();
      await page
        .getByLabel("Choose a variant", { exact: true })
        .selectOption(black.id);
      await page.getByLabel("Quantity", { exact: true }).fill("2");
      await button("Add to cart").click();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Added to your account cart." }),
      ).toBeVisible();
      await page.goto(origin + "/cart?lang=en");
      await expect(page.locator("[data-cart-sku]")).toHaveCount(1);
      await page.getByRole("button", { name: /^Decrease quantity / }).click();
      await expect(page.getByLabel("Quantity", { exact: true })).toHaveText("1");
      await page.reload();
      await expect(page.getByLabel("Quantity", { exact: true })).toHaveText("1");
      expect(
        (await api.readPublicInventory(database, fixture.draft.id)).skus.find(
          (sku) => sku.id === black.id,
        ).available,
      ).toBe(3);
      await api.revokePaymentEntry();
      await page.goto(origin + "/products/" + fixture.draft.id + "?lang=en");
      await expect(button("Add to cart")).toHaveCount(0);
      threadId = (
        await api.openListingConversation(database, buyer, fixture.draft.id)
      ).id;
      await page.goto(origin + "/__stock/offers?lang=en");
      await button("Make an offer").click();
      await page.getByLabel("Variant", { exact: true }).selectOption(black.id);
      await page
        .getByLabel("Price per item · EUR", { exact: true })
        .fill("120");
      await modal()
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(page.locator("[data-offer-id]")).toHaveCount(1);
      await expect(modal()).toHaveCount(0);
      await actor("owner", "/__stock/offers?lang=en");
      await button("Counter offer").click();
      await page
        .getByLabel("Price per item · EUR", { exact: true })
        .fill("125");
      await modal()
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(page.locator("[data-offer-id]")).toHaveCount(2);
      await actor("buyer", "/__stock/offers?lang=en");
      await button("Accept offer").click();
      await expect(modal()).toContainText("It does not collect payment");
      await page.screenshot({ path: join(out, "accept-offer-en.png") });
      await modal()
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(modal()).toHaveCount(0);
      await expect(page.locator("[data-offer-id]").first()).toContainText(
        "Accepted terms",
      );
      await page.reload();
      await expect(page.locator("[data-offer-messages]")).toContainText(
        "Offer accepted",
      );
      expect(
        (await api.readPublicInventory(database, fixture.draft.id)).skus.find(
          (sku) => sku.id === black.id,
        ).available,
      ).toBe(2);
      for (const width of [319, 393, 1440]) {
        await page.setViewportSize({ width, height: 850 });
        await page.goto(origin + "/__stock/offers?lang=bg");
        await expect(page.locator("[data-offer-id]").first()).toContainText(
          "Приети условия",
        );
        expect(
          await page.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: join(out, "offers-bg-" + width + ".png"),
          fullPage: true,
        });
        await page.goto(origin + "/cart?lang=bg");
        await expect(
          page.getByRole("heading", { name: "Количка", exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: join(out, "cart-bg-" + width + ".png"),
          fullPage: true,
        });
        await actor("owner", "/__stock/editor?lang=bg");
        await expect(page.locator("[data-sku-id]")).toHaveCount(2);
        await page.evaluate(() => globalThis.document.fonts.ready);
        expect(
          await page.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: join(out, "inventory-bg-" + width + ".png"),
          fullPage: true,
        });
        await context.addCookies([
          { name: "stock-actor", value: "buyer", url: origin },
        ]);
      }
      await page.setViewportSize({ width: 393, height: 850 });
      await actor("buyer", "/__stock/offers?lang=en");
      await button("Cancel reservation").click();
      await page.keyboard.press("Escape");
      await expect(modal()).toHaveCount(0);
      await expect(button("Cancel reservation")).toBeFocused();
      await button("Cancel reservation").click();
      await modal()
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(modal()).toHaveCount(0);
      await expect(page.locator("[data-offer-id]").first()).toContainText(
        "Cancelled",
      );
      expect(
        (await api.readPublicInventory(database, fixture.draft.id)).skus.find(
          (sku) => sku.id === black.id,
        ).available,
      ).toBe(3);
      expect(errors).toEqual([]);
      console.log(
        "Stock browser journey passed: setup/variant editing and reload; foreground form recovery; actual publish snapshots; product selection/cart add, quantity and reload; propose/counter/accept/cancel; durable offer messages; BG/EN 319/393/1440 layouts and Escape focus. Synthetic identity and isolated storage, not live Clerk/provider acceptance.",
      );
    },
  });
}
