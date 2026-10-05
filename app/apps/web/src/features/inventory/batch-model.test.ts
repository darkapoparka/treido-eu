import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { parseStockBatch, STOCK_BATCH_LIMIT } from "./batch-model";
const input = () => ({
  sellerId: randomUUID(),
  requestId: randomUUID(),
  reason: "Stock count",
  reasonKind: "adjustment",
  lines: [
    {
      listingId: randomUUID(),
      skuId: String(randomUUID()),
      expectedRevision: 1,
      onHand: 5,
    },
  ],
});
describe("explicit stock batch input", () => {
  it("normalizes identifiers and keeps exact integer quantities", () => {
    const value = input();
    value.lines[0].skuId = value.lines[0].skuId.toUpperCase();
    expect(parseStockBatch(value).lines[0].onHand).toBe(5);
    expect(parseStockBatch(value).lines[0].skuId).toBe(
      value.lines[0].skuId.toLowerCase(),
    );
  });
  it("rejects implicit, duplicated, overflowing and fractional targets", () => {
    const value = input();
    for (const bad of [
      { ...value, all: true },
      { ...value, lines: [] },
      { ...value, lines: [value.lines[0], value.lines[0]] },
      {
        ...value,
        lines: Array.from({ length: STOCK_BATCH_LIMIT + 1 }, () => ({
          ...value.lines[0],
          skuId: randomUUID(),
        })),
      },
      { ...value, lines: [{ ...value.lines[0], onHand: 1.5 }] },
    ])
      expect(() => parseStockBatch(bad)).toThrow("INVALID_INPUT");
  });
  it("requires consistent product revisions and a human reason", () => {
    const value = input();
    expect(() => parseStockBatch({ ...value, reason: " " })).toThrow(
      "INVALID_INPUT",
    );
    expect(() =>
      parseStockBatch({
        ...value,
        lines: [
          value.lines[0],
          { ...value.lines[0], skuId: randomUUID(), expectedRevision: 2 },
        ],
      }),
    ).toThrow("INVALID_INPUT");
  });
});
