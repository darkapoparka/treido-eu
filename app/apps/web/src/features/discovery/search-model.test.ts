import assert from "node:assert/strict";
import { test } from "vitest";
import type { Catalog, Product, Store } from "../catalog/types";
import {
  capturedCapQuestion,
  isCapturedCapQuestion,
  categoryValue,
  emptyFilters,
  hasSearchFilters,
  readSearchFilters,
  searchParameters,
  searchProducts,
  searchStores,
  type SearchFilters,
} from "./search-model";

// Deliberately synthetic unit data. It is never imported by a rendered route.
const product = (id: string, extra: Partial<Product> = {}): Product => ({
  id,
  title: `${id} jeans`,
  storeId: "denim",
  category: "Jeans",
  images: [],
  price: { amount: 2400, currency: "USD" },
  ratingCount: "",
  description: "",
  saleUnit: "piece",
  variants: [{ id: `${id}-m`, label: "M", availableQuantity: 2 }],
  ...extra,
});
const stores: Store[] = [
  { id: "denim", name: "Denim Studio", categories: ["Jeans"] },
  { id: "kitsch", name: "KITSCH", categories: ["Cleanse"] },
  { id: "fitjeans", name: "FITJEANS", categories: ["Jeans"] },
  { id: "miss-me", name: "Miss Me", categories: ["Jeans"] },
].map((store) => ({ ...store, logo: "", ratingCount: "", description: "" }));
const catalog: Catalog = {
  stores,
  products: [
    product("women", {
      gender: "Women",
      color: "Black",
      country: "United States",
      shippingDestinations: ["United States"],
      rating: 4.6,
      promotion: "Save $10",
    }),
    product("men", {
      gender: "Men",
      price: { amount: 10000, currency: "USD" },
      referenceNewnessRank: 3,
    }),
    product("sold-out", {
      variants: [{ id: "out", label: "XS", availableQuantity: 0 }],
    }),
    product("eu", { price: { amount: 1000, currency: "EUR" } }),
    product("shampoo", {
      title: "Rice Water Shampoo",
      category: "Cleanse",
      storeId: "kitsch",
    }),
  ],
};
const filters = (patch: Partial<SearchFilters> = {}): SearchFilters => ({
  ...emptyFilters,
  ...patch,
});
const productIds = (
  query = "",
  patch: Partial<SearchFilters> = {},
  followed: string[] = [],
) => searchProducts(catalog, query, filters(patch), followed).map((p) => p.id);

test("accepts both boolean URL spellings consistently", () => {
  for (const value of ["1", "true"]) {
    const parsed = readSearchFilters(
      new URLSearchParams(`following=${value}&deals=${value}`),
    );
    assert.equal(parsed.following, true);
    assert.equal(parsed.deals, true);
  }
});

test("does not interpret false as an enabled quick filter", () => {
  const parsed = readSearchFilters(new URLSearchParams("following=false"));
  assert.equal(parsed.following, false);
});

test("restores Relevance for an empty sort parameter", () => {
  assert.equal(
    readSearchFilters(new URLSearchParams("sort=")).sort,
    "Relevance",
  );
});

test("All Categories is the unfiltered selection", () => {
  assert.equal(categoryValue("All Categories"), "");
  assert.deepEqual(
    productIds("", { category: "All Categories" }),
    productIds(),
  );
});

test("All Women uses declared parent metadata, not a literal leaf name", () => {
  assert.deepEqual(productIds("", { category: "All Women" }), ["women"]);
});

test("Men uses declared gender and excludes unknown metadata", () => {
  assert.deepEqual(productIds("", { category: "Men" }), ["men"]);
});

test("Pants includes the catalog's Jeans category", () => {
  assert.deepEqual(productIds("", { category: "Pants" }), [
    "women",
    "men",
    "sold-out",
    "eu",
  ]);
});

