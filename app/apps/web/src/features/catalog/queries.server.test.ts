import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ read: vi.fn(), cookie: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: mocks.cookie }),
}));
vi.mock("./reference/adapter.server", () => ({
  readReferenceCatalog: mocks.read,
}));
import { readCatalog, readSearchCatalog } from "./queries.server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookie.mockReturnValue(undefined);
  mocks.read.mockResolvedValue({ products: [], stores: [] });
  vi.stubEnv("SHOP_REFERENCE_PREVIEW", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
});
afterEach(() => vi.unstubAllEnvs());
it.each(["", "0", "true"])("denies non-opt-in value %s", async (value) => {
  vi.stubEnv("SHOP_REFERENCE_PREVIEW", value);
  await expect(readCatalog()).rejects.toThrow("NOT_FOUND");
  await expect(readSearchCatalog()).rejects.toThrow("NOT_FOUND");
  expect(mocks.read).not.toHaveBeenCalled();
});
it("cannot enable fixtures in production", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  await expect(readSearchCatalog()).rejects.toThrow("NOT_FOUND");
  expect(mocks.read).not.toHaveBeenCalled();
});
it("reads each request's scenario rather than retaining the previous one", async () => {
  mocks.cookie.mockReturnValueOnce({ value: "home-welcome" });
  mocks.cookie.mockReturnValueOnce({ value: "unknown" });
  await readCatalog();
  await readCatalog();
  expect(mocks.read).toHaveBeenNthCalledWith(1, "home-welcome");
  expect(mocks.read).toHaveBeenNthCalledWith(2, "unknown");
});
it("propagates an adapter failure without sample success", async () => {
  mocks.read.mockRejectedValueOnce(new Error("ADAPTER_FAILURE"));
  await expect(readSearchCatalog()).rejects.toThrow("ADAPTER_FAILURE");
  expect(mocks.read).toHaveBeenCalledTimes(1);
});
it("returns the search projection in explicitly enabled reference mode", async () => {
  await expect(readSearchCatalog()).resolves.toEqual({
    products: [],
    stores: [],
    liveHomeStoreIds: undefined,
  });
  expect(mocks.read).toHaveBeenCalledWith(undefined);
});

it.each([
  ["NODE_ENV", "production"],
  ["VERCEL", "1"],
])("denies shared catalog/search reads under %s", async (key, value) => {
  vi.stubEnv(key, value);
  await expect(readCatalog()).rejects.toThrow("NOT_FOUND");
  await expect(readSearchCatalog()).rejects.toThrow("NOT_FOUND");
  expect(mocks.read).not.toHaveBeenCalled();
});
