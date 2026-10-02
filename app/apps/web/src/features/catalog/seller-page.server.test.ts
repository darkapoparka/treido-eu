import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const catalogRead = vi.hoisted(() => vi.fn());
vi.mock("./queries.server", () => ({ readCatalog: catalogRead }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import { readSellerPage } from "./seller-page.server";
import type { Catalog, Store } from "./types";
const seller: Store = {
  id: "new-seller",
  name: "Нов магазин",
  logo: "",
  description: "",
  ratingCount: "",
  categories: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => vi.unstubAllEnvs());

it("preserves frozen seller records", async () => {
  const catalog: Catalog = { stores: [seller], products: [] };
  catalogRead.mockResolvedValue(catalog);
  const result = await readSellerPage(seller.id);
  expect(result.store).toBe(seller);
  expect(result.catalog).toBe(catalog);
});

it("projects the requested live seller without changing shared catalog records", async () => {
  const catalog: Catalog = {
    stores: [seller],
    products: [],
    liveHomeStoreIds: [seller.id],
  };
  catalogRead.mockResolvedValue(catalog);
  const result = await readSellerPage(seller.id);
  expect(result.store.referenceStyle).toBe("android");
  expect(result.store.referenceMerchant?.reviews).toBeUndefined();
  expect(result.catalog).toBe(catalog);
  expect(result.catalog.stores[0]).toBe(seller);
  expect(seller.referenceMerchant).toBeUndefined();
});

it("rejects a missing seller instead of showing another seller's profile", async () => {
  catalogRead.mockResolvedValue({ stores: [seller], products: [] });
  await expect(readSellerPage("missing")).rejects.toThrow("NOT_FOUND");
});

it("propagates the guarded catalog's failure", async () => {
  catalogRead.mockRejectedValue(new Error("CATALOG_DENIED"));
  await expect(readSellerPage(seller.id)).rejects.toThrow("CATALOG_DENIED");
});

it("cannot load live reference presentation in a production process", async () => {
  vi.stubEnv("NODE_ENV", "production");
  catalogRead.mockResolvedValue({
    stores: [seller],
    products: [],
    liveHomeStoreIds: [seller.id],
  });
  await expect(readSellerPage(seller.id)).rejects.toThrow("NOT_FOUND");
});
