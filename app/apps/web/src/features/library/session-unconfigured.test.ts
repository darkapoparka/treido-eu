import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const hooks = vi.hoisted(() => ({
  provider: vi.fn(),
  auth: vi.fn(),
  clerk: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: hooks.provider,
  useAuth: hooks.auth,
  useClerk: hooks.clerk,
}));
vi.mock("./actions", () => ({
  readLibraryAction: vi.fn(),
  changeLibraryAction: vi.fn(),
}));
vi.mock("../buyer-cart/actions", () => ({ readBuyerCartAction: vi.fn() }));
import { BuyerSessionBoundary } from "./session-boundary";
import { useLibraryController } from "./use-library";
import { useBuyerCartController } from "../buyer-cart/use-cart";

describe("T71 unconfigured/reference-safe session seam", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  it("leaves children unchanged and never calls Clerk outside its provider", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    expect(
      renderToStaticMarkup(
        createElement(
          BuyerSessionBoundary,
          null,
          createElement("span", null, "reference child"),
        ),
      ),
    ).toBe("<span>reference child</span>");
    expect(hooks.provider).not.toHaveBeenCalled();
    expect(hooks.auth).not.toHaveBeenCalled();
    expect(hooks.clerk).not.toHaveBeenCalled();
  });
  it("keeps unconfigured private projections unavailable rather than fabricated guest success", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    function Probe() {
      const library = useLibraryController({}),
        cart = useBuyerCartController(
          { actorKey: "A", revision: 1, lines: [] },
          "synthetic-A",
        );
      return createElement(
        "span",
        null,
        JSON.stringify({
          library: library.status,
          error: library.loadError,
          libraryView: library.view,
          cart: cart.status,
          cartView: cart.cart,
        }),
      );
    }
    const markup = renderToStaticMarkup(
      createElement(BuyerSessionBoundary, null, createElement(Probe)),
    );
    expect(markup).toContain("NOT_AVAILABLE");
    expect(markup).not.toContain("synthetic-A");
    expect(markup).toContain("&quot;libraryView&quot;:null");
    expect(markup).toContain("&quot;cartView&quot;:null");
    expect(hooks.auth).not.toHaveBeenCalled();
  });
});
