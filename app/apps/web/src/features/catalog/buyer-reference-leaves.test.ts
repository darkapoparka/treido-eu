import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ get: vi.fn(), catalog: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: state.get }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("./queries.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./queries.server")>()),
  readCatalog: state.catalog,
}));
import { readBuyerReferenceCatalog } from "./buyer-data-mode.server";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SHOP_REFERENCE_PREVIEW", "1");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "preview");
});
afterEach(() => vi.unstubAllEnvs());
it("rejects an unsupported real-data leaf before fixture loading", async () => {
  state.get.mockReturnValue({ value: "public-data" });
  await expect(readBuyerReferenceCatalog()).rejects.toThrow("NOT_FOUND");
  expect(state.catalog).not.toHaveBeenCalled();
});
it("retains the unchanged guarded reference reader", async () => {
  state.get.mockReturnValue(undefined);
  const reference = { original: true };
  state.catalog.mockResolvedValue(reference);
  expect(await readBuyerReferenceCatalog()).toBe(reference);
});
it.each(["production", "hosted"])(
  "rejects unsupported leaves in %s",
  async (mode) => {
    if (mode === "production") vi.stubEnv("NODE_ENV", "production");
    else vi.stubEnv("VERCEL", "1");
    await expect(readBuyerReferenceCatalog()).rejects.toThrow("NOT_FOUND");
    expect(state.catalog).not.toHaveBeenCalled();
  },
);
