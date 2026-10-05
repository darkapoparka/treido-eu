import { describe, expect, it } from "vitest";
import { capturedChargeMatches } from "./payment-evidence";
const charge = {
  id: "ch_original",
  customer: "cus_original",
  payment_intent: "pi_original",
  livemode: false,
  currency: "eur",
  amount: 399,
  amount_captured: 399,
  paid: true,
  captured: true,
};
const expected = {
  chargeId: "ch_original",
  customerId: "cus_original",
  paymentIntentId: "pi_original",
  livemode: false,
  amountMinor: 399,
};
describe("authoritative captured charge association", () => {
  it("accepts the same retrieved original IDs and full captured minor-unit amount", () => {
    expect(capturedChargeMatches(charge, expected)).toBe(true);
    expect(
      capturedChargeMatches(
        {
          ...charge,
          payment_intent: { id: "pi_original" },
          customer: { id: "cus_original" },
        },
        expected,
      ),
    ).toBe(true);
  });
  it.each([
    { id: "ch_foreign" },
    { customer: "cus_foreign" },
    { payment_intent: "pi_foreign" },
    { payment_intent: null },
    { livemode: true },
    { currency: "usd" },
    { amount: 400 },
    { amount_captured: 398 },
    { paid: false },
    { captured: false },
  ])(
    "denies a foreign, missing, partial or unpaid captured fact %#",
    (change) => {
      expect(capturedChargeMatches({ ...charge, ...change }, expected)).toBe(
        false,
      );
    },
  );
  it("denies zero, fractional and unsafe payable amounts", () => {
    for (const amountMinor of [0, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(capturedChargeMatches(charge, { ...expected, amountMinor })).toBe(
        false,
      );
  });
});
