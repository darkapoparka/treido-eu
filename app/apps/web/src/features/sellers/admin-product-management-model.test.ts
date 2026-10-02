import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  parseBulkWithdrawal,
  parseDuplicateProduct,
  PRODUCT_SELECTION_LIMIT,
} from "./admin-product-management-model";
const sellerId = randomUUID();
const row = () => ({
  listingId: randomUUID(),
  expectedRevision: 1,
  requestId: randomUUID(),
});
describe("product management input", () => {
  it("accepts finite explicit rows and canonicalizes UUIDs", () => {
    const item = row();
    expect(
      parseBulkWithdrawal({
        sellerId: sellerId.toUpperCase(),
        items: [{ ...item, listingId: item.listingId.toUpperCase() }],
      }),
    ).toEqual({ sellerId, items: [item] });
    expect(parseDuplicateProduct({ ...item, sellerId })).toEqual({
      ...item,
      sellerId,
    });
    expect(
      parseBulkWithdrawal({
        sellerId,
        items: Array.from({ length: PRODUCT_SELECTION_LIMIT }, row),
      })?.items,
    ).toHaveLength(30);
  });
  it.each([
    null,
    [],
    {},
    { sellerId, items: [] },
    { sellerId, items: Array.from({ length: 31 }, row) },
    { sellerId, items: [row()], selectAll: true },
    { sellerId, items: [row()], actorId: randomUUID() },
    { sellerId, items: [row()], status: "published" },
    { sellerId, items: [{ ...row(), sellerId: randomUUID() }] },
    { sellerId, items: [{ ...row(), expectedRevision: 1.5 }] },
    { sellerId, items: [{ ...row(), expectedRevision: 0 }] },
    { sellerId, items: [{ ...row(), expectedRevision: 2147483647 }] },
    { sellerId: "foreign", items: [row()] },
    { sellerId, items: [null] },
  ])("rejects invalid or implicit batch %#", (input) => {
    expect(parseBulkWithdrawal(input)).toBeNull();
  });
  it("rejects repeated resources and repeated retry identities before any mutation", () => {
    const first = row();
    expect(
      parseBulkWithdrawal({
        sellerId,
        items: [first, { ...row(), listingId: first.listingId.toUpperCase() }],
      }),
    ).toBeNull();
    expect(
      parseBulkWithdrawal({
        sellerId,
        items: [first, { ...row(), requestId: first.requestId.toUpperCase() }],
      }),
    ).toBeNull();
  });
  it("never accepts a browser payload, price or publication flag for duplication", () => {
    for (const extra of [
      { payload: {} },
      { publication: "published" },
      { priceMinor: 1 },
      { actorId: randomUUID() },
    ]) {
      expect(
        parseDuplicateProduct({ sellerId, ...row(), ...extra }),
      ).toBeNull();
    }
  });
});
