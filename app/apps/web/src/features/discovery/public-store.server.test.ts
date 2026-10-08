import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const source = vi.hoisted(() => ({
  database: vi.fn(),
  seller: vi.fn(),
  query: vi.fn(),
  feedback: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../server/db/database", () => ({ getDatabase: source.database }));
vi.mock("../locale/request.server", () => ({
  readLocaleRequest: async () => ({ locale: "bg" }),
}));
vi.mock("../catalog/public-discovery.server", () => ({
  publicDiscoveryKey: () => new Uint8Array(32),
  readPublicSeller: source.seller,
}));
vi.mock("../promotions/projection.server", () => ({
  readPromotionDiscovery: source.query,
}));
vi.mock("../order-feedback/queries.server", () => ({
  readPublicOrderFeedback: source.feedback,
}));
import { readPublicStoreView } from "./public-store.server";
const id = "00000000-0000-4000-8000-000000000001";
const seller = {
  id,
  name: "Actual seller",
  kind: "business",
  description: "Published",
  locality: "София",
  country: "BG",
};
beforeEach(() => {
  vi.clearAllMocks();
  source.database.mockReturnValue({ pool: {} });
  source.seller.mockResolvedValue(seller);
  source.query.mockResolvedValue({ items: [], total: 0 });
  source.feedback.mockResolvedValue({
    available: true,
    feedback: [],
    more: false,
  });
});
it("rejects invalid IDs before reading and unavailable/deleted sellers before listing projection", async () => {
  await expect(readPublicStoreView("../private", {})).rejects.toThrow(
    "NOT_FOUND",
  );
  expect(source.database).not.toHaveBeenCalled();
  source.seller.mockResolvedValue(null);
  await expect(readPublicStoreView(id, {})).rejects.toThrow("NOT_FOUND");
  expect(source.query).not.toHaveBeenCalled();
});
it("queries the actual public seller scope with validated filters, sort and cursor", async () => {
  const cursor = "payload." + "a".repeat(43);
  const result = await readPublicStoreView(id, {
    q: "phone",
    seller: "personal",
    category: "cat:electronics/phones",
    sort: "price_desc",
    minPrice: "12.50",
    cursor,
    sellerId: "private-operating",
  });
  expect(result.seller).toBe(seller);
  expect(result.input).toMatchObject({
    seller: "all",
    q: "phone",
    category: "cat:electronics/phones",
    sort: "price_desc",
    minPriceMinor: 1250,
    locale: "bg",
  });
  expect(source.query.mock.calls[0][1].get("cursor")).toBe(cursor);
  expect(source.query.mock.calls[0][1].has("sellerId")).toBe(false);
  expect(source.query.mock.calls[0][2]).toMatchObject({
    sellerId: id,
    surface: "search",
  });
});
it("database/listing failure stays unavailable with no fixture or false empty success", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  source.database.mockImplementationOnce(() => {
    throw new Error("PRIVATE_BINDING_DETAIL");
  });
  expect(await readPublicStoreView(id, {})).toMatchObject({
    unavailable: true,
  });
  expect(source.seller).not.toHaveBeenCalled();
  source.query.mockRejectedValueOnce(new Error("PRIVATE_SQL_DETAIL"));
  const result = await readPublicStoreView(id, {});
  expect(result).toMatchObject({ seller, unavailable: true });
  expect(result.page).toBeUndefined();
  expect(log.mock.calls.flat().join(" ")).not.toContain("PRIVATE_");
  log.mockRestore();
});
it("retains actual seller and listing data when only feedback fails; bounds feedback pages", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const result = await readPublicStoreView(id, { feedbackPage: "10" }, true);
  expect(result.page).toBeDefined();
  expect(result.unavailable).toBeUndefined();
  expect(result.purchaseFeedback).toEqual({
    available: false,
    items: [],
    more: false,
    page: 0,
  });
  expect(source.feedback).not.toHaveBeenCalled();
  const valid = await readPublicStoreView(id, { feedbackPage: "2" }, true);
  expect(source.feedback).toHaveBeenCalledWith(expect.anything(), id, 2);
  expect(valid.purchaseFeedback).toEqual({
    available: true,
    items: [],
    more: false,
    page: 2,
  });
  log.mockRestore();
});
