import { describe, expect, it } from "vitest";
import { getCategory, type CategoryLeaf } from "@treido/contracts/categories";
import {
  decodePreparation,
  encodePreparation,
  reviewPreparation,
  toCategoryAttributes,
} from "./form-model";

function leaf(id: string): CategoryLeaf {
  const category = getCategory(id);
  if (category?.kind !== "leaf") throw new Error(`Missing test category ${id}`);
  return category;
}
const phone = leaf("cat:electronics/phones");
const validPhone = {
  condition: "good",
  fields: {
    brand: "Example",
    model: "One",
    storageGB: "128",
    workingStatus: "working",
  },
};

describe("seller category preparation", () => {
  it("reports all missing leaf requirements and the condition without granting publication", () => {
    expect(
      reviewPreparation(phone, { condition: "", fields: {} }).errors,
    ).toEqual({
      condition: "required",
      brand: "required",
      model: "required",
      storageGB: "required",
      workingStatus: "required",
    });
    expect(phone.policy.enabledForPublish).toBe(false);
  });

  it("distinguishes an unanswered boolean from an explicit no and enforces conditional carrier", () => {
    expect(toCategoryAttributes(phone, { carrierLocked: "" })).toEqual({});
    expect(toCategoryAttributes(phone, { carrierLocked: "no" })).toEqual({
      carrierLocked: false,
    });
    expect(
      reviewPreparation(phone, {
        ...validPhone,
        fields: { ...validPhone.fields, carrierLocked: "yes" },
      }).errors,
    ).toEqual({ carrier: "required" });
    expect(
      reviewPreparation(phone, {
        ...validPhone,
        fields: {
          ...validPhone.fields,
          carrierLocked: "yes",
          carrier: "Example carrier",
        },
      }).errors,
    ).toEqual({});
  });

  it("rejects decimal, hexadecimal, nonfinite and out-of-range integer input", () => {
    for (const storageGB of ["1.5", "0x80", "Infinity", "-1", "0", "1048577"])
      expect(
        reviewPreparation(phone, {
          ...validPhone,
          fields: { ...validPhone.fields, storageGB },
        }).errors.storageGB,
      ).toBe("invalid");
  });

  it("maps Bulgarian decimal input and requires complete bounded dimensions", () => {
    const furniture = leaf("cat:home/tables-chairs");
    const fields = {
      dimensions: { width: "120", height: "75", depth: "60", unit: "cm" },
      weight: { value: "12,34", unit: "kg" },
    };
    const result = reviewPreparation(furniture, { condition: "good", fields });
    expect(result.errors).toEqual({});
    expect(result.attributes?.weight).toEqual({ value: "12.34", unit: "kg" });
    expect(
      reviewPreparation(furniture, {
        condition: "good",
        fields: { dimensions: { width: "120", unit: "cm" } },
      }).errors.dimensions,
    ).toBe("invalid");
    expect(
      reviewPreparation(furniture, {
        condition: "good",
        fields: {
          dimensions: { width: "101", height: "1", depth: "1", unit: "m" },
        },
      }).errors.dimensions,
    ).toBe("invalid");
  });

  it("restricts sealed cosmetics to allowed condition and affirmative declaration", () => {
    const skincare = leaf("cat:beauty-care/sealed-skincare");
    const fields = { brand: "Example", productType: "Cream", sealed: "no" };
    expect(
      reviewPreparation(skincare, { condition: "good", fields }).errors,
    ).toEqual({ condition: "required", sealed: "invalid" });
    expect(
      reviewPreparation(skincare, {
        condition: "new",
        fields: { ...fields, sealed: "yes", expiryDate: "2026-02-30" },
      }).errors.expiryDate,
    ).toBe("invalid");
  });

  it("validates fitment dependencies and year order", () => {
    const part = leaf("cat:motors-parts/car-parts");
    const fields = {
      partNumber: "ABC",
      fitmentSource: "manufacturer",
      vehicleMake: "Example",
      yearFrom: "2025",
      yearTo: "2020",
    };
    expect(
      reviewPreparation(part, { condition: "good", fields }).errors.yearTo,
    ).toBe("invalid");
    expect(
      reviewPreparation(part, {
        condition: "good",
        fields: { partNumber: "ABC", vehicleModel: "One" },
      }).errors.fitmentSource,
    ).toBe("required");
  });

  it("round trips validated preparation and rejects unknown authority and field input", () => {
    const buffer = encodePreparation(phone, validPhone);
    expect(buffer).not.toBeNull();
    expect(decodePreparation(buffer!)?.preparation).toEqual(validPhone);
    const data = JSON.parse(buffer!);
    expect(
      decodePreparation(
        JSON.stringify({ ...data, sellerId: "another-business" }),
      ),
    ).toBeNull();
    expect(
      decodePreparation(
        JSON.stringify({
          ...data,
          preparation: {
            ...validPhone,
            fields: { ...validPhone.fields, enabledForPublish: "yes" },
          },
        }),
      ),
    ).toBeNull();
    expect(
      encodePreparation(phone, { condition: "good", fields: {} }),
    ).toBeNull();
  });

  it("fails closed for stale, malformed, root, oversized or disallowed saved preparation", () => {
    const data = JSON.parse(encodePreparation(phone, validPhone)!);
    for (const patch of [
      { taxonomyVersion: 0 },
      { version: 2 },
      { categoryId: "cat:electronics" },
      { categoryId: "not-a-category" },
      { preparation: { ...validPhone, condition: "invented" } },
      {
        preparation: {
          ...validPhone,
          fields: { ...validPhone.fields, storageGB: true },
        },
      },
    ])
      expect(
        decodePreparation(JSON.stringify({ ...data, ...patch })),
      ).toBeNull();
    expect(decodePreparation("not json")).toBeNull();
    expect(decodePreparation("x".repeat(32_001))).toBeNull();
  });
});
