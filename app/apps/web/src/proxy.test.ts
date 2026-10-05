import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (callback: (auth: unknown, request: NextRequest) => unknown) =>
    (request: NextRequest) => {
      mocks.authenticate();
      return callback(null, request);
    },
}));
vi.mock("./server/config/backend-bindings", () => ({
  validateBackendBindings: () => ({ ok: true }),
}));
import proxy from "./proxy";

describe("locale request routing without changing private authentication", () => {
  beforeEach(() => {
    mocks.authenticate.mockClear();
    vi.stubEnv("SHOP_REFERENCE_PREVIEW", "0");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("overwrites forged locale hints while authenticating real buyer routes", async () => {
    const request = new NextRequest(
      "https://treido.invalid/search?lang=bg&seller=business",
      {
        headers: {
          "accept-language": "en-US",
          "x-treido-locale": "en",
          "x-treido-locale-source": "spoofed",
          cookie: "treido-locale=en",
        },
      },
    );
    const response = (await proxy(
      request,
      {} as NextFetchEvent,
    )) as NextResponse;
    expect(response.headers.get("x-middleware-request-x-treido-locale")).toBe(
      "bg",
    );
    expect(
      response.headers.get("x-middleware-request-x-treido-locale-source"),
    ).toBe("url");
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.authenticate).toHaveBeenCalledOnce();
  });
  it("keeps the explicit reference preview independent of buyer authentication", async () => {
    vi.stubEnv("SHOP_REFERENCE_PREVIEW", "1");
    vi.stubEnv("NODE_ENV", "development");
    const response = (await proxy(
      new NextRequest("http://localhost:6418/search?lang=bg"),
      {} as NextFetchEvent,
    )) as NextResponse;
    expect(response.headers.get("x-middleware-request-x-treido-locale")).toBe(
      "bg",
    );
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it.each(["/app", "/app/products", "/ops", "/sign-in", "/sign-up", "/sell"])(
    "retains the original Clerk path %s",
    async (path) => {
      const response = (await proxy(
        new NextRequest(`https://treido.invalid${path}?lang=bg`),
        {} as NextFetchEvent,
      )) as NextResponse;
      expect(mocks.authenticate).toHaveBeenCalledOnce();
      expect(response.headers.get("x-middleware-request-x-treido-entry")).toBe(
        `${path}?lang=bg`,
      );
      expect(response.headers.get("x-middleware-request-x-treido-locale")).toBe(
        "bg",
      );
    },
  );
});
