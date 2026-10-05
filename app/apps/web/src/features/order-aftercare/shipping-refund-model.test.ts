import { describe, expect, it } from "vitest";
import type { FrozenRefundLine } from "./model";
import {
  shippingRefundPortions,
  type ShippingRefundBasis,
} from "./shipping-refund-model";

// Isolated arithmetic examples are not policy, provider or commercial approval.
const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
const basis: ShippingRefundBasis = {
  merchandiseMinor: 10000,
  shippingMinor: 1000,
  buyerFeeMinor: 0,
  taxMinor: null,
  taxBasis: "inclusive_unspecified",
  totalMinor: 11000,
  applicationFeeMinor: 330,
  shippingRefund: {
    beforeDispatch: "refundable",
    afterDispatch: "not_refundable",
    return: "refundable",
  },
};
function original(reservedQuantity = 0): FrozenRefundLine[] {
  return [
    {
      skuId: first,
      position: 0,
      quantity: 2,
      unitPriceMinor: 5000,
      originalPrefixMinor: 0,
      reservedQuantity,
    },
  ];
}
describe("original shipping refund conservation", () => {
  it("keeps the full charge fee denominator when commission was based on merchandise", () => {
    const item = shippingRefundPortions(
      original(),
      basis,
      { merchandise: [{ skuId: first, quantity: 1 }], shipping: false },
      "before_dispatch",
      0,
    );
    expect(item.amountMinor).toBe(5000);
    expect(item.feeMinor).toBe(150);
    const carrier = shippingRefundPortions(
      original(1),
      basis,
      { merchandise: [], shipping: true },
      "before_dispatch",
      0,
    );
    expect(carrier.amountMinor).toBe(1000);
    expect(carrier.feeMinor).toBe(30);
    expect(carrier.lines).toEqual([]);
    const last = shippingRefundPortions(
      original(1),
      basis,
      { merchandise: "remaining", shipping: false },
      "before_dispatch",
      1000,
    );
    expect(last.lines[0].fromQuantity).toBe(1);
    expect(item.amountMinor + carrier.amountMinor + last.amountMinor).toBe(
      basis.totalMinor,
    );
    expect(item.feeMinor + carrier.feeMinor + last.feeMinor).toBe(
      basis.applicationFeeMinor,
    );
  });
  it("permits the separate original shipping component after all SKU units were reserved", () => {
    const result = shippingRefundPortions(
      original(2),
      basis,
      { merchandise: "remaining", shipping: true },
      "before_dispatch",
      0,
    );
    expect(result.amountMinor).toBe(1000);
    expect(result.feeMinor).toBe(30);
    expect(result.lines).toEqual([]);
  });
  it("retains an unknown original shipping reservation and never reserves it twice", () => {
    expect(() =>
      shippingRefundPortions(
        original(),
        basis,
        { merchandise: [], shipping: true },
        "before_dispatch",
        1000,
      ),
    ).toThrow("CONFLICT");
    expect(() =>
      shippingRefundPortions(
        original(),
        basis,
        { merchandise: [], shipping: true },
        "before_dispatch",
        500,
      ),
    ).toThrow("CONFLICT");
  });
  it("enforces the accepted shipment stage without inventing return authority", () => {
    expect(() =>
      shippingRefundPortions(
        original(),
        basis,
        { merchandise: [], shipping: true },
        "after_dispatch",
        0,
      ),
    ).toThrow("NOT_AVAILABLE");
    expect(
      shippingRefundPortions(
        original(),
        basis,
        { merchandise: [{ skuId: first, quantity: 1 }], shipping: false },
        "after_dispatch",
        0,
      ).amountMinor,
    ).toBe(5000);
    expect(() =>
      shippingRefundPortions(
        original(),
        basis,
        { merchandise: [], shipping: true },
        "return" as "after_dispatch",
        0,
      ),
    ).toThrow("CONFLICT");
  });
  it.each([
    { ...basis, buyerFeeMinor: 1 },
    { ...basis, taxBasis: "inclusive_known", taxMinor: 100 },
    { ...basis, taxBasis: "exclusive_known", taxMinor: 100 },
  ])(
    "keeps unsupported buyer-fee/tax components unavailable",
    (unsupported) => {
      expect(() =>
        shippingRefundPortions(
          original(),
          unsupported,
          { merchandise: "remaining", shipping: true },
          "before_dispatch",
          0,
        ),
      ).toThrow("NOT_AVAILABLE");
    },
  );
  it("validates all original unit ranges even for a shipment-only selection", () => {
    expect(() =>
      shippingRefundPortions(
        original(3),
        basis,
        { merchandise: [], shipping: true },
        "before_dispatch",
        0,
      ),
    ).toThrow("CONFLICT");
    expect(() =>
      shippingRefundPortions(
        [{ ...original(2)[0], originalPrefixMinor: 1 }],
        basis,
        { merchandise: [], shipping: true },
        "before_dispatch",
        0,
      ),
    ).toThrow("CONFLICT");
    expect(() =>
      shippingRefundPortions(
        original(2),
        { ...basis, totalMinor: 12000 },
        { merchandise: [], shipping: true },
        "before_dispatch",
        0,
      ),
    ).toThrow("CONFLICT");
  });
  it("conserves original rounded fees across multi-line cent boundaries and either commission base", () => {
    const lines: FrozenRefundLine[] = [
      {
        skuId: first,
        position: 0,
        quantity: 3,
        unitPriceMinor: 3333,
        reservedQuantity: 0,
        originalPrefixMinor: 0,
      },
      {
        skuId: second,
        position: 1,
        quantity: 1,
        unitPriceMinor: 2,
        reservedQuantity: 0,
        originalPrefixMinor: 9999,
      },
    ];
    for (const fee of [330, 361]) {
      const sample = {
        ...basis,
        merchandiseMinor: 10001,
        shippingMinor: 1001,
        totalMinor: 11002,
        applicationFeeMinor: fee,
      };
      let gross = 0,
        returnedFee = 0;
      for (let index = 0; index < 3; index++) {
        const selected = shippingRefundPortions(
          [{ ...lines[0], reservedQuantity: index }, lines[1]],
          sample,
          { merchandise: [{ skuId: first, quantity: 1 }], shipping: false },
          "before_dispatch",
          0,
        );
        gross += selected.amountMinor;
        returnedFee += selected.feeMinor;
      }
      const last = shippingRefundPortions(
        [{ ...lines[0], reservedQuantity: 3 }, lines[1]],
        sample,
        { merchandise: "remaining", shipping: true },
        "before_dispatch",
        0,
      );
      expect(gross + last.amountMinor).toBe(sample.totalMinor);
      expect(returnedFee + last.feeMinor).toBe(sample.applicationFeeMinor);
      expect(last.shipping?.fromMinor).toBe(0);
    }
  });
});
