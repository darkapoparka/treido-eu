import { describe, it, expect, vi } from "vitest";
import { randomUUID, randomBytes } from "node:crypto";
vi.mock("server-only", () => ({}));
import { readDiscoveryInput } from "./discovery-input";
import { foldDiscoveryText, discoveryTerms } from "./public-discovery-model";
import { buildPublicDiscoveryQuery } from "./public-discovery-sql";
import {
  readPublicDiscovery,
  readPublicSeller,
} from "./public-discovery.server";
import type { SellerDatabase } from "../../server/db/database";
const key = randomBytes(32);
function result(count = 25) {
  return {
    total: count,
    categories: [{ value: "cat:electronics/phones", count }],
    conditions: [{ value: "good", count }],
    sellers: [{ value: "business", count }],
    items: Array.from({ length: count }, () => ({
      id: randomUUID(),
      sellerId: randomUUID(),
      sellerName: "Seller",
      sellerKind: "business",
      revision: 2,
      title: "Телефон",
      priceMinor: 12900,
      categoryId: "cat:electronics/phones",
      condition: "good",
      locality: "София",
      createdAt: "2026-10-03T00:00:00.000Z",
      rank: 0,
      photoId: randomUUID(),
      privateEmail: "never-public@example.test",
    })),
  };
}
function database(row = result()) {
  const query = vi.fn().mockResolvedValue({ rows: [row] });
  return { db: { pool: { query } } as unknown as SellerDatabase, query };
}
describe("public discovery", () => {
  it("normalizes Bulgarian, Latin, punctuation and all query words without inventing translations", () => {
    expect(foldDiscoveryText("  СОФИЯ Телефон  ")).toBe("sofia telefon");
    expect(foldDiscoveryText("Щипка Жълта")).toBe("shtipka zhalta");
    expect(discoveryTerms("телефон telefon 128")).toEqual(["telefon", "128"]);
    expect(
      discoveryTerms(
        Array.from({ length: 20 }, (_, index) => "t" + index).join(" "),
      ),
    ).toHaveLength(20);
  });
  it("binds literals and all hard filters; never interpolates request SQL", () => {
    const { input } = readDiscoveryInput({
      q: "50%_' OR 1=1",
      category: "cat:electronics/phones",
      seller: "personal",
      condition: "good",
      minPrice: "100",
      maxPrice: "200",
      location: "София",
      "attr.storageGB": "128",
    });
    const query = buildPublicDiscoveryQuery(input);
    expect(query.text).not.toContain(input.q);
    expect(query.text).toContain("published");
    expect(query.text).toContain("current_publication_revision");
    expect(query.text).toContain("treido.categories");
    expect(query.values).toContain("personal");
    expect(query.values).toContain("sofia");
    expect(query.values).toContain(10000);
    expect(query.values).toContain(20000);
    expect(query.values.at(-1)).toBe(25);
  });
  it("projects bounded cards and produces a usable filter-bound cursor", async () => {
    const { db, query } = database();
    const first = await readPublicDiscovery(db, {}, { key });
    expect(first.items).toHaveLength(24);
    expect(first.total).toBe(25);
    expect(first.nextCursor).toBeTruthy();
    expect(JSON.stringify(first)).not.toMatch(
      /privateEmail|never-public|photoId|revision|payload/,
    );
    await readPublicDiscovery(db, { cursor: first.nextCursor! }, { key });
    expect(query.mock.calls.at(-1)?.[0]).toContain('("createdAt",id)<');
    expect(
      (
        await readPublicDiscovery(
          db,
          { cursor: first.nextCursor!, seller: "personal" },
          { key },
        )
      ).cursorReset,
    ).toBe(true);
    expect(
      (
        await readPublicDiscovery(
          db,
          { cursor: first.nextCursor! },
          { key, sellerId: randomUUID() },
        )
      ).cursorReset,
    ).toBe(true);
  });
  it.each(["newest", "relevance", "price_asc", "price_desc"])(
    "uses deterministic cursor anchors for %s",
    async (sort) => {
      const { db } = database();
      const first = await readPublicDiscovery(db, { sort }, { key });
      expect(
        (
          await readPublicDiscovery(
            db,
            { sort, cursor: first.nextCursor! },
            { key },
          )
        ).cursorReset,
      ).toBe(false);
    },
  );
  it("returns honest empty success and propagates database failure", async () => {
    const { db, query } = database(result(0));
    expect((await readPublicDiscovery(db, {}, { key })).items).toEqual([]);
    query.mockRejectedValueOnce(new Error("offline"));
    await expect(readPublicDiscovery(db, {}, { key })).rejects.toThrow(
      "offline",
    );
    await expect(
      readPublicDiscovery(db, {}, { key, sellerId: "invalid" }),
    ).rejects.toThrow("scope");
    expect(await readPublicSeller(db, "invalid")).toBeNull();
  });
});

it.skipIf(process.env.TREIDO_DISCOVERY_LIVE !== "1")(
  "reads the configured Neon catalogue without mutating data",
  async () => {
    const { Pool } = await import("pg");
    const { createDatabase } = await import("../../server/db/database");
    const { deriveDevelopmentDatabaseEnvironment, validateBackendBindings } =
      await import("../../server/config/backend-bindings");
    const { publicDiscoveryKey } = await import("./public-discovery.server");
    const env = deriveDevelopmentDatabaseEnvironment(process.env);
    if (!validateBackendBindings(env).ok)
      throw new Error("Configured backend binding is invalid.");
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 10000,
      statement_timeout: 15000,
    });
    try {
      const role = (await pool.query("SELECT current_user AS role")).rows[0]
        .role;
      const page = await readPublicDiscovery(
        createDatabase(pool),
        {},
        { key: publicDiscoveryKey() },
      );
      console.log(
        "Configured Neon catalogue: role=" +
          role +
          ", eligible listings=" +
          page.total +
          ", read-only query completed.",
      );
      expect(Array.isArray(page.items)).toBe(true);
    } catch {
      throw new Error(
        "Configured Neon public catalogue read did not complete.",
      );
    } finally {
      await pool.end();
    }
  },
  30000,
);
