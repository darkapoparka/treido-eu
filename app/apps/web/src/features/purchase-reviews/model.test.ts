import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  merchandiseTotal,
  parseCreateReview,
  parseReviewEdit,
  reviewMessage,
  type PurchaseReview,
} from "./model";
import { parseWorkspaceContinuation } from "../sellers/workspace-continuation";
import messages from "./messages.json";
const actorKey = "a".repeat(64),
  sellerId = randomUUID(),
  requestId = randomUUID();
const command = {
  actorKey,
  requestId,
  language: "en",
  handover: "pickup",
  source: { kind: "cart", sellerId, cartRevision: 1 },
};
describe("immutable purchase review input and presentation", () => {
  it("accepts only references, not client-authored financial or inventory facts", () => {
    expect(parseCreateReview(command)).toEqual(command);
    for (const extra of [
      { total: 1 },
      { currency: "EUR" },
      { feeMinor: 0 },
      { allocationId: randomUUID() },
      { unitPriceMinor: 1 },
      { paid: true },
    ])
      expect(() => parseCreateReview({ ...command, ...extra })).toThrow(
        "INVALID_INPUT",
      );
    expect(() =>
      parseCreateReview({
        ...command,
        source: { ...command.source, price: 1 },
      }),
    ).toThrow("INVALID_INPUT");
  });
  it("validates handover, identity scope, bounded revision and source IDs", () => {
    for (const input of [
      { ...command, handover: "free_shipping" },
      { ...command, actorKey: "other" },
      { ...command, language: "xx" },
      { ...command, source: { kind: "cart", sellerId, cartRevision: 0 } },
      {
        ...command,
        source: { kind: "offer", threadId: "x", offerId: randomUUID() },
      },
    ])
      expect(() => parseCreateReview(input)).toThrow("INVALID_INPUT");
    expect(
      parseCreateReview({
        ...command,
        source: {
          kind: "offer",
          threadId: randomUUID(),
          offerId: randomUUID(),
        },
      }).source.kind,
    ).toBe("offer");
  });
  it("keeps arithmetic exact for all allowed lines and refuses invalid quantities", () => {
    expect(
      merchandiseTotal([
        { unitPriceMinor: 12900, quantity: 2 },
        { unitPriceMinor: 10001, quantity: 3 },
      ]),
    ).toBe(55803);
    expect(
      merchandiseTotal(
        Array.from({ length: 30 }, () => ({
          unitPriceMinor: 1_000_000_000,
          quantity: 99,
        })),
      ),
    ).toBe(2_970_000_000_000);
    for (const lines of [
      [],
      [{ unitPriceMinor: -1, quantity: 1 }],
      [{ unitPriceMinor: 1, quantity: 100 }],
      [{ unitPriceMinor: 1.1, quantity: 1 }],
      Array.from({ length: 31 }, () => ({ unitPriceMinor: 1, quantity: 1 })),
    ])
      expect(() => merchandiseTotal(lines)).toThrow("INVALID_INPUT");
  });
  it("edits private notes without accepting money, source or stock changes", () => {
    const edit = {
      actorKey,
      requestId,
      reviewId: randomUUID(),
      expectedRevision: 0,
      note: " My note ",
      archived: false,
    };
    expect(parseReviewEdit(edit).note).toBe("My note");
    for (const input of [
      { ...edit, note: "x".repeat(1001) },
      { ...edit, payableMinor: 1 },
      { ...edit, expectedRevision: -1 },
      { ...edit, archived: "true" },
    ])
      expect(() => parseReviewEdit(input)).toThrow("INVALID_INPUT");
  });
  it("renders every line in a bounded inquiry without private notes or payment success", () => {
    const review: PurchaseReview = {
      id: randomUUID(),
      sellerId,
      sellerName: "Test seller",
      source: "cart",
      currency: "EUR",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      expired: false,
      allocationId: null,
      holdState: null,
      threadId: null,
      offerId: null,
      contactThreadId: null,
      revision: 0,
      archived: false,
      payment: {
        available: false,
        buyerFeeMinor: null,
        deliveryMinor: null,
        payableMinor: null,
      },
      language: "en",
      handover: "pickup",
      note: "PRIVATE NEVER SEND",
      merchandiseMinor: 30000,
      lines: Array.from({ length: 30 }, (_, i) => ({
        title: "Item " + i + " " + "x".repeat(170),
        options: { Color: "Blue" },
        skuId: randomUUID(),
        listingId: randomUUID(),
        publicationRevision: 2,
        deliveryDetails: "Pickup by agreement",
        current: true,
        available: 10,
        quantity: 1,
        unitPriceMinor: 1000,
      })),
    };
    const body = reviewMessage(review);
    expect(body).toContain("Item 29");
    expect(body.length).toBeLessThanOrEqual(4000);
    expect(body).not.toContain(review.note);
    expect(body).toContain("not an order");
    expect(body).toContain("No payment has been made");
    expect(reviewMessage({ ...review, language: "bg" })).toContain(
      "не поръчка",
    );
  });
  it("keeps BG/EN messages complete", () => {
    expect(Object.keys(messages.bg).sort()).toEqual(
      Object.keys(messages.en).sort(),
    );
    expect(Object.values(messages.bg).every((v) => v.length > 0)).toBe(true);
  });
  it("allows only canonical purchase and merchant payment return paths", () => {
    for (const path of [
      "/checkout/reviews",
      "/checkout/reviews/" + randomUUID(),
      "/reservations",
      "/app/sellers/" + sellerId + "/reservations",
      "/app/sellers/" + sellerId + "/settings/payments",
    ])
      expect(parseWorkspaceContinuation(path + "?lang=bg")).toBe(
        path + "?lang=bg",
      );
    for (const path of [
      "//evil.test/checkout/reviews",
      "/checkout/reviews/not-an-id",
      "/checkout/reviews?paid=true",
      "/reservations?lang=en&lang=bg",
      "/checkout/reviews#paid",
    ])
      expect(parseWorkspaceContinuation(path)).toBeNull();
  });
});
