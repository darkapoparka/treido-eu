import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { parseInventoryCommand, parseOptions, stockState } from "./model";
import { parseCartCommand } from "../buyer-cart/model";
import { parseOfferCommand } from "../offers/model";
const sellerId = randomUUID(),
  listingId = randomUUID(),
  skuId = randomUUID();
const base = {
  sellerId,
  listingId,
  requestId: randomUUID(),
  expectedRevision: 0,
};
describe("inventory, cart and offer input contracts", () => {
  it("normalizes explicit inventory and rejects client ownership or noninteger quantities", () => {
    expect(
      parseInventoryCommand({
        ...base,
        operation: {
          kind: "setup",
          mode: "unique",
          onHand: 1,
          sellerSku: " A-1 ",
        },
      }).operation,
    ).toEqual({ kind: "setup", mode: "unique", onHand: 1, sellerSku: "A-1" });
    for (const onHand of [-1, 2, 1.1, "1", NaN])
      expect(() =>
        parseInventoryCommand({
          ...base,
          operation: { kind: "setup", mode: "unique", onHand, sellerSku: "" },
        }),
      ).toThrow("INVALID_INPUT");
    expect(() =>
      parseInventoryCommand({
        ...base,
        actorId: randomUUID(),
        operation: { kind: "archive", skuId },
      }),
    ).toThrow("INVALID_INPUT");
  });
  it("bounds variant definitions and prevents ambiguous or dangerous option keys", () => {
    expect(parseOptions({ " Размер ": " M ", Color: "Black" })).toEqual({
      Color: "Black",
      Размер: "M",
    });
    for (const value of [
      { color: "red", Color: "blue" },
      { a: "1", b: "2", c: "3", d: "4" },
      { " ": "1" },
      JSON.parse('{"__proto__":"value"}'),
      { Color: "\u0000red" },
    ])
      expect(() => parseOptions(value)).toThrow("INVALID_INPUT");
    expect(() =>
      parseInventoryCommand({
        ...base,
        operation: {
          kind: "variant",
          skuId,
          sellerSku: "",
          options: {},
          priceMinor: null,
          onHand: 1,
        },
      }),
    ).toThrow("INVALID_INPUT");
  });
  it("keeps unknown, reserved and out-of-stock separate", () => {
    expect(stockState([], false)).toBe("unknown");
    expect(stockState([{ onHand: 1, available: 0 }], true)).toBe("reserved");
    expect(stockState([{ onHand: 0, available: 0 }], true)).toBe(
      "out_of_stock",
    );
    expect(stockState([{ onHand: 3, available: 2 }], true)).toBe("available");
  });
  it("cart commands never accept browser prices, currency, owner or arbitrary quantities", () => {
    const value = {
      actorKey: "a".repeat(64),
      expectedRevision: 2,
      requestId: randomUUID(),
      operation: {
        kind: "set",
        listingId,
        skuId,
        publicationRevision: 3,
        quantity: 2,
      },
    };
    expect(parseCartCommand(value).operation).toMatchObject({ quantity: 2 });
    for (const operation of [
      { ...value.operation, priceMinor: 1 },
      { ...value.operation, quantity: 100 },
      { ...value.operation, quantity: 1.5 },
      { ...value.operation, buyerId: randomUUID() },
    ])
      expect(() => parseCartCommand({ ...value, operation })).toThrow(
        "INVALID_INPUT",
      );
  });
  it("offers use whole minor units, finite expiry and explicit current scope", () => {
    const value = {
      sellerId: null,
      threadId: randomUUID(),
      expectedRevision: 0,
      requestId: randomUUID(),
      operation: {
        kind: "propose",
        parentId: null,
        skuId,
        publicationRevision: 3,
        quantity: 1,
        unitPriceMinor: 2495,
        expiresHours: 24,
      },
    };
    expect(parseOfferCommand(value).operation).toMatchObject({
      unitPriceMinor: 2495,
    });
    for (const operation of [
      { ...value.operation, unitPriceMinor: 24.95 },
      { ...value.operation, unitPriceMinor: 0 },
      { ...value.operation, expiresHours: 999 },
      { ...value.operation, allocationId: randomUUID() },
    ])
      expect(() => parseOfferCommand({ ...value, operation })).toThrow(
        "INVALID_INPUT",
      );
  });
});
