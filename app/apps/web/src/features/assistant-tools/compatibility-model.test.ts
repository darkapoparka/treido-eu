import { describe, expect, it } from "vitest";
import {
  compatibilityEvidence,
  parseCompatibilityCommand,
  parseRequirements,
  type CompatibilitySnapshot,
} from "./compatibility-model";
const listingId = "10000000-0000-4000-8000-000000000001",
  requestId = "10000000-0000-4000-8000-000000000002",
  actorKey = "a".repeat(64);
function snapshot(
  categoryId: string,
  attributes: CompatibilitySnapshot["attributes"],
): CompatibilitySnapshot {
  return {
    categoryId,
    attributes,
    observation: {
      listingId,
      publicationRevision: 2,
      skuId: null,
      priceMinor: 2000,
      stock: "unknown",
    },
  };
}
function outcome(
  categoryId: string,
  field: string,
  value: unknown,
  declared: unknown,
  operator = "equal",
  actualCategory = categoryId,
) {
  const requirements = parseRequirements({
    categoryId,
    fields: [{ field, operator, value }],
  });
  return compatibilityEvidence(
    requirements,
    snapshot(
      actualCategory,
      declared === undefined
        ? {}
        : { [field]: declared as CompatibilitySnapshot["attributes"][string] },
    ),
  )[0].outcome;
}
describe("declared compatibility evidence", () => {
  it.each([
    ["Sony", "Sony", "agreement"],
    ["Sony", "SONY", "disagreement"],
    ["Alpha 7", "Alpha 7 II", "disagreement"],
    [" Sony ", "Sony", "agreement"],
    ["A7", undefined, "missing"],
    ["АБВ", "АБВ", "agreement"],
    ["unknown", "unknown", "unknown"],
    ["model", "unknown", "unknown"],
  ])("exact model %s against %s is %s", (required, declared, expected) => {
    expect(
      outcome("cat:electronics/cameras-lenses", "model", required, declared),
    ).toBe(expected);
  });
  it("does not promote similar title/description into evidence", () => {
    const facts = snapshot("cat:electronics/cameras-lenses", {});
    expect(
      compatibilityEvidence(
        parseRequirements({
          categoryId: facts.categoryId,
          fields: [{ field: "mount", operator: "equal", value: "E" }],
        }),
        facts,
      )[0].outcome,
    ).toBe("missing");
  });
  it.each([
    [false, false, "agreement"],
    [false, true, "disagreement"],
    [true, undefined, "missing"],
  ])("preserves explicit boolean %s / %s", (required, declared, expected) => {
    expect(
      outcome("cat:electronics/phones", "carrierLocked", required, declared),
    ).toBe(expected);
  });
  it.each([
    [128, 256, "at_least", "agreement"],
    [128, 64, "at_least", "disagreement"],
    [128, 64, "at_most", "agreement"],
    [128, 256, "at_most", "disagreement"],
    [128, 128, "equal", "agreement"],
  ])(
    "compares integer constraints %s / %s / %s",
    (required, declared, op, expected) => {
      expect(
        outcome("cat:electronics/phones", "storageGB", required, declared, op),
      ).toBe(expected);
    },
  );
  it.each(["mm", "cm", "m"])(
    "converts declared dimension units from %s",
    (unit) => {
      const scale = { mm: 1000, cm: 100, m: 1 }[unit as "mm" | "cm" | "m"];
      expect(
        outcome(
          "cat:home/tables-chairs",
          "dimensions",
          { width: 1, height: 2, depth: 3, unit: "m" },
          { width: scale, height: 2 * scale, depth: 3 * scale, unit },
        ),
      ).toBe("agreement");
    },
  );
  it("does not infer rotation of declared axes", () => {
    expect(
      outcome(
        "cat:home/tables-chairs",
        "dimensions",
        { width: 1, height: 2, depth: 3, unit: "m" },
        { width: 2, height: 1, depth: 3, unit: "m" },
      ),
    ).toBe("disagreement");
  });
  it("converts fractional decimal units without binary floating disagreement", () => {
    expect(
      outcome(
        "cat:home/tables-chairs",
        "dimensions",
        { width: 0.29, height: 0.29, depth: 0.29, unit: "cm" },
        { width: 2.9, height: 2.9, depth: 2.9, unit: "mm" },
      ),
    ).toBe("agreement");
  });
  it("does not round different declared dimensions into an agreement", () => {
    expect(
      outcome(
        "cat:home/tables-chairs",
        "dimensions",
        { width: 1, height: 1, depth: 1, unit: "mm" },
        { width: 1.0000000000000002, height: 1, depth: 1, unit: "mm" },
      ),
    ).toBe("disagreement");
  });
  it("checks every dimension for maximum envelope", () => {
    expect(
      outcome(
        "cat:home/tables-chairs",
        "dimensions",
        { width: 100, height: 100, depth: 100, unit: "cm" },
        { width: 99, height: 101, depth: 99, unit: "cm" },
        "at_most",
      ),
    ).toBe("disagreement");
  });
  it("compares typed fixed-unit decimal declarations", () => {
    expect(
      outcome(
        "cat:home/tables-chairs",
        "weight",
        { value: "2.00", unit: "kg" },
        { value: "2", unit: "kg" },
      ),
    ).toBe("agreement");
  });
  it("does not compare fields across unrelated profiles", () => {
    expect(
      outcome(
        "cat:electronics/phones",
        "brand",
        "Sony",
        "Sony",
        "equal",
        "cat:fashion/bags",
      ),
    ).toBe("incomparable");
  });
  it("labels unsupported seller units incomparable", () => {
    expect(
      outcome(
        "cat:home/tables-chairs",
        "weight",
        { value: "2", unit: "kg" },
        { value: "2", unit: "lb" },
      ),
    ).toBe("incomparable");
  });
  it("unknown multi-value declarations stay unknown", () => {
    expect(
      outcome(
        "cat:electronics/cameras-lenses",
        "includedAccessories",
        ["other"],
        ["other"],
      ),
    ).toBe("unknown");
  });
  it("does not return a fit/safety verdict", () => {
    const evidence = compatibilityEvidence(
      parseRequirements({
        categoryId: "cat:motors-parts/car-parts",
        fields: [{ field: "vehicleModel", operator: "equal", value: "Golf" }],
      }),
      snapshot("cat:motors-parts/car-parts", {
        vehicleModel: "Golf",
        fitmentSource: "unknown",
      }),
    );
    expect(evidence[0].outcome).toBe("agreement");
    expect(evidence[0]).not.toHaveProperty("fits");
    expect(evidence[0]).not.toHaveProperty("safe");
  });
});
describe("bounded typed commands", () => {
  const valid = {
    actorKey,
    requestId,
    expectedRevision: 0,
    operation: {
      kind: "check",
      requirements: {
        categoryId: "cat:electronics/phones",
        fields: [{ field: "model", operator: "equal", value: "A7" }],
      },
      snapshots: [snapshot("cat:electronics/phones", { model: "A7" })],
    },
  };
  it("accepts a deliberate command without asserting stock or fit", () => {
    expect(parseCompatibilityCommand(valid).operation.kind).toBe("check");
  });
  it.each([
    {
      categoryId: "cat:electronics",
      fields: [{ field: "model", operator: "equal", value: "x" }],
    },
    { categoryId: "cat:electronics/phones", fields: [] },
    {
      categoryId: "cat:electronics/phones",
      fields: [{ field: "privateSerial", operator: "equal", value: "secret" }],
    },
    {
      categoryId: "cat:electronics/phones",
      fields: [{ field: "model", operator: "at_least", value: "x" }],
    },
    {
      categoryId: "cat:electronics/phones",
      fields: [{ field: "storageGB", operator: "equal", value: -1 }],
    },
    {
      categoryId: "cat:home/tables-chairs",
      fields: [
        {
          field: "dimensions",
          operator: "equal",
          value: { width: 1, height: 2, depth: 3, unit: "inch" },
        },
      ],
    },
    {
      categoryId: "cat:electronics/phones",
      fields: [
        { field: "model", operator: "equal", value: "x" },
        { field: "model", operator: "equal", value: "y" },
      ],
    },
  ])("rejects unsupported requirement %#", (raw) => {
    expect(() => parseRequirements(raw)).toThrow("INVALID_INPUT");
  });
  it.each([
    { ...valid, actorKey: "browser-role" },
    { ...valid, expectedRevision: -1 },
    { ...valid, expectedRevision: 1.2 },
    { ...valid, requestId: "not-a-uuid" },
    { ...valid, sellerId: listingId },
    {
      ...valid,
      operation: {
        ...valid.operation,
        snapshots: Array.from(
          { length: 5 },
          () => valid.operation.snapshots[0],
        ),
      },
    },
    {
      ...valid,
      operation: {
        ...valid.operation,
        snapshots: [valid.operation.snapshots[0], valid.operation.snapshots[0]],
      },
    },
    { ...valid, operation: { ...valid.operation, approved: true } },
  ])("rejects untrusted command %#", (raw) => {
    expect(() => parseCompatibilityCommand(raw)).toThrow("INVALID_INPUT");
  });
  it("refresh preserves explicit snapshot shape", () => {
    expect(
      parseCompatibilityCommand({
        ...valid,
        operation: { kind: "refresh", snapshots: valid.operation.snapshots },
      }).operation.kind,
    ).toBe("refresh");
  });
  it("clear freezes the exact selection set", () => {
    expect(
      parseCompatibilityCommand({
        ...valid,
        operation: { kind: "clear", listingIds: [listingId] },
      }).operation,
    ).toEqual({ kind: "clear", listingIds: [listingId] });
  });
});
