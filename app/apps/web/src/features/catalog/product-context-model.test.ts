import { expect, it } from "vitest";
import {
  mergeProductContext,
  parseProductContextRequest,
  PRODUCT_CONTEXT_BATCH_SIZE,
  type ProductContext,
} from "./product-context-model";

it.each([
  null,
  undefined,
  "input",
  {},
  { cartIds: "id", coverIds: [] },
  { cartIds: [], coverIds: [2] },
  { cartIds: ["../private"], coverIds: [] },
  { cartIds: [], coverIds: ["x".repeat(129)] },
])("rejects invalid context input %#", (input) => {
  expect(parseProductContextRequest(input)).toBeUndefined();
});
it("bounds combined inputs before deduplication", () => {
  expect(
    parseProductContextRequest({
      cartIds: Array(PRODUCT_CONTEXT_BATCH_SIZE).fill("shea-butter"),
      coverIds: ["rice-bundle"],
    }),
  ).toBeUndefined();
  expect(
    parseProductContextRequest({
      cartIds: Array(PRODUCT_CONTEXT_BATCH_SIZE).fill("shea-butter"),
      coverIds: [],
    }),
  ).toEqual({ cartIds: ["shea-butter"], coverIds: [] });
});
it("drops unrequested fields and deduplicates without reordering", () => {
  expect(
    parseProductContextRequest({
      cartIds: ["b", "a", "b"],
      coverIds: ["x", "x"],
      accountId: "private",
      scenario: "production",
    }),
  ).toEqual({ cartIds: ["b", "a"], coverIds: ["x"] });
});
it("merges resolved absences and new images without mutating earlier request state", () => {
  const before: ProductContext = {
    cart: { products: [], stores: [] },
    covers: [{ id: "a", image: "old" }],
    resolvedCartIds: ["missing"],
    resolvedCoverIds: ["a"],
  };
  const next: ProductContext = {
    cart: { products: [], stores: [] },
    covers: [
      { id: "a", image: "new" },
      { id: "b", image: "b" },
    ],
    resolvedCartIds: ["missing", "new"],
    resolvedCoverIds: ["a", "b"],
  };
  const merged = mergeProductContext(before, next);
  expect(merged.covers).toEqual([
    { id: "a", image: "new" },
    { id: "b", image: "b" },
  ]);
  expect(merged.resolvedCartIds).toEqual(["missing", "new"]);
  expect(merged.resolvedCoverIds).toEqual(["a", "b"]);
  expect(before.covers).toEqual([{ id: "a", image: "old" }]);
});
