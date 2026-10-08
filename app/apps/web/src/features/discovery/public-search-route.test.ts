import { beforeEach, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  public: vi.fn(),
  reference: vi.fn(),
  catalog: vi.fn(),
}));
vi.mock("@/features/catalog/buyer-entry.server", () => ({
  readBuyerPublicView: boundary.public,
}));
vi.mock("@/features/catalog/buyer-data-mode.server", () => ({
  readBuyerReferenceMode: boundary.reference,
}));
vi.mock("@/features/catalog/queries.server", () => ({
  readSearchCatalog: boundary.catalog,
}));
vi.mock("@/features/catalog/public-metadata.server", () => ({
  readBuyerPageMetadata: vi.fn(),
}));
vi.mock("@/features/locale/request.server", () => ({
  readLocaleRequest: async () => ({ locale: "en" }),
}));
vi.mock("@/features/discovery/search", () => ({ Search: "shop-search" }));
vi.mock(
  "@/features/catalog/discovery-input",
  async () => import("../catalog/discovery-input"),
);
vi.mock(
  "@/features/discovery/marketplace-navigation",
  async () => import("./marketplace-navigation"),
);
vi.mock(
  "@/features/discovery/search-model",
  async () => import("./search-model"),
);
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));
import Page from "../../app/search/page";

beforeEach(() => vi.clearAllMocks());
it("legacy category-result links redirect with keyword, scope, filters and bounded pagination before any supply read", async () => {
  boundary.reference.mockResolvedValue(false);
  await expect(
    Page({
      searchParams: Promise.resolve({
        category: "cat:electronics/phones",
        q: "phone",
        seller: "business",
        maxPrice: "300",
        cursor: `signed-page.${"a".repeat(43)}`,
        lang: "en",
        sellerId: "untrusted-private",
      }),
    }),
  ).rejects.toThrow(
    `REDIRECT:/explore/cat%3Aelectronics%2Fphones?q=phone&category=cat%3Aelectronics%2Fphones&seller=business&maxPrice=300.00&currency=EUR&lang=en&cursor=signed-page.${"a".repeat(43)}`,
  );
  expect(boundary.public).not.toHaveBeenCalled();
  expect(boundary.catalog).not.toHaveBeenCalled();
});
it("unscoped or invalid categories stay genuine Search and never fall back to fixtures", async () => {
  boundary.reference.mockResolvedValue(false);
  const view = { unavailable: true };
  boundary.public.mockResolvedValue(view);
  const raw = { q: "phone", category: "cat:unknown", lang: "en" };
  const page = await Page({ searchParams: Promise.resolve(raw) });
  expect(page.type).toBe("shop-search");
  expect(page.props.publicView).toBe(view);
  expect(boundary.public).toHaveBeenCalledWith(raw);
  expect(boundary.catalog).not.toHaveBeenCalled();
});
it("opt-in replay retains its original Search owner and captured category", async () => {
  boundary.reference.mockResolvedValue(true);
  const catalog = { products: [], stores: [] };
  boundary.catalog.mockResolvedValue(catalog);
  const page = await Page({
    searchParams: Promise.resolve({ category: "Beauty", q: "cream" }),
  });
  expect(page.type).toBe("shop-search");
  expect(page.props.catalog).toBe(catalog);
  expect(page.props.filters.category).toBe("Beauty");
  expect(boundary.public).not.toHaveBeenCalled();
});
