import { beforeEach, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  reference: vi.fn(),
  catalog: vi.fn(),
  identity: vi.fn(),
  database: vi.fn(),
}));
vi.mock("@/features/catalog/buyer-data-mode.server", () => ({
  readBuyerReferenceMode: boundary.reference,
}));
vi.mock("@/features/catalog/queries.server", () => ({
  readCatalog: boundary.catalog,
}));
vi.mock("@/features/catalog/public-metadata.server", () => ({
  readBuyerPageMetadata: vi.fn(),
}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/features/discovery/saved", () => ({
  Saved: "reference-saved",
  Following: "reference-following",
}));
vi.mock("@/features/library/page", () => ({ BuyerSavedPage: "real-library" }));
vi.mock("@/features/commerce/checkout", () => ({
  CartPage: "reference-cart",
  Checkout: "reference-checkout",
}));
vi.mock("@/features/commerce/pickup", () => ({
  PickupCheckout: "reference-pickup",
}));
vi.mock("@/features/commerce/live-checkout-boundary", () => ({
  LiveCheckoutBoundary: "reference-live-checkout",
}));
vi.mock("@/features/buyer-cart/page", () => ({ BuyerCartPage: "real-cart" }));
vi.mock("@/features/buyer-cart/cart.server", () => ({
  readBuyerCart: vi.fn(),
}));
vi.mock("@/server/identity/clerk.server", () => ({
  readVerifiedIdentity: boundary.identity,
}));
vi.mock("@/server/db/database", () => ({ getDatabase: boundary.database }));
vi.mock("@/features/purchase-reviews/pages.server", () => ({
  PurchaseReviewsPage: "real-checkout",
}));
vi.mock("@/features/shopping-tools/tool-ui", () => ({ ToolHub: "real-tools" }));
vi.mock("@/features/discovery/minis", () => ({ Minis: "reference-minis" }));

import SavedPage from "../../app/saved/page";
import FollowingPage from "../../app/following/page";
import CartPage from "../../app/cart/page";
import CheckoutPage from "../../app/checkout/page";
import MinisPage from "../../app/minis/page";

beforeEach(() => {
  vi.clearAllMocks();
  boundary.catalog.mockResolvedValue({ products: [], stores: [] });
  boundary.identity.mockResolvedValue(null);
});
it.each([
  ["saved", SavedPage, "real-library", "reference-saved"],
  ["following", FollowingPage, "real-library", "reference-following"],
  ["cart", CartPage, "real-cart", "reference-cart"],
  [
    "checkout",
    () => CheckoutPage({ searchParams: Promise.resolve({ lang: "bg" }) }),
    "real-checkout",
    "reference-checkout",
  ],
  ["minis", MinisPage, "real-tools", "reference-minis"],
] as const)(
  "%s uses its existing real adapter without reading fixture data, while default replay stays guarded",
  async (_name, page, real, reference) => {
    boundary.reference.mockResolvedValue(false);
    expect((await page()).type).toBe(real);
    expect(boundary.catalog).not.toHaveBeenCalled();
    boundary.reference.mockResolvedValue(true);
    expect((await page()).type).toBe(reference);
    expect(boundary.catalog).toHaveBeenCalledOnce();
  },
);
it("an unavailable real cart session produces an error state without fixture success", async () => {
  boundary.reference.mockResolvedValue(false);
  boundary.identity.mockRejectedValue(new Error("Unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const page = await CartPage();
    expect(page.type).toBe("real-cart");
    expect(page.props.status).toBe("error");
    expect(page.props.initial).toBeNull();
    expect(boundary.catalog).not.toHaveBeenCalled();
    expect(boundary.database).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});
