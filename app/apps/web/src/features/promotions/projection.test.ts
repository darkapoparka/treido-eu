import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const f = vi.hoisted(() => ({ read: vi.fn(), bridge: vi.fn() }));
vi.mock("../catalog/public-discovery.server", () => ({
  readPublicDiscovery: f.read,
}));
vi.mock("./payment-bridge.server", () => ({
  promotionPaymentBridge: f.bridge,
}));
vi.mock("../sellers/persistence.server", () => ({
  inputHash: () => "a".repeat(64),
}));
vi.mock("../inventory/queries.server", () => ({
  reservedSql: (name: string) => `reserved(${name})`,
}));
vi.mock("../inventory/public-sql", () => ({ publicInventoryJoin: "" }));
import {
  readPromotionDiscovery,
  signPlacement,
  verifyPlacement,
} from "./projection.server";
import type { SellerDatabase } from "../../server/db/database";
const id = "00000000-0000-4000-8000-000000000001",
  key = Buffer.alloc(32, 9),
  now = 1791115200000;
const token = {
  v: 1 as const,
  campaignId: id,
  listingId: id,
  listingRevision: 3,
  placementId: id,
  queryHash: "a".repeat(64),
  expires: now + 120000,
};
beforeEach(() => {
  vi.clearAllMocks();
  f.bridge.mockReturnValue(null);
});
describe("signed current placement and organic-preserving fallback", () => {
  it("valid token is scoped, expiring and rejects tampering/wrong key", () => {
    const signed = signPlacement(token, key);
    expect(verifyPlacement(signed, key, now)).toEqual(token);
    expect(() => verifyPlacement(signed, Buffer.alloc(32, 3), now)).toThrow();
    expect(() => verifyPlacement(signed, key, token.expires)).toThrow();
    expect(() => verifyPlacement(signed + ".extra", key, now)).toThrow();
  });
  it.each([
    { ...token, v: 2 },
    { ...token, expires: now + 120001 },
    { ...token, placementId: id + "\n" },
    { ...token, queryHash: "a".repeat(64) + "\n" },
    { ...token, listingRevision: 0 },
    { ...token, extra: true },
  ])("even correctly signed malformed payload fails %#", (raw) => {
    const signed = signPlacement(raw as typeof token, key);
    expect(() => verifyPlacement(signed, key, now)).toThrow();
  });
  it("absent bridge preserves organic items/count/facets/cursor without querying promotion storage", async () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: String(i) })),
      page = {
        items,
        total: 108,
        facets: { categories: [] },
        nextCursor: "unchanged",
        input: { category: null },
      };
    f.read.mockResolvedValue(page);
    const query = vi.fn();
    const result = await readPromotionDiscovery(
      { pool: { query } } as unknown as SellerDatabase,
      "q=chair&maxPrice=5&seller=business",
      { key, requestId: id, surface: "search" },
    );
    expect(result.items).toBe(items);
    expect(result.total).toBe(108);
    expect(result.nextCursor).toBe("unchanged");
    expect(result.placements.every((p) => p.sponsored === null)).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });
  it("catalogue failure never turns into fabricated empty success", async () => {
    f.read.mockRejectedValue(new Error("catalogue unavailable"));
    await expect(
      readPromotionDiscovery({} as SellerDatabase, "", {
        key,
        requestId: id,
        surface: "home",
      }),
    ).rejects.toThrow("catalogue unavailable");
  });
  it("qualified bridge with absent optional tables preserves genuine organic results only", async () => {
    f.bridge.mockReturnValue({ binding: { platformAccount: "acct_isolated" } });
    const items = Array.from({ length: 8 }, (_, i) => ({ id: String(i) }));
    f.read.mockResolvedValue({ items, total: 8, nextCursor: "same" });
    const query = vi.fn(async () => ({ rows: [{ ready: false }] }));
    const result = await readPromotionDiscovery(
      { pool: { query } } as unknown as SellerDatabase,
      "",
      { key, requestId: id, surface: "home" },
    );
    expect(result.items).toBe(items);
    expect(result.nextCursor).toBe("same");
    expect(result.placements.every((p) => p.sponsored === null)).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("optional storage metadata failure remains an error and is never marked ready/empty paid success", async () => {
    f.bridge.mockReturnValue({ binding: { platformAccount: "acct_isolated" } });
    f.read.mockResolvedValue({
      items: Array.from({ length: 8 }, (_, i) => ({ id: String(i) })),
    });
    const query = vi.fn(async () => {
      throw new Error("permission denied");
    });
    await expect(
      readPromotionDiscovery(
        { pool: { query } } as unknown as SellerDatabase,
        "",
        { key, requestId: id, surface: "home" },
      ),
    ).rejects.toThrow("permission denied");
  });
  it("paid query joins exact observed publication revisions and current stock/capacity/category/seller policy", async () => {
    f.bridge.mockReturnValue({
      binding: {
        platformAccount: "acct_test",
        environment: "test",
        applicationId: "isolated",
        livemode: false,
      },
    });
    const items = Array.from({ length: 8 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      images: ["/api/listing-media/x/y?v=3"],
    }));
    f.read.mockResolvedValue({
      items,
      total: 8,
      facets: {},
      nextCursor: null,
      input: { category: "home.chairs", seller: "business", currency: "EUR" },
    });
    const query = vi.fn(async (sql: string) => ({
      rows: sql.includes("to_regclass") ? [{ ready: true }] : [],
    }));
    await readPromotionDiscovery(
      { pool: { query } } as unknown as SellerDatabase,
      "seller=business&category=home.chairs",
      { key, requestId: id, surface: "search" },
    );
    const [sql, args] = query.mock.calls[1] as unknown as [string, unknown[]];
    for (const fragment of [
      "requested.revision=p.revision",
      "pc.state='active'",
      "pa.state='paid'",
      "cap.seller_kind=s.kind",
      "pr.listing_revision=p.revision",
      "pi.ends_at>clock_timestamp()",
      "cap.slots",
      "l.publication='published'",
      "s.status='active'",
    ])
      expect(sql).toContain(fragment);
    expect(JSON.parse(args[8] as string)).toEqual(
      items.map((item) => ({ id: item.id, revision: 3 })),
    );
  });
});
