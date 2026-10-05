import { describe, expect, it } from "vitest";
import {
  parseChoice,
  parseCommand,
  parseRecipient,
  shippingCosts,
} from "./model";
import {
  parseShippingContinuation,
  shippingStartHref,
  shippingReviewHref,
} from "./integration";
const id = "00000000-0000-4000-8000-000000000001";
describe("shipping amounts and recipient input", () => {
  it("keeps explicit shipping/fee/tax minor units separate and does not add inclusive tax twice", () => {
    const costs = shippingCosts({
      merchandiseMinor: 10000,
      shippingMinor: 499,
      buyerFeeMinor: 0,
      taxMinor: 1749,
      taxBasis: "inclusive_known",
      applicationFeeMinor: 330,
    });
    expect(costs.totalMinor).toBe(10499);
    expect(costs.shippingMinor).toBe(499);
    expect(costs.taxMinor).toBe(1749);
    expect(
      shippingCosts({ ...costs, taxBasis: "exclusive_known", taxMinor: 2099 })
        .totalMinor,
    ).toBe(12598);
  });
  it("retains approved inclusive-unspecified tax as null and rejects an invented tax zero", () => {
    expect(
      shippingCosts({
        merchandiseMinor: 10000,
        shippingMinor: 499,
        buyerFeeMinor: 0,
        taxMinor: null,
        taxBasis: "inclusive_unspecified",
        applicationFeeMinor: 330,
      }).taxMinor,
    ).toBeNull();
    expect(() =>
      shippingCosts({
        merchandiseMinor: 10000,
        shippingMinor: 499,
        buyerFeeMinor: 0,
        taxMinor: 0,
        taxBasis: "inclusive_unspecified",
        applicationFeeMinor: 330,
      }),
    ).toThrow();
  });
  it("rejects missing cost, fractional/overflow amount and an unapproved recipient field", () => {
    expect(() =>
      shippingCosts({
        merchandiseMinor: 99999999,
        shippingMinor: 1,
        buyerFeeMinor: 0,
        taxMinor: null,
        taxBasis: "inclusive_unspecified",
        applicationFeeMinor: 0,
      }),
    ).toThrow();
    expect(() =>
      shippingCosts({
        merchandiseMinor: 9999,
        shippingMinor: 0.5,
        buyerFeeMinor: 0,
        taxMinor: null,
        taxBasis: "inclusive_unspecified",
        applicationFeeMinor: 0,
      }),
    ).toThrow();
    expect(() =>
      parseRecipient(
        { address: "Private street", bankAccount: "forbidden" },
        ["address"],
        ["address"],
      ),
    ).toThrow();
    expect(() =>
      parseRecipient({ address: "" }, ["address"], ["address"]),
    ).toThrow();
  });
  it("requires explicit true acknowledgment and denies client-supplied charge or authority", () => {
    expect(() =>
      parseChoice({
        id,
        revision: 0,
        snapshotHash: "a".repeat(64),
        acknowledged: false,
      }),
    ).toThrow();
    expect(() =>
      parseCommand({
        action: "accept",
        actorKey: "a".repeat(64),
        requestId: id,
        choice: {
          id,
          revision: 0,
          snapshotHash: "a".repeat(64),
          acknowledged: true,
        },
        totalMinor: 1,
      }),
    ).toThrow();
  });
});
describe("original strict shipping continuations", () => {
  it("round-trips both current cart and original accepted offer and own UUID review", () => {
    for (const language of ["bg", "en"] as const) {
      for (const source of [
        { kind: "cart" as const, sellerId: id, cartRevision: 1 },
        { kind: "offer" as const, threadId: id, offerId: id },
      ]) {
        const href = shippingStartHref(source, language);
        expect(parseShippingContinuation(href)).toBe(href);
      }
      expect(parseShippingContinuation(shippingReviewHref(id, language))).toBe(
        shippingReviewHref(id, language),
      );
    }
  });
  it("denies duplicate locale, ambiguous source/revision, foreign prefix and encoded/extra transport", () => {
    const href = shippingStartHref(
      { kind: "cart", sellerId: id, cartRevision: 1 },
      "bg",
    );
    for (const raw of [
      href + "&lang=en",
      href + "&sellerId=" + id,
      href.replace("cartRevision=1", "cartRevision=01"),
      href + "&sellerId2=" + id,
      href.replace("/shipping?", "/shipping-other?"),
      href + "#redirect",
      href + "\n",
      href.replace("/shipping?", "/shipping/../shipping?"),
      href.replace("/shipping?", "/shipping/./?"),
      href.replace("cartRevision=1", "cartRevision=1\t"),
      "https://example.com" + href,
      href.replace("sellerId=", "sellerId=%2f"),
      shippingReviewHref(id, "bg") + "&seller=business",
    ])
      expect(parseShippingContinuation(raw)).toBeNull();
  });
});
