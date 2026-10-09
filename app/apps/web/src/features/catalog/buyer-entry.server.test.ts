import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const source = vi.hoisted(() => ({
  reference: vi.fn(),
  catalog: vi.fn(),
  database: vi.fn(),
  query: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: source.cookies }));
vi.mock("./queries.server", () => ({
  referencePreviewEnabled: source.reference,
  readCatalog: source.catalog,
}));
vi.mock("../../server/db/database", () => ({ getDatabase: source.database }));
vi.mock("../locale/request.server", () => ({
  readLocaleRequest: async () => ({ locale: "bg" }),
}));
vi.mock("../promotions/projection.server", () => ({
  readPromotionDiscovery: source.query,
}));
vi.mock("./public-discovery.server", () => ({
  publicDiscoveryKey: () => new Uint8Array(32),
  readPublicExplore: source.query,
}));
import {
  readBuyerHomeData,
  readBuyerExploreData,
  readBuyerPublicView,
} from "./buyer-entry.server";
beforeEach(() => {
  vi.clearAllMocks();
  source.reference.mockReturnValue(false);
  source.database.mockReturnValue({ pool: {} });
  source.cookies.mockResolvedValue({ get: () => undefined });
});
it("canonical browse groups use public data even while reference replay is enabled", async () => {
  source.reference.mockReturnValue(true);
  source.query.mockResolvedValue({ items: [], total: 0 });
  const data = await readBuyerExploreData(
    { lang: "bg", seller: "personal" },
    "nav:electronics/computers",
  );
  expect(data.publicView?.input.category).toBe("nav:electronics/computers");
  expect(data.publicView?.input.seller).toBe("personal");
  expect(source.catalog).not.toHaveBeenCalled();
});
it("Explore previews mixed supply while carrying scoped criteria to results links", async () => {
  source.query.mockResolvedValue({ items: [], total: 0 });
  const view = (
    await readBuyerExploreData(
      { seller: "business", minPrice: "100", q: "phone", lang: "bg" },
      "cat:electronics",
    )
  ).publicView!;
  expect(view.input.seller).toBe("business");
  expect(view.input.minPriceMinor).toBe(10000);
  const supply = source.query.mock.calls[0][1] as URLSearchParams;
  expect(supply.get("category")).toBe("cat:electronics");
  expect(supply.get("seller")).toBeNull();
  expect(supply.get("minPrice")).toBeNull();
  expect(supply.get("q")).toBeNull();
  expect(supply.get("lang")).toBe("bg");
});
it("the guarded QA scenario selects real Home and Explore data, never fixtures", async () => {
  source.reference.mockReturnValue(true);
  source.cookies.mockResolvedValue({ get: () => ({ value: "public-data" }) });
  source.query.mockResolvedValue({ items: [], total: 0 });
  expect((await readBuyerHomeData({})).publicView?.page).toBeDefined();
  expect((await readBuyerExploreData({})).publicView?.page).toBeDefined();
  expect(source.catalog).not.toHaveBeenCalled();
});
it("hosted/production guard ignores QA cookie selection entirely", async () => {
  source.reference.mockReturnValue(false);
  source.cookies.mockResolvedValue({ get: () => ({ value: "public-data" }) });
  source.query.mockResolvedValue({ items: [] });
  await readBuyerHomeData({});
  await readBuyerExploreData({});
  expect(source.cookies).not.toHaveBeenCalled();
  expect(source.catalog).not.toHaveBeenCalled();
});
it("unknown local QA cookie preserves the existing reference adapter", async () => {
  source.reference.mockReturnValue(true);
  source.cookies.mockResolvedValue({
    get: () => ({ value: "unknown-scenario" }),
  });
  source.catalog.mockResolvedValue({ products: [], stores: [] });
  expect((await readBuyerHomeData({})).catalog).toBeDefined();
  expect(source.query).not.toHaveBeenCalled();
});
it("returns guarded fixture data only for opted-in local adapter, without relabeling seller types", async () => {
  const catalog = { products: [], stores: [] };
  source.reference.mockReturnValue(true);
  source.catalog.mockResolvedValue(catalog);
  expect(await readBuyerHomeData({ seller: "personal" })).toEqual({ catalog });
  expect(source.query).not.toHaveBeenCalled();
});
it("uses the real public Home feed and preserves source ordering/placements", async () => {
  const page = { items: [], placements: [], total: 0 };
  source.query.mockResolvedValue(page);
  const data = await readBuyerHomeData({
    seller: "business",
    minPrice: "10",
    lang: "bg",
  });
  expect(data.publicView?.page).toBe(page);
  expect(data.publicView?.input).toMatchObject({
    seller: "business",
    minPriceMinor: 1000,
    locale: "bg",
    sort: "newest",
  });
  expect(source.catalog).not.toHaveBeenCalled();
  expect(source.query.mock.calls[0][2].surface).toBe("home");
});
it("keeps explicit Home sort and query cursor instead of silently changing ranking", async () => {
  source.query.mockResolvedValue({ items: [] });
  const cursor = "payload." + "a".repeat(43);
  await readBuyerPublicView({ sort: "relevance", cursor }, { home: true });
  expect(source.query.mock.calls[0][1].get("sort")).toBeNull();
  expect(source.query.mock.calls[0][1].get("cursor")).toBe(cursor);
});
it("canonical category uses the actual public adapter even in reference preview", async () => {
  source.reference.mockReturnValue(true);
  source.query.mockResolvedValue({ items: [] });
  const data = await readBuyerExploreData(
    { seller: "personal" },
    "cat:beauty-care/sealed-skincare",
  );
  expect(data.publicView?.input).toMatchObject({
    category: "cat:beauty-care/sealed-skincare",
    seller: "personal",
  });
  expect(source.catalog).not.toHaveBeenCalled();
});
it("preserves guarded local department replay data", async () => {
  source.reference.mockReturnValue(true);
  const catalog = { products: [], stores: [] };
  source.catalog.mockResolvedValue(catalog);
  expect(await readBuyerExploreData({}, "Beauty")).toEqual({ catalog });
  expect(source.query).not.toHaveBeenCalled();
});
it("database failure is visibly unavailable and never falls back to reference catalogue", async () => {
  source.query.mockRejectedValue(new Error("DATABASE_UNAVAILABLE"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const data = await readBuyerHomeData({ seller: "personal" });
  expect(data.publicView).toMatchObject({
    unavailable: true,
    input: { seller: "personal" },
  });
  expect(data.publicView?.page).toBeUndefined();
  expect(source.catalog).not.toHaveBeenCalled();
  log.mockRestore();
});
it("retains a safe failure category without logging private provider error details", async () => {
  const privateDetail = "SYNTHETIC-PROVIDER-DETAILS-DO-NOT-LOG";
  source.query.mockRejectedValue(
    Object.assign(new Error(privateDetail), {
      code: "42501",
      detail: privateDetail,
    }),
  );
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await readBuyerHomeData({})).publicView?.unavailable).toBe(true);
    expect(log).toHaveBeenCalledWith(
      "Buyer discovery query unavailable.",
      expect.objectContaining({ boundary: "database", sqlState: "42501" }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateDetail);
  } finally {
    log.mockRestore();
  }
});
it("empty live supply remains empty rather than displaying fixtures", async () => {
  const page = {
    items: [],
    total: 0,
    facets: { categories: [], conditions: [], sellers: [] },
    nextCursor: null,
  };
  source.query.mockResolvedValue(page);
  const data = await readBuyerExploreData({});
  expect(data.publicView?.page).toBe(page);
  expect(data.publicView?.unavailable).toBeUndefined();
  expect(source.catalog).not.toHaveBeenCalled();
});
