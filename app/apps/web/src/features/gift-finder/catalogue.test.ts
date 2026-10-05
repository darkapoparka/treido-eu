import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { giftCatalogue } from "./catalogue.server";
import { parseGiftBrief } from "./model";
import type { SellerTransaction } from "../../server/db/database";
it("a hard arrival requirement performs zero catalogue/block/cursor SQL", async () => {
  const query = vi.fn();
  const tx = { client: { query }, db: {} } as unknown as SellerTransaction;
  const brief = parseGiftBrief({
    version: 1,
    occasion: "birthday",
    age: "child",
    neededBy: "2026-12-01",
    criteria: "category=cat%3Aelectronics%2Fphones&lang=bg",
  });
  expect(await giftCatalogue(tx, "current-human", brief)).toEqual({
    items: [],
    nextCursor: null,
  });
  expect(query).not.toHaveBeenCalled();
});
it("current fixed catalogue SQL retains every typed hard filter and does not interpolate an adversarial brand", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const tx = { client: { query }, db: {} } as unknown as SellerTransaction;
  const brand = "Apple' OR true --",
    criteria = new URLSearchParams({
      category: "cat:electronics/phones",
      seller: "business",
      condition: "good",
      maxPrice: "200",
      location: "София",
      handover: "shipping",
      availability: "known",
      "attr.brand": brand,
      lang: "bg",
    }).toString();
  const brief = parseGiftBrief({
    version: 1,
    occasion: "thanks",
    age: "adult",
    neededBy: null,
    criteria,
  });
  expect(await giftCatalogue(tx, "current-human", brief)).toEqual({
    items: [],
    nextCursor: null,
  });
  const sql = query.mock.calls[0][0];
  expect(sql.text).toContain("stock.available>0");
  expect(sql.text).toContain("p.terms->'handover'");
  expect(sql.text).not.toContain(brand);
  expect(sql.values).toEqual(
    expect.arrayContaining([
      "business",
      "good",
      "shipping",
      20000,
      "brand",
      brand,
    ]),
  );
  expect(query.mock.calls[1][1]).toEqual(["current-human", []]);
});
it("refresh lookup is explicitly bounded to frozen listing IDs under the original strict criteria", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const tx = { client: { query }, db: {} } as unknown as SellerTransaction;
  const id = "10000000-0000-4000-8000-000000000001",
    brief = parseGiftBrief({
      version: 1,
      occasion: "none",
      age: "unspecified",
      neededBy: null,
      criteria: "category=cat%3Aelectronics%2Fphones&maxPrice=200&lang=en",
    });
  await giftCatalogue(tx, "current-human", brief, null, [id]);
  expect(query.mock.calls[0][0].text).toContain("l.id=ANY");
  expect(query.mock.calls[0][0].values).toEqual(
    expect.arrayContaining([[id], 20000]),
  );
});
