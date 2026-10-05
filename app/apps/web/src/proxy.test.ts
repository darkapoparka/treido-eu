import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  configured: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (callback: (auth: unknown, request: NextRequest) => unknown) =>
    (request: NextRequest) => {
      mocks.authenticate();
      return callback(null, request);
    },
}));
vi.mock("./server/config/backend-bindings", () => ({
  validateBackendBindings: mocks.configured,
}));
import proxy, { config } from "./proxy";

describe("locale request routing without changing private authentication", () => {
  beforeEach(() => {
    mocks.authenticate.mockClear();
    mocks.configured.mockReturnValue({ ok: true });
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
  it.each([
    "/checkout",
    "/checkout/reviews/review-id",
    "/checkout/payments/payment-id/shipping",
    "/reservations/reservation-id",
    "/orders/order-id",
    "/api/seller-media/owned-image",
    "/api/message-attachments/owned-image",
    "/api/assistants/runs",
    "/api/assistants/media/owned-image",
    "/account/privacy/preferences",
    "/account/privacy/security",
    "/account/privacy/closure",
    "/account/privacy/promotions",
    "/account/privacy/data",
    "/account/privacy/download",
  ])(
    "provides Clerk session context to the real private entry %s",
    async (path) => {
      expect(
        unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }),
      ).toBe(true);
      const response = (await proxy(
        new NextRequest(`https://treido.invalid${path}`),
        {} as NextFetchEvent,
      )) as NextResponse;
      expect(mocks.authenticate).toHaveBeenCalledOnce();
      if (path.startsWith("/account/privacy/")) {
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(response.headers.get("Vary")).toContain("Cookie");
      }
    },
  );
  it.each([
    "/api/stripe/webhook",
    "/api/inngest",
    "/api/internal/outbox",
    "/api/listing-media/listing/image",
    "/api/products/listing/context",
    "/api/reference-media/artwork",
    "/api/reference-font/inter",
    "/api/reference-video/artwork",
  ])("keeps the non-session API outside the Clerk matcher: %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      false,
    );
  });
  it.each(["/api/assistants/runs", "/account/privacy/security"])(
    "does not call Clerk on a reference or unbound entry %s",
    async (path) => {
      vi.stubEnv("SHOP_REFERENCE_PREVIEW", "1");
      vi.stubEnv("NODE_ENV", "development");
      await proxy(
        new NextRequest(`http://localhost:6418${path}`),
        {} as NextFetchEvent,
      );
      expect(mocks.authenticate).not.toHaveBeenCalled();
      vi.stubEnv("SHOP_REFERENCE_PREVIEW", "0");
      mocks.configured.mockReturnValue({ ok: false });
      await proxy(
        new NextRequest(`http://localhost:6419${path}`),
        {} as NextFetchEvent,
      );
      expect(mocks.authenticate).not.toHaveBeenCalled();
    },
  );
});
