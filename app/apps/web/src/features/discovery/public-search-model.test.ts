import { expect, it } from "vitest";
import { readDiscoveryInput } from "../catalog/discovery-input";
import type { PublicListingCard } from "../catalog/public-discovery-model";
import {
  publicSearchCatalog,
  publicSearchQuery,
  publicSearchFilterParams,
  hasPublicSearchFilters,
  clearPublicSearchFilters,
} from "./public-search-model";

it("projects actual bounded Search identity/card data without catalog bodies, snapshots or made-up ratings/stock", () => {
  const item: PublicListingCard = {
    id: "real-listing",
    title: "Real listing",
    images: ["/api/listing-media/real/asset?v=2", "second"],
    price: { amount: 1200, currency: "EUR" },
    priceFrom: true,
    ratingCount: "",
    seller: { id: "real-seller", name: "Real seller", kind: "personal" },
    categoryId: "cat:electronics/phones",
    condition: "good",
    locality: "София",
    publishedAt: "2026-10-06T00:00:00Z",
  };
  const input = readDiscoveryInput({}).input;
  const data = publicSearchCatalog({
    input,
    page: {
      input,
      items: [item],
      total: 1,
      facets: { categories: [], conditions: [], sellers: [] },
      nextCursor: null,
      cursorReset: false,
    },
  });
  expect(data.products[0]).toMatchObject({
    id: item.id,
    price: item.price,
    priceFrom: true,
    images: [item.images[0]],
    storeId: item.seller.id,
    variants: [],
  });
  expect(data.products[0]).not.toHaveProperty("description");
  expect(data.products[0]).not.toHaveProperty("referenceStyle");
  expect(data.products[0]).not.toHaveProperty("rating");
  expect(data.stores).toEqual([
    {
      id: "real-seller",
      name: "Real seller",
      logo: "",
      ratingCount: "",
      categories: [],
    },
  ]);
});
it("changed keyword preserves validated criteria and language while retiring pagination/private inputs", () => {
  const input = readDiscoveryInput({
    category: "cat:electronics/phones",
    seller: "business",
    condition: "good",
    minPrice: "12.50",
    location: "София",
    sort: "price_desc",
    lang: "en",
    "attr.brand": "Apple",
  }).input;
  const next = publicSearchQuery(input, "  TEST  phone ");
  expect(readDiscoveryInput(next).input).toMatchObject({
    ...input,
    q: "TEST phone",
  });
  expect(next.has("cursor")).toBe(false);
  expect(next.has("sellerId")).toBe(false);
});
it("real filters include category/scope/attributes even without q and clear retains the query", () => {
  const input = readDiscoveryInput({
    q: "phone",
    seller: "personal",
    category: "cat:electronics",
    minPrice: "5",
  }).input;
  expect(hasPublicSearchFilters(input)).toBe(true);
  const clear = clearPublicSearchFilters(input);
  expect(clear.q).toBe("phone");
  expect(hasPublicSearchFilters(clear)).toBe(false);
  expect(publicSearchCatalog({ input, unavailable: true }).products).toEqual(
    [],
  );
});
it.each(["bg", "en"])(
  "applying filters and a new query retains explicit %s and current criteria",
  (locale) => {
    const input = readDiscoveryInput({
      category: "cat:electronics/phones",
      seller: "business",
      maxPrice: "101",
      lang: locale,
    }).input;
    for (const params of [
      publicSearchFilterParams(input),
      publicSearchQuery(input, "phone"),
    ]) {
      expect(params.get("lang")).toBe(locale);
      expect(params.get("category")).toBe(input.category);
      expect(params.get("seller")).toBe("business");
      expect(params.get("maxPrice")).toBe("101.00");
      expect(params.has("cursor")).toBe(false);
    }
  },
);
