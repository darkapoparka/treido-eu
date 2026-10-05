import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NextRequest,
  type NextFetchEvent,
} from "../../apps/web/node_modules/next/server";
const mocks = vi.hoisted(() => ({
  authentication: vi.fn(),
  bindingsValid: true,
}));
vi.mock(
  "../../apps/web/node_modules/@clerk/nextjs/dist/esm/server/index.js",
  () => ({
    clerkMiddleware:
      (callback: (auth: unknown, request: NextRequest) => unknown) =>
      (request: NextRequest) => {
        mocks.authentication();
        return callback(null, request);
      },
  }),
);
vi.mock("../../apps/web/src/server/config/backend-bindings", () => ({
  validateBackendBindings: () => ({ ok: mocks.bindingsValid }),
}));
import proxy from "../../apps/web/src/proxy";

describe("T56 privacy entry guards — SDK initialization mocked, no signed-in acceptance", () => {
  beforeEach(() => {
    mocks.authentication.mockClear();
    mocks.bindingsValid = true;
    vi.stubEnv("SHOP_REFERENCE_PREVIEW", "0");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "development");
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each([
    "/account/privacy",
    "/account/privacy/data",
    "/account/privacy/download",
  ])("initializes current auth and refuses caching for %s", async (route) => {
    const response = await proxy(
      new NextRequest("http://127.0.0.1:6419" + route + "?lang=bg", {
        headers: { "x-treido-entry": "/ops", "x-treido-locale": "en" },
      }),
      {} as NextFetchEvent,
    );
    if (!response) throw new Error("Expected a concrete middleware response");
    expect(mocks.authentication).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toContain("Cookie");
    expect(response.headers.get("x-middleware-request-x-treido-entry")).toBe(
      route + "?lang=bg",
    );
    expect(response.headers.get("x-middleware-request-x-treido-locale")).toBe(
      "bg",
    );
  });
  it.each(["bg", "en"])(
    "binding outage retains private no-store and %s locale",
    async (lang) => {
      mocks.bindingsValid = false;
      const response = await proxy(
        new NextRequest(
          "http://127.0.0.1:6419/account/privacy/data?lang=" + lang,
        ),
        {} as NextFetchEvent,
      );
      if (!response) throw new Error("Expected a concrete middleware response");
      expect(mocks.authentication).not.toHaveBeenCalled();
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toContain("Cookie");
      expect(response.headers.get("x-middleware-request-x-treido-locale")).toBe(
        lang,
      );
    },
  );
  it("preserves the explicit device-local reference boundary", async () => {
    vi.stubEnv("SHOP_REFERENCE_PREVIEW", "1");
    await proxy(
      new NextRequest("http://127.0.0.1:6418/account/privacy?lang=en"),
      {} as NextFetchEvent,
    );
    expect(mocks.authentication).not.toHaveBeenCalled();
  });
  it("a hosted flag cannot revive reference mode", async () => {
    vi.stubEnv("SHOP_REFERENCE_PREVIEW", "1");
    vi.stubEnv("VERCEL", "1");
    const response = await proxy(
      new NextRequest("https://treido.invalid/account/privacy/data?lang=en"),
      {} as NextFetchEvent,
    );
    if (!response) throw new Error("Expected a concrete middleware response");
    expect(mocks.authentication).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