test("matches query words independently of case and excess whitespace", () => {
  assert.deepEqual(productIds("  WOMEN   jeans  "), ["women"]);
});

test("Following works without a text query", () => {
  assert.deepEqual(productIds("", { following: true }, ["kitsch"]), [
    "shampoo",
  ]);
});

test("sort-only and facet-only URLs are results states", () => {
  assert.equal(hasSearchFilters(filters()), false);
  assert.equal(hasSearchFilters(filters({ sort: "Newest" })), true);
  assert.equal(hasSearchFilters(filters({ following: true })), true);
  assert.equal(hasSearchFilters(filters({ category: "Beauty" })), true);
});

test("does not return unavailable variants for a size filter", () => {
  assert.deepEqual(productIds("", { size: "XS" }), []);
});

test("does not invent a shipping destination for unknown products", () => {
  assert.deepEqual(productIds("", { country: "United States" }), ["women"]);
});

test("dollar facets exclude EUR instead of inventing an exchange rate", () => {
  assert.deepEqual(productIds("", { price: "Under $25" }), [
    "women",
    "sold-out",
    "shampoo",
  ]);
});

test("the lower bound for $100 and up is inclusive", () => {
  assert.deepEqual(productIds("", { price: "$100 and up" }), ["men"]);
  assert.equal(productIds("", { price: "Under $100" }).includes("men"), false);
});

test("does not invent ratings for unrated products", () => {
  assert.deepEqual(productIds("", { ratings: "4.5 stars and up" }), ["women"]);
});

test("Newest preserves original catalog order outside the result copy", () => {
  const before = catalog.products.map((p) => p.id);
  assert.equal(productIds("", { sort: "Newest" })[0], "men");
  assert.deepEqual(
    catalog.products.map((p) => p.id),
    before,
  );
});

test("keeps the captured jeans merchants first for the matching query", () => {
  const matches = searchProducts(catalog, "jeans", filters(), []);
  assert.deepEqual(
    searchStores(catalog, "jeans", filters(), matches)
      .slice(0, 2)
      .map((s) => s.id),
    ["fitjeans", "miss-me"],
  );
});

test("does not show the jeans merchant rail for shampoo", () => {
  const matches = searchProducts(catalog, "shampoo", filters(), []);
  assert.deepEqual(
    searchStores(catalog, "shampoo", filters(), matches).map((s) => s.id),
    ["kitsch"],
  );
});

test("merchant rails honor active facets through eligible products", () => {
  const selected = filters({ deals: true });
  const matches = searchProducts(catalog, "jeans", selected, []);
  assert.deepEqual(
    searchStores(catalog, "jeans", selected, matches).map((s) => s.id),
    ["denim"],
  );
});

test("serializes and restores the same selected filters", () => {
  const selected = filters({
    following: true,
    category: "Women",
    sort: "Newest",
    size: "M",
  });
  const params = searchParameters(" jeans ", selected);
  assert.equal(params.get("q"), "jeans");
  assert.deepEqual(readSearchFilters(params), selected);
});

test("clearing filters preserves the search query without false parameters", () => {
  assert.equal(searchParameters("jeans", filters()).toString(), "q=jeans");
});

test("the word men does not match women in search", () => {
  assert.deepEqual(productIds("jeans men"), ["men"]);
});

test("unfinished search words still match word prefixes", () => {
  assert.deepEqual(productIds("jean"), ["women", "men", "sold-out", "eu"]);
});

test("the captured photo question is exact apart from case and whitespace", () => {
  assert.equal(isCapturedCapQuestion(capturedCapQuestion), true);
  assert.equal(
    isCapturedCapQuestion("  FIND ME A  BASEBALL CAP LIKE THIS  "),
    true,
  );
  for (const value of [
    "",
    "baseball cap",
    "Find a waterproof hiking hat instead",
    `${capturedCapQuestion} but in red`,
  ]) {
    assert.equal(isCapturedCapQuestion(value), false);
  }
});
