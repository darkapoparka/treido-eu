import { describe, expect, it } from "vitest";
import type { Store } from "../apps/web/src/features/catalog/types";
import { referenceScenarios } from "../apps/web/src/features/catalog/reference/scenarios";
import { storefrontProjection } from "../apps/web/src/features/catalog/reference/store-fixtures";
import { productDetailProjection } from "../apps/web/src/features/catalog/reference/detail-fixtures";
import { referenceCatalog } from "../apps/web/src/features/catalog/reference/catalog";
import { capturedLineAmount } from "../apps/web/src/features/commerce/pricing";

const kitsch: Store = {
  id: "kitsch",
  name: "KITSCH",
  logo: "",
  ratingCount: "194.9K",
  categories: ["Shop all"],
  description: "",
};
const other: Store = { ...kitsch, id: "other", name: "Other" };
const stores = [kitsch, other];

describe("recorded KITSCH product-entry snapshots", () => {
  it("owns its observed offer/count and empty cart without seeding unknown Follow status", () => {
    for (const [name, savings, ratingCount] of [
      ["kitsch-product-arrival", 15, "194.9K"],
      ["kitsch-product-settled", 20, "195K"],
    ] as const) {
      const projected = storefrontProjection(stores, name);
      expect(projected[0]).toEqual({
        ...kitsch,
        promotionSavings: savings,
        ratingCount,
        ...(name === "kitsch-product-arrival"
          ? {
              capturedGrid: {
                productIds: [
                  "rice-shampoo",
                  "rice-conditioner",
                  "rice-bundle",
                  "shea-butter",
                ],
                unidentifiedPhotos: [
                  "/api/reference-media/store-arrival-tail-left",
                  "/api/reference-media/store-arrival-tail-right",
                ],
              },
            }
          : {}),
      });
      expect(projected[0]?.recommendations).toBeUndefined();
      expect(projected[1]).toBe(other);
      expect(referenceScenarios[name].discovery.cart).toEqual([]);
      expect(referenceScenarios[name].discovery).not.toHaveProperty("followed");
    }
    expect(kitsch).not.toHaveProperty("promotionSavings");
  });

  it("projects the later save-entry presentation and retains canonical prices and stock", () => {
    const name = "kitsch-product-saving-offer";
    const products = referenceCatalog.products;
    const shea = products.find((product) => product.id === "shea-butter")!;
    const projected = productDetailProjection(products, name);
    const savedEntry = projected.find((product) => product.id === shea.id)!;
    expect(savedEntry).toEqual({
      ...shea,
      promotion: "20% off your order",
      detail: {
        ...shea.detail,
        arrivalLabel: "Arrives as soon as Sun, Aug 2",
        promotionTerms: "Applied at checkout",
        promotionIcon: "plain-bag",
        merchantLogoOutline: false,
      },
    });
    expect(savedEntry.price).toBe(shea.price);
    expect(savedEntry.variants).toBe(shea.variants);
    expect(
      capturedLineAmount(
        { productId: savedEntry.id, variantId: savedEntry.variants[0]!.id },
        savedEntry.price.amount,
      ),
    ).toBe(1400);
    expect(projected.filter((product) => product.id !== shea.id)).toEqual(
      products.filter((product) => product.id !== shea.id),
    );
    expect(productDetailProjection(products, "kitsch-product-settled")).toBe(
      products,
    );
    expect(productDetailProjection(products, undefined)).toBe(products);
    expect(shea.promotion).toBeUndefined();
    expect(shea.detail?.arrivalLabel).toBeUndefined();
    expect(storefrontProjection(stores, name)).toEqual([
      { ...kitsch, ratingCount: "195.2K" },
      other,
    ]);
    expect(referenceScenarios[name].discovery.saved).toEqual([]);
    expect(referenceScenarios[name].discovery).not.toHaveProperty("followed");
    expect(referenceScenarios[name].discovery).not.toHaveProperty("cart");
  });

  it("preserves the ordinary and following-pair storefront snapshots", () => {
    expect(storefrontProjection(stores, "home-welcome")).toBe(stores);
    expect(storefrontProjection(stores, undefined)).toBe(stores);
    expect(storefrontProjection(stores, "following-pair")[0]).toEqual({
      ...kitsch,
      promotionSavings: 15,
      recommendations: [
        { productId: "shea-butter", ratingCount: "3.3K" },
        { productId: "terracotta", ratingCount: "2.1K" },
        { productId: "sugar-scrub" },
      ],
    });
    expect(referenceScenarios["following-pair"].discovery.followed).toEqual([
      "kitsch",
      "pura",
    ]);
    expect(referenceScenarios["home-welcome"].discovery.cart).toEqual([]);
  });
});
