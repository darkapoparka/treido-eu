import { describe, expect, it } from "vitest";
import { liveShelfProducts } from "../catalog/reference/live-shelf-fixtures";
import {
  referenceVariantProduct,
  variantSelectionLimit,
} from "../catalog/types";
import { nativeOptionChoices } from "./product-variant-options-model";

const rug = liveShelfProducts.find(
  (product) => product.id === "live-explore-verena-rug",
)!;
const blanket = liveShelfProducts.find(
  (product) => product.id === "live-explore-bubble-blanket",
)!;
const pot = liveShelfProducts.find(
  (product) => product.id === "live-explore-perfect-pot",
)!;

describe("native product option projections", () => {
  it("a captured unavailable color never inherits a selectable preview limit", () => {
    const unavailable = {
      ...pot.variants[0],
      referenceSelectable: true as const,
      referenceColor: {
        ...pot.variants[0].referenceColor!,
        unavailable: true as const,
      },
    };
    expect(variantSelectionLimit(unavailable)).toBe(0);
    expect(unavailable.availableQuantity).toBeNull();
  });
  it("retains unknown stock separately from an observed selectable control", () => {
    for (const product of liveShelfProducts)
      for (const variant of product.variants)
        expect(variant.availableQuantity).toBeNull();
    expect(pot.variants).toHaveLength(19);
    expect(
      variantSelectionLimit(
        pot.variants.find((variant) => variant.label === "Clay"),
      ),
    ).toBe(0);
    expect(variantSelectionLimit(pot.variants[0])).toBeGreaterThan(0);
  });
  it("changes a rug size without silently changing the pad system", () => {
    const selected = rug.variants.find(
      (variant) =>
        variant.referenceOptions?.Rug === "Rug + Cushioned Pad System" &&
        variant.referenceOptions.Size === "2'x3'",
    )!;
    const choices = nativeOptionChoices(rug.variants, selected, "Size");
    expect(choices).toHaveLength(13);
    const next = choices.find((choice) => choice.label === "5'x7'")!;
    expect(next.variant.referenceOptions).toEqual({
      Rug: "Rug + Cushioned Pad System",
      Size: "5'x7'",
    });
  });
  it("deduplicates colors while retaining the selected blanket size", () => {
    const selected = blanket.variants.find(
      (variant) =>
        variant.referenceOptions?.Color === "Creme" &&
        variant.referenceOptions.Size.startsWith("Large"),
    )!;
    const choices = nativeOptionChoices(blanket.variants, selected, "Color");
    expect(choices).toHaveLength(6);
    expect(
      choices.find((choice) => choice.label === "Walnut")!.variant
        .referenceOptions?.Size,
    ).toBe(selected.referenceOptions?.Size);
    expect(choices.find((choice) => choice.label === "Tide")!.available).toBe(
      false,
    );
  });
  it("does not make an absent combination selectable", () => {
    const selected = blanket.variants[0];
    const variants = blanket.variants.filter(
      (variant) =>
        !(
          variant.referenceOptions?.Color === "Walnut" &&
          variant.referenceOptions.Size === selected.referenceOptions?.Size
        ),
    );
    expect(
      nativeOptionChoices(variants, selected, "Color").find(
        (choice) => choice.label === "Walnut",
      )!.available,
    ).toBe(false);
  });
  it("projects the exact variant price and photo without changing the catalog", () => {
    const selected = blanket.variants.find(
      (variant) =>
        variant.referenceOptions?.Color === "Walnut" &&
        variant.referenceOptions.Size.startsWith("Large"),
    )!;
    const projected = referenceVariantProduct(blanket, selected);
    expect(projected.price).toEqual({ amount: 34495, currency: "EUR" });
    expect(projected.images[0]).toBe(selected.referenceColor?.photo);
    expect(blanket.price).toEqual({ amount: 28295, currency: "EUR" });
    expect(blanket.images[0]).toBe(
      "/api/reference-media/live-shelf-blanket-photo-1",
    );
  });
  it("leaves ordinary and unknown variant projections unchanged", () => {
    expect(referenceVariantProduct(pot)).toBe(pot);
    expect(
      referenceVariantProduct(pot, {
        id: "uncaptured",
        label: "Unknown",
        availableQuantity: null,
      }),
    ).toBe(pot);
  });
});
