import { describe, expect, it } from "vitest";
import { capturedLineAmount, capturedOfferCompareAt } from "./pricing";

describe("reference unit amounts", () => {
  it("uses the default reference variant", () => {
    const line = { productId: "shampoo-bag", variantId: "shampoo-bag-default" };
    expect(capturedLineAmount(line, 500)).toBe(365);
    expect(capturedOfferCompareAt(line)).toBe(635);
  });
  it("keeps another variant unchanged", () => {
    expect(
      capturedOfferCompareAt({ productId: "shampoo-bag", variantId: "other" }),
    ).toBeUndefined();
    expect(
      capturedLineAmount({ productId: "shampoo-bag", variantId: "other" }, 700),
    ).toBe(700);
  });
  it("keeps another product unchanged", () => {
    expect(
      capturedLineAmount(
        { productId: "other", variantId: "shampoo-bag-default" },
        1400,
      ),
    ).toBe(1400);
  });
  it("keeps quantity separate from the unit amount", () => {
    const line = { productId: "shampoo-bag", variantId: "shampoo-bag-default" };
    expect(capturedLineAmount(line, 500) * 3).toBe(1095);
  });
});
