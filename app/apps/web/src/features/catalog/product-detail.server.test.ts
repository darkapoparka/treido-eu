import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  context: vi.fn(),
  products: vi.fn(),
  cookie: vi.fn(),
}));
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
vi.mock("./reference/product-detail.server", () => ({
  readReferenceProductDetail: mocks.detail,
}));
vi.mock("./reference/product-context.server", () => ({
  readReferenceProductContext: mocks.context,
}));
vi.mock("./reference/product-source.server", () => ({
  readReferenceProducts: mocks.products,
}));
import { readProductDetail, readProductContext } from "./product-detail.server";
const request = { cartIds: [], coverIds: [] };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SHOP_REFERENCE_PREVIEW", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  mocks.products.mockResolvedValue([{ id: "shea-butter" }]);
});
afterEach(() => vi.unstubAllEnvs());
it.each(["", "0", "true"])(
  "denies product and context without explicit opt-in (%s)",
  async (value) => {
    vi.stubEnv("SHOP_REFERENCE_PREVIEW", value);
    await expect(readProductDetail("shea-butter")).rejects.toThrow("NOT_FOUND");
    await expect(readProductContext("shea-butter", request)).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.products).not.toHaveBeenCalled();
  },
);
it.each([
  ["VERCEL_ENV", "production"],
  ["NODE_ENV", "production"],
  ["VERCEL", "1"],
])("denies hosted/production mode %s", async (key, value) => {
  vi.stubEnv(key, value);
  await expect(readProductDetail("shea-butter")).rejects.toThrow("NOT_FOUND");
  await expect(readProductContext("shea-butter", request)).rejects.toThrow(
    "NOT_FOUND",
  );
  expect(mocks.detail).not.toHaveBeenCalled();
  expect(mocks.products).not.toHaveBeenCalled();
});
it("forwards this request's scenario and bounded adapter result", async () => {
  const result = {
    view: { product: { id: "shea-butter" } },
    context: { covers: [] },
  };
  mocks.detail.mockResolvedValue(result);
  mocks.cookie
    .mockReturnValueOnce({ value: "home-welcome" })
    .mockReturnValueOnce({ value: "product-reporting" });
  await expect(readProductDetail("shea-butter")).resolves.toBe(result);
  await readProductDetail("shea-butter");
  expect(mocks.detail).toHaveBeenNthCalledWith(
    1,
    "shea-butter",
    "home-welcome",
  );
  expect(mocks.detail).toHaveBeenNthCalledWith(
    2,
    "shea-butter",
    "product-reporting",
  );
});
it("returns absent for unknown items and never fabricates adapter success", async () => {
  mocks.detail.mockResolvedValueOnce(undefined);
  await expect(readProductDetail("unknown")).resolves.toBeUndefined();
  const error = new Error("ADAPTER_FAILURE");
  mocks.detail.mockRejectedValueOnce(error);
  await expect(readProductDetail("shea-butter")).rejects.toBe(error);
  mocks.context.mockRejectedValueOnce(error);
  await expect(readProductContext("shea-butter", request)).rejects.toBe(error);
});
it("validates IDs and context batches before calling an adapter", async () => {
  await expect(readProductDetail("../shea-butter")).resolves.toBeUndefined();
  await expect(
    readProductContext("shea-butter", { cartIds: ["bad/id"], coverIds: [] }),
  ).resolves.toBeUndefined();
  expect(mocks.detail).not.toHaveBeenCalled();
  expect(mocks.products).not.toHaveBeenCalled();
});
it("does not return context for a missing product", async () => {
  mocks.products.mockResolvedValueOnce([]);
  await expect(readProductContext("unknown", request)).resolves.toBeUndefined();
  expect(mocks.context).not.toHaveBeenCalled();
});
it("passes only validated IDs and the current scenario to context reads", async () => {
  mocks.cookie.mockReturnValue({ value: "reference-default" });
  const context = { cart: { products: [], stores: [] }, covers: [] };
  mocks.context.mockResolvedValue(context);
  await expect(
    readProductContext("shea-butter", {
      cartIds: ["rice-bundle", "rice-bundle"],
      coverIds: [],
    }),
  ).resolves.toBe(context);
  expect(mocks.context).toHaveBeenCalledWith(
    "shea-butter",
    { cartIds: ["rice-bundle"], coverIds: [] },
    "reference-default",
  );
});
