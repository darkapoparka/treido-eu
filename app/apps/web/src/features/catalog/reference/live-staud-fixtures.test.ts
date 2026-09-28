import { describe, expect, it } from "vitest";
import { staudProducts, staudStore } from "./live-staud-fixtures";
import { variantSelectionLimit } from "../types";
describe("native Staud curation snapshot", () => {
  it("retains the 36 observed identities and EUR prices without duplicating products", () => {
    expect(staudProducts).toHaveLength(36);
    expect(new Set(staudProducts.map((p) => p.id)).size).toBe(36);
    expect(staudProducts[0].title).toBe("DAVINA SILK TOP | PEAR");
    expect(staudProducts.at(-1)?.title).toBe("FELICITY DRESS | CIGAR");
    for (const product of staudProducts) {
      expect(product.storeId).toBe(staudStore.id);
      expect(product.price.currency).toBe("EUR");
      expect(product.price.amount).toBeGreaterThan(0);
      expect(product.images.length).toBeGreaterThan(0);
    }
  });
  it("keeps selectable reference sizes distinct from actual inventory", () => {
    for (const product of staudProducts)
      for (const variant of product.variants) {
        expect(variant.availableQuantity).toBeNull();
        expect(variantSelectionLimit(variant) > 0).toBe(
          variant.referenceSelectable === true,
        );
      }
    const davina = staudProducts[0];
    expect(davina.detail?.referenceBadgeVariantId).toBe(davina.variants[0].id);
    expect(davina.detail?.specifications).toHaveLength(6);
  });
});
