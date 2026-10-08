import { beforeEach, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  data: vi.fn(),
}));
vi.mock("../catalog/buyer-entry.server", () => ({
  readBuyerExploreData: boundary.data,
}));
vi.mock("./explore", () => ({ Explore: "shop-explore" }));
vi.mock("../locale/request.server", () => ({
  readLocaleRequest: async () => ({ locale: "bg" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));
import Page from "../../app/explore/page";

beforeEach(() => vi.clearAllMocks());

it.each([
  { catalog: { products: [], stores: [] } },
  { publicView: { input: { locale: "bg" }, unavailable: true } },
])(
  "uses the same actual Explore owner for reference/public data (%j)",
  async (data) => {
    boundary.data.mockResolvedValue(data);
    const source = { lang: "bg", seller: "business", condition: "good" };
    const page = await Page({ searchParams: Promise.resolve(source) });
    expect(page.type).toBe("shop-explore");
    expect(page.props).toEqual(data);
    expect(boundary.data).toHaveBeenCalledWith(source);
  },
);
it("query category entry canonicalizes to the same category results route without loading previews", async () => {
  await expect(
    Page({
      searchParams: Promise.resolve({
        category: "nav:electronics/mobile",
        seller: "personal",
        condition: "good",
        lang: "bg",
      }),
    }),
  ).rejects.toThrow(
    "REDIRECT:/explore/nav%3Aelectronics%2Fmobile?category=nav%3Aelectronics%2Fmobile&seller=personal&condition=good&lang=bg",
  );
  expect(boundary.data).not.toHaveBeenCalled();
});
