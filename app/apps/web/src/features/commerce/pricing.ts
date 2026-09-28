import type { CartLine } from "../discovery/state";
// Frozen flow21's promotion applies only to this captured default variant.
export function capturedLineAmount(
  line: Pick<CartLine, "productId" | "variantId">,
  amount: number,
) {
  return line.productId === "shampoo-bag" &&
    line.variantId === "shampoo-bag-default"
    ? 365
    : amount;
}

// Frozen flow 20, 9211553e-bc3c-45f9-943b-f032766e6799/003.webp.
// This struck-through offer amount is a captured display snapshot, not the
// current catalog price or another discount to subtract from the net amount.
export function capturedOfferCompareAt(
  line: Pick<CartLine, "productId" | "variantId">,
): number | undefined {
  return line.productId === "shampoo-bag" &&
    line.variantId === "shampoo-bag-default"
    ? 635
    : undefined;
}
