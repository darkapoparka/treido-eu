import { randomBytes, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import { createPublicationFixture } from "../../../tests/fixtures/publication-flow";
import { readListingDraft, saveListingDraft } from "../selling/drafts.server";
import { publishListing } from "../selling/publish.server";
import { readPublicDiscovery } from "./public-discovery.server";
import { readDiscoveryInput, type DiscoveryParams } from "./discovery-input";

export function defineNumericDiscoveryCases(
  get: () => {
    database: SellerDatabase;
    admin: Pool;
    owner: { subject: string };
  },
) {
  describe("published raw numeric fields stay discoverable", () => {
    const key = randomBytes(32),
      marker = "numeric" + randomUUID().replaceAll("-", "");
    const phone = "cat:electronics/phones",
      furniture = "cat:home/tables-chairs";
    let phoneId: string, furnitureId: string;
    const raw = {
      dimensions: {
        width: "\t120,5 ",
        height: "\u00a080\u00a0",
        depth: "60,25",
        unit: "cm",
      },
      weight: { value: "\u202f1,50\u202f", unit: "kg" },
    };
    beforeAll(async () => {
      const ctx = get(),
        client = await ctx.admin.connect();
      try {
        await client.query(
          "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC T71 NUMERIC TEST ONLY',reviewed_at=now() WHERE category_id=ANY($1::text[]) AND version=1",
          [[phone, furniture]],
        );
        for (const categoryId of [phone, furniture]) {
          const f = await createPublicationFixture({
            database: ctx.database,
            admin: client,
            owner: ctx.owner,
          });
          const draft = await readListingDraft(
            ctx.database,
            ctx.owner,
            f.sellerId,
            f.draft.id,
          );
          const saved = await saveListingDraft(ctx.database, ctx.owner, {
            sellerId: f.sellerId,
            draftId: f.draft.id,
            expectedRevision: draft.revision,
            requestId: randomUUID(),
            payload: {
              ...draft.payload,
              title: marker + " " + categoryId,
              categoryId,
              fields:
                categoryId === phone
                  ? { ...draft.payload.fields, storageGB: " \t128\u00a0" }
                  : raw,
            },
          });
          await publishListing(ctx.database, ctx.owner, {
            ...f.input,
            requestId: randomUUID(),
            expectedRevision: saved.revision,
          });
          if (categoryId === phone) phoneId = f.draft.id;
          else furnitureId = f.draft.id;
        }
      } finally {
        client.release();
      }
    });
    const search = (params: DiscoveryParams) =>
      readPublicDiscovery(get().database, params, { key });
    it("matches an accepted whitespace-padded integer without rewriting its publication", async () => {
      const page = await search({
        q: marker,
        category: phone,
        "attr.storageGB": "128",
      });
      expect(page.items.map((item) => item.id)).toEqual([phoneId]);
      const row = await get().admin.query(
        "SELECT payload->'fields'->>'storageGB' AS raw FROM treido.listing_publications WHERE listing_id=$1",
        [phoneId],
      );
      expect(row.rows[0].raw).toBe(" \t128\u00a0");
      expect(
        (await search({ q: marker, category: phone, "attr.storageGB": "256" }))
          .total,
      ).toBe(0);
    });
    it("matches a comma-decimal weight accepted by the seller form", async () => {
      const params = {
        q: marker,
        category: furniture,
        "attr.weight": JSON.stringify({ value: "1.50", unit: "kg" }),
      };
      expect(readDiscoveryInput(params).input.attributes.weight).toEqual({
        value: "1.5",
        unit: "kg",
      });
      expect((await search(params)).items.map((item) => item.id)).toEqual([
        furnitureId,
      ]);
      expect(
        (
          await search({
            ...params,
            "attr.weight": JSON.stringify({ value: "1.60", unit: "kg" }),
          })
        ).total,
      ).toBe(0);
    });
    it("combines comma-decimal dimensions with all validated numeric predicates", async () => {
      const page = await search({
        q: marker,
        category: furniture,
        "attr.dimensions": JSON.stringify({
          width: 120.5,
          height: 80,
          depth: 60.25,
          unit: "cm",
        }),
        "attr.weight": JSON.stringify({ value: "1.50", unit: "kg" }),
      });
      expect(page.items.map((item) => item.id)).toEqual([furnitureId]);
      const row = await get().admin.query(
        "SELECT payload->'fields' AS fields FROM treido.listing_publications WHERE listing_id=$1",
        [furnitureId],
      );
      expect(row.rows[0].fields).toEqual(raw);
      expect(
        (
          await search({
            q: marker,
            category: furniture,
            "attr.dimensions": JSON.stringify({
              width: 120.5,
              height: 80,
              depth: 60.25,
              unit: "mm",
            }),
          })
        ).total,
      ).toBe(0);
    });
  });
}
