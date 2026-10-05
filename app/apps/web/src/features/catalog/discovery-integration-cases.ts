import { readDiscoveryInput } from "./discovery-input";
import { readPublishedListing, readPublishedPhoto } from "./published.server";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import type { PublicationFixtureContext } from "../../../tests/fixtures/publication-flow";
import { createPublicationFixture } from "../../../tests/fixtures/publication-flow";
import { publishListing } from "../selling/publish.server";
import { saveListingDraft, readListingDraft } from "../selling/drafts.server";
import { withdrawListing } from "../selling/publication.server";
import {
  readPublicDiscovery,
  readPublicSeller,
} from "./public-discovery.server";
export function defineDiscoveryIntegrationCases(
  get: () => PublicationFixtureContext,
) {
  describe("public discovery with real accepted PostgreSQL publications", () => {
    const key = randomBytes(32),
      marker = "discovery" + randomUUID().replaceAll("-", "");
    const fixtures: Awaited<ReturnType<typeof createPublicationFixture>>[] = [];
    const revisions: number[] = [];
    let sellerId: string;
    beforeAll(async () => {
      const ctx = get();
      await ctx.admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC DISCOVERY TEST ONLY',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
      );
      for (let index = 0; index < 27; index++) {
        const f = await createPublicationFixture(
          ctx,
          index === 26 ? "personal" : "business",
          index === 1 ? sellerId : undefined,
        );
        if (index === 0) sellerId = f.sellerId;
        const saved = await saveListingDraft(ctx.database, ctx.owner, {
          sellerId: f.sellerId,
          draftId: f.draft.id,
          expectedRevision: f.draft.revision,
          requestId: randomUUID(),
          payload: {
            ...(
              await readListingDraft(
                ctx.database,
                ctx.owner,
                f.sellerId,
                f.draft.id,
              )
            ).payload,
            title: marker + " Телефон " + index,
            priceMinor: 10000 + (index % 5) * 100,
            locality: index % 2 ? "Варна" : "София",
          },
        });
        const published = await publishListing(ctx.database, ctx.owner, {
          ...f.input,
          expectedRevision: saved.revision,
        });
        fixtures.push(f);
        revisions.push(published.revision);
      }
    });
    afterAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    it("searches transliterated Bulgarian and combines category, seller, price, locality and typed attributes", async () => {
      const page = await readPublicDiscovery(
        get().database,
        {
          q: marker + " telefon",
          category: "cat:electronics",
          seller: "business",
          location: "Sofia",
          condition: "good",
          minPrice: "100",
          maxPrice: "102",
          "attr.storageGB": "128",
        },
        { key },
      );
      expect(page.total).toBeGreaterThan(0);
      expect(
        page.items.every(
          (item) =>
            item.seller.kind === "business" &&
            item.locality === "София" &&
            item.price.amount >= 10000 &&
            item.price.amount <= 10200,
        ),
      ).toBe(true);
      const noMatch = await readPublicDiscovery(
        get().database,
        {
          q: marker,
          category: "cat:electronics/phones",
          "attr.storageGB": "256",
        },
        { key },
      );
      expect(noMatch.total).toBe(0);
      const personal = await readPublicDiscovery(
        get().database,
        { q: marker, seller: "personal" },
        { key },
      );
      expect(personal.total).toBe(1);
      expect(JSON.stringify(page)).not.toMatch(
        /private@example|PRIVATE TEST ADDRESS|derivative_key|clerk_subject/,
      );
    });
    it.each(["newest", "relevance", "price_asc", "price_desc"])(
      "paginates %s without duplicate or missing IDs",
      async (sort) => {
        const first = await readPublicDiscovery(
          get().database,
          { q: marker, sort },
          { key },
        );
        expect(first.total).toBe(27);
        expect(first.items).toHaveLength(24);
        expect(first.nextCursor).toBeTruthy();
        const second = await readPublicDiscovery(
          get().database,
          { q: marker, sort, cursor: first.nextCursor! },
          { key },
        );
        expect(second.items).toHaveLength(3);
        expect(second.nextCursor).toBeNull();
        const items = [...first.items, ...second.items];
        expect(new Set(items.map((item) => item.id)).size).toBe(27);
        if (sort.startsWith("price_"))
          expect(items.map((item) => item.price.amount)).toEqual(
            items
              .map((item) => item.price.amount)
              .sort((a, b) => (sort === "price_asc" ? a - b : b - a)),
          );
      },
    );
    it("renders only the named public seller and its accepted inventory", async () => {
      const seller = await readPublicSeller(get().database, sellerId);
      expect(seller?.kind).toBe("business");
      expect(Object.keys(seller!).sort()).toEqual([
        "country",
        "description",
        "id",
        "kind",
        "locality",
        "name",
      ]);
      const page = await readPublicDiscovery(
        get().database,
        { q: marker },
        { key, sellerId },
      );
      expect(page.total).toBe(2);
      expect(page.items.every((item) => item.seller.id === sellerId)).toBe(
        true,
      );
    });
    it.skipIf(process.env.TREIDO_DISCOVERY_BROWSER !== "1")(
      "browses real publications through the buyer components",
      async () => {
        const { runMarketplaceBrowser } =
          await import("../../../../../tests/marketplace-flow-browser.mjs");
        await runMarketplaceBrowser({
          database: get().database,
          fixtures,
          key,
          marker,
          api: {
            readDiscoveryInput,
            readPublicDiscovery,
            readPublicSeller,
            readPublishedListing,
            readPublishedPhoto,
          },
        });
      },
      60000,
    );
    it("removes a withdrawn listing immediately and rejects stale category visibility", async () => {
      const ctx = get(),
        f = fixtures[0];
      await withdrawListing(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        listingId: f.draft.id,
        expectedRevision: revisions[0],
        requestId: randomUUID(),
      });
      const page = await readPublicDiscovery(
        ctx.database,
        { q: marker },
        { key },
      );
      expect(page.total).toBe(26);
      expect(page.items.some((item) => item.id === f.draft.id)).toBe(false);
      await ctx.admin.query(
        "UPDATE treido.category_policies SET enabled_for_publish=false WHERE category_id='cat:electronics/phones' AND version=1",
      );
      expect(
        (await readPublicDiscovery(ctx.database, { q: marker }, { key })).total,
      ).toBe(0);
      expect(await readPublicSeller(ctx.database, sellerId)).toBeNull();
    });
  });
}
