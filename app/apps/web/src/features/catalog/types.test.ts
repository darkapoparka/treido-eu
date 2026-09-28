import { describe, expect, it } from "vitest";
import { variantSelectionLimit } from "./types";

describe("reference quantity selection", () => {
  it("does not turn unknown real inventory into a purchasable selection", () => {
    expect(variantSelectionLimit()).toBe(0);
    expect(
      variantSelectionLimit({
        id: "unknown",
        label: "Default",
        availableQuantity: null,
      }),
    ).toBe(0);
  });
  it("allows the observed reference control without claiming a stock count", () => {
    const variant = {
      id: "reference",
      label: "Default",
      availableQuantity: null,
      referenceSelectable: true,
    } as const;
    expect(variantSelectionLimit(variant)).toBe(Number.MAX_SAFE_INTEGER);
    expect(variant.availableQuantity).toBeNull();
  });
  it("retains finite stock limits and rejects invalid quantities", () => {
    for (const amount of [0, 1, 25]) {
      expect(
        variantSelectionLimit({
          id: "stock",
          label: "Default",
          availableQuantity: amount,
        }),
      ).toBe(amount);
    }
    for (const amount of [
      -1,
      0.5,
      Number.POSITIVE_INFINITY,
      Number.NaN,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(
        variantSelectionLimit({
          id: "invalid",
          label: "Default",
          availableQuantity: amount,
        }),
      ).toBe(0);
    }
  });
});
