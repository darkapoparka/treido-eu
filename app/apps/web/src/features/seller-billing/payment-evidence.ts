import type Stripe from "stripe";

type CapturedCharge = Pick<
  Stripe.Charge,
  | "id"
  | "livemode"
  | "currency"
  | "amount"
  | "amount_captured"
  | "paid"
  | "captured"
> & {
  customer: string | { id: string } | null;
  payment_intent: string | { id: string } | null;
};
function objectId(
  value: CapturedCharge["customer"] | CapturedCharge["payment_intent"],
): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}
/** Factual association only; callers separately verify their own immutable purpose and payable source. */
export function capturedChargeMatches(
  charge: CapturedCharge,
  expected: {
    chargeId: string;
    customerId: string;
    paymentIntentId?: string;
    livemode: boolean;
    amountMinor: number;
  },
): boolean {
  return (
    Number.isSafeInteger(expected.amountMinor) &&
    expected.amountMinor > 0 &&
    charge.id === expected.chargeId &&
    objectId(charge.customer) === expected.customerId &&
    (expected.paymentIntentId === undefined ||
      objectId(charge.payment_intent) === expected.paymentIntentId) &&
    charge.livemode === expected.livemode &&
    charge.currency === "eur" &&
    charge.amount === expected.amountMinor &&
    charge.amount_captured === expected.amountMinor &&
    charge.paid &&
    charge.captured
  );
}
