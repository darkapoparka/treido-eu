import { describe, expect, it } from "vitest";
import {
  liveHomeShelfProductIds,
  liveShelfProducts,
  projectLiveHomeShelf,
} from "./live-shelf-fixtures";

describe("native Home shelf projection", () => {
  it("preserves source order without aggregating all Home products", () => {
    const unrelated = {
      ...liveShelfProducts[0],
      id: "unrelated-home-product",
      category: "Home",
    };
    const mixed = [unrelated, ...liveShelfProducts.toReversed()];
    const ids = projectLiveHomeShelf(mixed).map((product) => product.id);
    expect(ids).toEqual(liveHomeShelfProductIds);
  });

  it("does not invent substitutes for absent source products", () => {
    const missingRug = liveShelfProducts.filter(
      (product) => product.id !== "live-explore-verena-rug",
    );
    const ids = projectLiveHomeShelf(missingRug).map((product) => product.id);
    expect(ids).toEqual([
      "live-explore-perfect-pot",
      "live-explore-bubble-blanket",
    ]);
    expect(projectLiveHomeShelf([])).toEqual([]);
  });

  it("keeps shelf labels separate from detail snapshots", () => {
    const products = liveShelfProducts.map((product) =>
      Object.freeze({ ...product, ratingCount: "detail snapshot" }),
    );
    const counts = projectLiveHomeShelf(products).map((p) => p.ratingCount);
    const unchanged = products.every(
      (product) => product.ratingCount === "detail snapshot",
    );
    expect(counts).toEqual(["8.8K", "4.4K", "589"]);
    expect(unchanged).toBe(true);
  });

  it("retains original media, variants, price and unknown stock", () => {
    for (const projected of projectLiveHomeShelf(liveShelfProducts)) {
      const source = liveShelfProducts.find((p) => p.id === projected.id)!;
      const unknownStock = projected.variants.every(
        (variant) => variant.availableQuantity === null,
      );
      expect(projected).not.toBe(source);
      expect(projected.images).toBe(source.images);
      expect(projected.variants).toBe(source.variants);
      expect(projected.price).toBe(source.price);
      expect(projected.detail).toBe(source.detail);
      expect(unknownStock).toBe(true);
    }
  });
});
