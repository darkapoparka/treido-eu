import { describe, expect, it } from "vitest";
import {
  referenceVariantProduct,
  variantSelectionLimit,
  type ProductVariant,
} from "../apps/web/src/features/catalog/types";
import { liveLowerShelfProducts } from "../apps/web/src/features/catalog/reference/live-lower-shelf-fixtures";

describe("native lower-shelf snapshots", () => {
  it("keeps inventory unknown for every observed option", () => {
    for (const product of liveLowerShelfProducts) {
      expect(product.images.length).toBeGreaterThan(0);
      for (const variant of product.variants) {
        expect(variant.availableQuantity).toBeNull();
        expect(Number.isSafeInteger(variant.referencePrice?.amount)).toBe(true);
        expect(variant.referencePrice?.amount).toBeGreaterThan(0);
      }
    }
  });
  it("source unavailable flags override selectable reference controls", () => {
    const option: ProductVariant = {
      id: "test",
      label: "test",
      availableQuantity: null,
      referenceSelectable: true,
      referenceUnavailable: true,
    };
    expect(variantSelectionLimit(option)).toBe(0);
  });
  it("honors an observed one-item UI cap without inventing inventory", () => {
    const option: ProductVariant = {
      id: "test",
      label: "test",
      availableQuantity: null,
      referenceSelectable: true,
      referenceQuantityLimit: 1,
    };
    expect(variantSelectionLimit(option)).toBe(1);
    expect(option.availableQuantity).toBeNull();
    for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        variantSelectionLimit({ ...option, referenceQuantityLimit: limit }),
      ).toBe(0);
    }
  });
  it("retains the complete observed Jordan sizes and variant-specific prices", () => {
    const product = liveLowerShelfProducts.find(
      (p) => p.id === "live-explore-jordan-legend",
    )!;
    expect(product.images).toHaveLength(6);
    expect(product.variants).toHaveLength(26);
    expect(new Set(product.variants.map((v) => v.id)).size).toBe(26);
    const chosen = product.variants.find((v) =>
      v.label.startsWith("Men's US 11 /"),
    )!;
    expect(referenceVariantProduct(product, chosen).price).toEqual({
      amount: 27261,
      currency: "USD",
    });
    expect(product.price).toEqual({ amount: 36387, currency: "USD" });
  });
});
