import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const source = vi.hoisted(() => ({ cookies: vi.fn(), get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: source.cookies }));
import { readBuyerReferenceMode } from "./buyer-data-mode.server";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SHOP_REFERENCE_PREVIEW", "1");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "preview");
  source.cookies.mockResolvedValue({ get: source.get });
});
afterEach(() => vi.unstubAllEnvs());

it.each([
  ["SHOP_REFERENCE_PREVIEW", "0"],
  ["NODE_ENV", "production"],
  ["VERCEL", "1"],
  ["VERCEL_ENV", "production"],
])(
  "ignores QA cookies when the actual %s guard denies reference mode",
  async (key, value) => {
    vi.stubEnv(key, value);
    source.get.mockReturnValue({ value: "public-data" });
    expect(await readBuyerReferenceMode()).toBe(false);
    expect(source.cookies).not.toHaveBeenCalled();
  },
);

it.each([undefined, "", "unknown-scenario", "home-welcome"])(
  "retains guarded local replay for scenario %s",
  async (value) => {
    source.get.mockReturnValue(value === undefined ? undefined : { value });
    expect(await readBuyerReferenceMode()).toBe(true);
    expect(source.get).toHaveBeenCalledWith("shop-reference-scenario");
  },
);

it("selects real adapters only for the exact local public-data scenario", async () => {
  source.get.mockReturnValue({ value: "public-data" });
  expect(await readBuyerReferenceMode()).toBe(false);
});
