import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => mocks.authenticate.mockClear());
  it("overwrites forged locale hints from the validated URL on public routes", () => {
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
    const response = proxy(request, {} as NextFetchEvent) as NextResponse;
    expect(response.headers.get("x-middleware-request-x-treido-locale")).toBe(
      "bg",
    );
    expect(
      response.headers.get("x-middleware-request-x-treido-locale-source"),
    ).toBe("url");
    expect(response.headers.get("location")).toBeNull();
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
