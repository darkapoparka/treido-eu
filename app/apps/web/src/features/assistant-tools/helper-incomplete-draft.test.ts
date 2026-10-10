import { describe, expect, it } from "vitest";
import { emptyDraft } from "../selling/draft-model";
import { editableDraft, parseHelperEdit, inspectHelperDraft, applyHelperEdit } from "./sell-helper-model";
import { parseHelperHistoryQuery } from "./helper-history-model";
import { suggestHelperEdit } from "./suggestions";
const sellerId = "10000000-0000-4000-8000-000000000001";
describe("seller helper incomplete draft recovery", () => {
  it("loads an uncategorized draft without inventing a category or asking price", () => {
    expect(editableDraft(emptyDraft)).toEqual({ title: "", description: "", categoryId: null, fields: {} });
    expect(inspectHelperDraft(emptyDraft)).toContainEqual({ field: "categoryId", reason: "missing" });
    expect(suggestHelperEdit(emptyDraft, "bg")).toEqual(editableDraft(emptyDraft));
  });
  it("still rejects preparing or accepting uncategorized or financial edits", () => {
    expect(() => parseHelperEdit(editableDraft(emptyDraft))).toThrow();
    expect(() => parseHelperEdit({ ...editableDraft(emptyDraft), priceMinor: 100 })).toThrow();
    expect(() => applyHelperEdit(emptyDraft, editableDraft(emptyDraft), "personal")).toThrow();
  });
  it("bounds history to a seller and a receipt anchor, not another human", () => {
    expect(parseHelperHistoryQuery({ sellerId })).toEqual({ sellerId, before: null });
    expect(() => parseHelperHistoryQuery({ sellerId, userId: sellerId })).toThrow();
    expect(() => parseHelperHistoryQuery({ sellerId, before: "all" })).toThrow();
  });
});
