import { beforeEach, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  data: vi.fn(),
  results: vi.fn(),
  reference: vi.fn(),
}));
vi.mock("@/features/catalog/buyer-entry.server", () => ({
  readBuyerExploreData: boundary.data,
  readBuyerPublicView: boundary.results,
}));
vi.mock("@/features/locale/request.server", () => ({
  readLocaleRequest: async () => ({ locale: "bg" }),
}));
vi.mock(
  "@/features/catalog/discovery-input",
  async () => import("../catalog/discovery-input"),
);
vi.mock(
  "@/features/discovery/marketplace-navigation",
  async () => import("./marketplace-navigation"),
);
vi.mock("@/features/catalog/buyer-data-mode.server", () => ({
  readBuyerReferenceMode: boundary.reference,
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/features/discovery/explore", () => ({ Explore: "shop-explore" }));
vi.mock("@/features/discovery/search", () => ({ Search: "shop-search" }));
import Page from "../../app/explore/[category]/page";

beforeEach(() => vi.clearAllMocks());
it("real data rejects legacy fixture department routes before reading supply", async () => {
  boundary.reference.mockResolvedValue(false);
  await expect(
    Page({
      params: Promise.resolve({ category: "Beauty" }),
      searchParams: Promise.resolve({ lang: "bg" }),
    }),
  ).rejects.toThrow("NOT_FOUND");
  expect(boundary.data).not.toHaveBeenCalled();
});
it("guarded default replay retains its original department owner", async () => {
  boundary.reference.mockResolvedValue(true);
  boundary.data.mockResolvedValue({ catalog: { products: [], stores: [] } });
  const page = await Page({
    params: Promise.resolve({ category: "Beauty" }),
    searchParams: Promise.resolve({ lang: "bg" }),
  });
  expect(page.type).toBe("shop-explore");
  expect(page.props.category).toBe("Beauty");
  expect(boundary.data).toHaveBeenCalledWith({ lang: "bg" }, "Beauty");
});
it("canonical encoded leaf uses the filterable results adapter, never organic Explore sampling", async () => {
  const view = { input: { locale: "bg" }, unavailable: true };
  boundary.results.mockResolvedValue(view);
  const raw = {
    category: "cat:electronics/phones",
    lang: "bg",
    seller: "personal",
    q: "phone",
    maxPrice: "300",
  };
  const page = await Page({
    params: Promise.resolve({ category: "cat%3Aelectronics%2Fphones" }),
    searchParams: Promise.resolve(raw),
  });
  expect(page.type).toBe("shop-search");
  expect(page.props.publicView).toBe(view);
  expect(boundary.reference).not.toHaveBeenCalled();
  expect(boundary.results).toHaveBeenCalledWith(raw, {
    category: "cat:electronics/phones",
  });
  expect(boundary.data).not.toHaveBeenCalled();
});
it("browse groups and the separate Garden department use the genuine adapter", async () => {
  boundary.reference.mockResolvedValue(false);
  boundary.results.mockResolvedValue({ input: { locale: "bg" } });
  for (const category of ["nav:electronics/computers", "cat:garden"]) {
    const page = await Page({
      params: Promise.resolve({ category: encodeURIComponent(category) }),
      searchParams: Promise.resolve({ category, lang: "bg" }),
    });
    expect(page.type).toBe("shop-search");
    expect(boundary.results).toHaveBeenCalledWith(
      { category, lang: "bg" },
      { category },
    );
  }
  expect(boundary.reference).not.toHaveBeenCalled();
  await expect(
    Page({
      params: Promise.resolve({ category: "nav%3Aunknown%2Fgroup" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NOT_FOUND");
});
it.each([undefined, "cat:garden"])(
  "the path repairs absent/conflicting category state before reading results (%s)",
  async (queryCategory) => {
    await expect(
      Page({
        params: Promise.resolve({ category: "cat%3Aelectronics" }),
        searchParams: Promise.resolve({
          category: queryCategory,
          q: "phone",
          seller: "business",
          cursor: `existing-page.${"a".repeat(43)}`,
        }),
      }),
    ).rejects.toThrow(
      `REDIRECT:/explore/cat%3Aelectronics?q=phone&category=cat%3Aelectronics&seller=business&cursor=existing-page.${"a".repeat(43)}&lang=bg`,
    );
    expect(boundary.results).not.toHaveBeenCalled();
  },
);
