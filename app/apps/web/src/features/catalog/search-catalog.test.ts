import { describe, expect, it } from "vitest";
import { referenceCatalog } from "./reference/catalog";
import { toSearchCatalog } from "./search-catalog";
import {
  emptyFilters,
  searchProducts,
  searchStores,
} from "../discovery/search-model";

describe("search projection", () => {
  it("keeps display data and ordering without mutating the source", () => {
    const before = JSON.stringify(referenceCatalog);
    const result = toSearchCatalog(referenceCatalog);
    expect(result.products.map((p) => p.id)).toEqual(
      referenceCatalog.products.map((p) => p.id),
    );
    expect(result.stores.map((s) => s.id)).toEqual(
      referenceCatalog.stores.map((s) => s.id),
    );
    for (const [i, p] of result.products.entries()) {
      const original = referenceCatalog.products[i];
      expect(p.images).toEqual(original.images.slice(0, 1));
      expect(p.price).toEqual(original.price);
      expect(p.ratingCount).toBe(original.ratingCount);
      expect(p.referenceThumbnails).toEqual(original.referenceThumbnails);
      expect(p.variants).toEqual(
        original.variants.map(({ label, availableQuantity }) => ({
          label,
          availableQuantity,
        })),
      );
      expect(p).not.toHaveProperty("detail");
      expect(p).not.toHaveProperty("description");
    }
    expect(result).not.toHaveProperty("savedListings");
    for (const store of result.stores)
      expect(store).not.toHaveProperty("referencePolicies");
    expect(JSON.stringify(referenceCatalog)).toBe(before);
  });
  it("preserves every existing search facet and store match", () => {
    const projected = toSearchCatalog(referenceCatalog);
    const cases = [
      emptyFilters,
      ...Object.entries({
        deals: true,
        following: true,
        sort: "Newest",
        category: "Women",
        color: "Black",
        size: "M",
        gender: "Men",
        price: "Under $50",
        ratings: "4 stars and up",
        country: "United States",
        origin: "United States",
      }).map(([key, value]) => ({ ...emptyFilters, [key]: value })),
    ];
    for (const query of ["", "jeans", "men", "kitsch", "unknown"])
      for (const filters of cases) {
        const followed = referenceCatalog.stores.slice(0, 2).map((s) => s.id);
        const full = searchProducts(referenceCatalog, query, filters, followed);
        const lean = searchProducts(projected, query, filters, followed);
        expect(lean.map((p) => p.id)).toEqual(full.map((p) => p.id));
        expect(
          searchStores(projected, query, filters, lean).map((s) => s.id),
        ).toEqual(
          searchStores(referenceCatalog, query, filters, full).map((s) => s.id),
        );
      }
  });
  it("handles empty data and absent live mode without inventing values", () => {
    expect(toSearchCatalog({ products: [], stores: [] })).toEqual({
      products: [],
      stores: [],
      liveHomeStoreIds: undefined,
    });
    expect(
      toSearchCatalog({ ...referenceCatalog, liveHomeStoreIds: [] })
        .liveHomeStoreIds,
    ).toEqual([]);
  });
});

it("does not serialize extra or detail-only fields from upstream records", () => {
  const original = referenceCatalog.products[0];
  const product = {
    ...original,
    internalNote: "PRIVATE_SENTINEL",
    description: "PRIVATE_SENTINEL",
    images: [original.images[0], "PRIVATE_SENTINEL"],
    price: { ...original.price, internalCost: "PRIVATE_SENTINEL" },
    detail: { highlights: ["PRIVATE_SENTINEL"] },
    variants: original.variants.map((variant) => ({
      ...variant,
      internalNote: "PRIVATE_SENTINEL",
    })),
  };
  const store = {
    ...referenceCatalog.stores[0],
    internalNote: "PRIVATE_SENTINEL",
  };
  const result = toSearchCatalog({ products: [product], stores: [store] });
  expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
});
