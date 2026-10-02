import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { emptyDraft, parseDraftPayload, parseEuroPrice } from "./draft-model";
import { parseDraftBuffer } from "./draft-buffer";

describe("incomplete private drafts and recovery", () => {
  it("accepts an incomplete draft without publication readiness", () => {
    expect(parseDraftPayload(emptyDraft)).toEqual(emptyDraft);
    expect(
      parseDraftPayload({
        ...emptyDraft,
        title: "Маса",
        categoryId: "cat:electronics/phones",
      }),
    ).not.toBeNull();
  });
  it.each([
    { ...emptyDraft, sellerId: randomUUID() },
    { ...emptyDraft, title: "x".repeat(161) },
    { ...emptyDraft, priceMinor: 1.23 },
    { ...emptyDraft, priceMinor: -1 },
    { ...emptyDraft, priceMinor: 1_000_000_001 },
    { ...emptyDraft, currency: "USD" },
    { ...emptyDraft, categoryId: "foreign-category" },
    { ...emptyDraft, fields: { role: "owner" } },
    { ...emptyDraft, condition: "new" },
    { ...emptyDraft, fields: { title: BigInt(1) } },
  ])("rejects malformed or authority-bearing draft data: %#", (value) => {
    expect(parseDraftPayload(value)).toBeNull();
  });
  it.each([
    ["12,34", 1234],
    ["12.3", 1230],
    ["0", 0],
    ["", null],
    ["-1", "invalid"],
    ["1e3", "invalid"],
    ["1.234", "invalid"],
    ["12345678", "invalid"],
  ])("parses money without float rounding: %s", (value, result) => {
    expect(parseEuroPrice(value as string)).toBe(result);
  });
  it("accepts a versioned recovery buffer with its server revision and retry key", () => {
    const buffer = {
      version: 1,
      payload: { ...emptyDraft, title: "Unsaved" },
      price: "12,34",
      revision: 4,
      requestId: randomUUID(),
    };
    expect(parseDraftBuffer(JSON.stringify(buffer))).toEqual(buffer);
    expect(
      parseDraftBuffer(JSON.stringify({ ...buffer, revision: -1 })),
    ).toBeNull();
    expect(
      parseDraftBuffer(JSON.stringify({ ...buffer, requestId: "external" })),
    ).toBeNull();
    expect(
      parseDraftBuffer(JSON.stringify({ ...buffer, version: 2 })),
    ).toBeNull();
    expect(parseDraftBuffer("broken JSON")).toBeNull();
  });
});
