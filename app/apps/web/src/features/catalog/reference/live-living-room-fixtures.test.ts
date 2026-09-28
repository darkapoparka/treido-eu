import { describe, expect, it } from "vitest";
import {
  livingRoomProducts,
  livingRoomStores,
  projectLivingRoom,
} from "./live-living-room-fixtures";
import { variantSelectionLimit, referenceVariantProduct } from "../types";

describe("native Living room snapshots", () => {
  it("preserves all ten source products in their collection order", () => {
    expect(
      projectLivingRoom([...livingRoomProducts].reverse()).map((p) => p.id),
    ).toEqual(livingRoomProducts.map((p) => p.id));
    expect(livingRoomProducts).toHaveLength(10);
    expect(new Set(livingRoomStores.map((s) => s.id)).size).toBe(9);
    expect(
      livingRoomProducts.every((p) =>
        livingRoomStores.some((s) => s.id === p.storeId),
      ),
    ).toBe(true);
  });
  it("keeps all 84 captured prices separate from unknown inventory", () => {
    expect(livingRoomProducts.reduce((n, p) => n + p.variants.length, 0)).toBe(
      84,
    );
    for (const product of livingRoomProducts)
      for (const variant of product.variants) {
        expect(variant.availableQuantity).toBeNull();
        expect(Number.isSafeInteger(variant.referencePrice?.amount)).toBe(true);
        expect(variant.referencePrice?.amount).toBeGreaterThan(0);
        if (variant.referenceUnavailable)
          expect(variantSelectionLimit(variant)).toBe(0);
      }
  });
  it("does not silently replace the source's unavailable moss entry", () => {
    const product = livingRoomProducts.find((p) => p.id === "live-home-barts")!;
    const selected = product.variants.find(
      (v) => v.id === product.referenceDefaultVariantId,
    )!;
    expect(selected.referenceColor?.unavailable).toBe(true);
    expect(referenceVariantProduct(product, selected).price).toEqual({
      amount: 13685,
      currency: "USD",
    });
    expect(
      projectLivingRoom(livingRoomProducts).find((p) => p.id === product.id)
        ?.price,
    ).toEqual({ amount: 13260, currency: "USD" });
    expect(variantSelectionLimit(selected)).toBe(0);
  });
  it("retains the olive sizes and native photograph without fabricated stock", () => {
    const product = livingRoomProducts.find((p) => p.id === "live-home-olive")!;
    expect(product.referenceImageTreatment).toBe("native");
    expect(product.variants.map((v) => v.referencePrice?.amount)).toEqual([
      24000, 26000,
    ]);
    expect(product.variants.map((v) => v.referenceOptions?.Size)).toEqual([
      "Medium",
      "Large",
    ]);
    expect(product.images[0]).toContain("olive-native-1");
  });
  it("never substitutes another product when a collection input is missing", () => {
    expect(projectLivingRoom([])).toEqual([]);
    const source = livingRoomProducts.filter((p) => p.id !== "live-home-kobon");
    expect(projectLivingRoom(source)).toHaveLength(9);
    expect(
      projectLivingRoom(source).some((p) => p.id === "live-home-kobon"),
    ).toBe(false);
  });
});
