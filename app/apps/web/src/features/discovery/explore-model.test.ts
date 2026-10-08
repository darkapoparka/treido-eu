import { expect, it } from "vitest";
import {
  browseCategoryRoots,
  getBrowseChildren,
} from "@treido/contracts/categories";
import { readDiscoveryInput } from "../catalog/discovery-input";
import {
  exploreCategoryTiles,
  exploreHref,
  publicExploreBackHref,
  publicExploreShelves,
} from "./explore-model";
import type { PublicListingCard } from "../catalog/public-discovery-model";
import type { PromotionPlacement } from "../promotions/placement";
it("root tiles expose actual canonical taxonomy without captured artwork", () => {
  const tiles = exploreCategoryTiles({
    input: readDiscoveryInput({
      lang: "bg",
      seller: "business",
      minPrice: "10",
    }).input,
    unavailable: true,
  });
  expect(tiles.map((tile) => tile.id)).toEqual(
    browseCategoryRoots.map((category) => category.id),
  );
  expect(tiles.every((tile) => tile.photos.length === 0)).toBe(true);
  const tile = tiles.find((tile) => tile.id === "cat:beauty-care")!;
  expect(tile.title).toBe("Красота");
  expect(
    tiles.every((tile) => tile.artwork?.startsWith("/artwork/categories/")),
  ).toBe(true);
  expect(tile.href).toContain("/explore/cat%3Abeauty-care?");
  expect(tile.href).toContain("seller=business");
  expect(tile.href).toContain("minPrice=10");
  expect(tile.href).toContain("lang=bg");
});
it("departments navigate through the owning browse groups to stable leaves", () => {
  const input = readDiscoveryInput({ category: "cat:beauty-care" }).input;
  const tiles = exploreCategoryTiles({ input });
  expect(tiles.map((tile) => tile.id)).toEqual(
    getBrowseChildren("cat:beauty-care").map((category) => category.id),
  );
  expect(tiles.some((tile) => tile.id === "nav:beauty-care/cosmetics")).toBe(
    true,
  );
  expect(
    exploreCategoryTiles({
      input: readDiscoveryInput({ category: "nav:beauty-care/cosmetics" })
        .input,
    }).some((tile) => tile.id === "cat:beauty-care/sealed-skincare"),
  ).toBe(true);
  expect(
    exploreCategoryTiles({
      input: readDiscoveryInput({ category: "cat:beauty-care/sealed-skincare" })
        .input,
    }),
  ).toEqual([]);
});
it("category transitions preserve public filters/locale and retire cursor", () => {
  const input = readDiscoveryInput({
    category: "cat:electronics/phones",
    seller: "personal",
    condition: "good",
    maxPrice: "300",
    lang: "bg",
    sort: "price_asc",
  }).input;
  const href = exploreHref(input);
  expect(href).toContain("/explore/cat%3Aelectronics%2Fphones?");
  expect(href).toContain("seller=personal");
  expect(href).toContain("condition=good");
  expect(href).toContain("maxPrice=300");
  expect(href).toContain("sort=price_asc");
  expect(href).not.toContain("cursor=");
  expect(exploreHref(input, "signed-cursor")).toContain("cursor=signed-cursor");
});
it("direct root Back returns to clean Explore with the same seller scope and explicit locale", () => {
  const input = readDiscoveryInput({
    category: "cat:electronics",
    q: "phone",
    seller: "business",
    condition: "good",
    maxPrice: "300",
    lang: "bg",
    sort: "price_asc",
  }).input;
  expect(publicExploreBackHref(input)).toBe("/explore?seller=business&lang=bg");
});
it("direct leaf Back returns to its actual parent with compatible browse criteria", () => {
  const input = readDiscoveryInput({
    category: "cat:electronics/phones",
    seller: "personal",
    condition: "good",
    maxPrice: "300",
    lang: "en",
    sort: "price_asc",
  }).input;
  const href = publicExploreBackHref(input);
  expect(href).toContain("/explore/nav%3Aelectronics%2Fmobile?");
  const params = new URL(href, "http://localhost").searchParams;
  expect(Object.fromEntries(params)).toEqual({
    category: "nav:electronics/mobile",
    seller: "personal",
    condition: "good",
    maxPrice: "300.00",
    currency: "EUR",
    sort: "price_asc",
    lang: "en",
  });
});

it("real shelves preserve every ranked placement and sponsorship token without invented ratings/editorial data", () => {
  const input = readDiscoveryInput({
    lang: "bg",
    seller: "personal",
    maxPrice: "300",
  }).input;
  const listing: PublicListingCard = {
    id: "actual-id",
    title: "Actual publication",
    images: ["/api/listing-media/id/photo"],
    price: { amount: 1250, currency: "EUR" },
    ratingCount: "",
    seller: { id: "actual-seller", name: "Actual seller", kind: "personal" },
    categoryId: "cat:electronics/phones",
    condition: "good",
    locality: "София",
    publishedAt: "2026-10-06T00:00:00Z",
  };
  const placement: PromotionPlacement = {
    listing,
    sponsored: {
      campaignId: "actual-campaign",
      token: "actual-token",
      label: "Sponsored",
      labelBg: "Спонсорирано",
      promotedFreshnessAt: null,
    },
  };
  const page = {
    input,
    items: [listing],
    total: 1,
    facets: { categories: [], conditions: [], sellers: [] },
    nextCursor: null,
    cursorReset: false,
    placements: [placement],
  };
  const shelves = publicExploreShelves({ input, page });
  expect(shelves).toHaveLength(1);
  expect(shelves[0].categoryId).toBe("cat:electronics");
  expect(shelves[0].href.split("?")[0]).toBe("/explore/cat%3Aelectronics");
  expect(shelves[0].placements[0]).toBe(placement);
  expect(shelves[0].href).toContain("category=cat%3Aelectronics");
  expect(shelves[0].href).toContain("seller=personal");
  expect(shelves[0].href).toContain("maxPrice=300");
  expect(shelves[0].href).toContain("lang=bg");
  expect(shelves[0]).not.toHaveProperty("editorial");
  expect(shelves[0].placements[0].listing).not.toHaveProperty("rating");
  expect(publicExploreShelves({ input, unavailable: true })).toEqual([]);
});
