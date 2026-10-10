import { describe, it, expect } from "vitest";
import { publicVariantLabels } from "./public-variant-labels";
const labels = (options: Record<string, string>[]) =>
  publicVariantLabels(
    options.map((options) => ({ options })),
    "Choose a variant",
    "Default variant",
  );
describe("current public SKU labels", () => {
  it("uses the observed one-dimension label without reference inventory", () =>
    expect(labels([{ Size: "XS" }, { Size: "M" }])).toEqual({
      legend: "Size",
      values: ["XS", "M"],
    }));
  it("keeps complete sparse combinations instead of inventing stock", () => {
    const result = labels([
      { Color: "Black", Size: "S" },
      { Color: "White", Size: "L" },
    ]);
    expect(result.legend).toBe("Choose a variant");
    expect(result.values).toHaveLength(2);
    expect(result.values[0]).toContain("Black");
    expect(result.values[1]).toContain("L");
  });
  it("does not lose an unconfigured default or collapse equal labels", () => {
    expect(labels([{}, { Size: "M" }]).values).toEqual([
      "Default variant",
      "Size: M",
    ]);
    expect(labels([{ Size: "M" }, { Size: "M" }]).values).toEqual(["M", "M"]);
  });
  it("does not confuse equal values from different dimensions", () => {
    const result = labels([{ Color: "M" }, { Size: "M" }]);
    expect(result.legend).toBe("Choose a variant");
    expect(result.values).toEqual(["Color: M", "Size: M"]);
  });
  it("keeps long BG labels intact and handles no variants", () => {
    const value = "Много дълъг вариант с български символи ".repeat(4);
    expect(labels([{ Размер: value }]).values[0]).toBe(value);
    expect(labels([])).toEqual({ legend: "Choose a variant", values: [] });
  });
});
