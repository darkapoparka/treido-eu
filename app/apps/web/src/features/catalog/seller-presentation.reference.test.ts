import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { Catalog, Product, Store } from "./types";
import {
  merchantPresentation,
  hasMerchantPresentation,
} from "./seller-presentation";
import { projectMerchantCatalog } from "./reference/merchant-catalog";
import { merchantProducts } from "./reference/merchant-catalog-model";
import { readReferenceCatalog } from "./reference/adapter.server";

const seller = (id: string, name: string): Store => ({
  id,
  name,
  logo: `/seller/${id}.webp`,
  description: "",
  ratingCount: "",
  categories: [],
});
const product = (id: string, storeId: string): Product => ({
  id,
  storeId,
  title: id,
  category: "Home",
  images: [`/product/${id}.webp`],
  price: { amount: 1200, currency: "EUR" },
  description: "",
  ratingCount: "",
  saleUnit: "piece",
  variants: [{ id: `${id}-variant`, label: "One", availableQuantity: null }],
});

it("gives every live seller the shared shell without inventing ratings or reviews", () => {
  const catalog: Catalog = {
    liveHomeStoreIds: ["one"],
    stores: [
      seller("one", "Моят нов магазин"),
      seller("two", "Another new seller"),
    ],
    products: [product("mine", "one"), product("theirs", "two")],
  };
  const result = projectMerchantCatalog(catalog);
  for (const store of result.stores) {
    expect(hasMerchantPresentation(store)).toBe(true);
    const presentation = merchantPresentation(store);
    expect(presentation.source).toBe("catalog");
    expect(presentation.avatar).toBe(store.logo);
    expect(presentation.rating).toBeUndefined();
    expect(presentation.reviews).toBeUndefined();
    expect(presentation.productIds).toEqual(
      catalog.products.filter((p) => p.storeId === store.id).map((p) => p.id),
    );
    expect(presentation.categories?.[0].productIds).toEqual(
      presentation.productIds,
    );
  }
  expect(result.products).toBe(catalog.products);
  expect(
    catalog.stores.every((store) => store.referenceMerchant === undefined),
  ).toBe(true);
});

it("joins duplicate reference entries for one brand while excluding a different seller", () => {
  const first = seller("home-entry", "Моят магазин");
  const catalog: Catalog = {
    stores: [
      first,
      seller("editorial-entry", "МОЯТ МАГАЗИН"),
      seller("other", "Other seller"),
    ],
    products: [
      product("a", "home-entry"),
      product("b", "editorial-entry"),
      product("foreign", "other"),
    ],
  };
  expect(merchantProducts(first, catalog).map((p) => p.id)).toEqual(["a", "b"]);
});

it("preserves frozen scenario records and their original seller rendering", async () => {
  const frozen = await readReferenceCatalog("reference-default");
  expect(projectMerchantCatalog(frozen)).toBe(frozen);
  expect(
    frozen.stores.every((store) => store.referenceMerchant === undefined),
  ).toBe(true);
  expect(
    hasMerchantPresentation(
      frozen.stores.find((store) => store.id === "kitsch")!,
    ),
  ).toBe(false);
});

it("assembles the shared template for the whole current live catalog with seller-owned review data", async () => {
  const catalog = projectMerchantCatalog(await readReferenceCatalog());
  expect(catalog.stores.length).toBeGreaterThan(20);
  expect(catalog.stores.every(hasMerchantPresentation)).toBe(true);
  const belle = merchantPresentation(
    catalog.stores.find((store) => store.id === "live-belleboxbg")!,
  );
  expect(belle.background).toBe("#4d4d4d");
  expect(belle.reviews).toBeUndefined();
  const ourPlace = merchantPresentation(
    catalog.stores.find((store) => store.id === "live-explore-our-place")!,
  );
  expect(ourPlace.reviews?.length).toBeGreaterThan(0);
  expect(
    ourPlace.reviews?.every(
      (review) => !review.productTitle.includes("Shampoo"),
    ),
  ).toBe(true);
});
