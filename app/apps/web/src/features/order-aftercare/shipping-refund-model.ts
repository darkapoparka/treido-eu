import { SellerError } from "../sellers/errors";
import {
  refundPortions,
  type FrozenRefundLine,
  type RefundPortion,
  type RefundSelection,
} from "./model";

export type ShippingRefundBasis = {
  merchandiseMinor: number;
  shippingMinor: number;
  buyerFeeMinor: number;
  taxMinor: number | null;
  taxBasis: string;
  totalMinor: number;
  applicationFeeMinor: number;
  shippingRefund: {
    beforeDispatch: "refundable" | "not_refundable";
    afterDispatch: "refundable" | "not_refundable";
    return: "refundable" | "not_refundable";
  };
};
export type ShippingRefundSelection = {
  merchandise: "remaining" | RefundSelection[];
  shipping: boolean;
};
/** Derived from the ORIGINAL order fulfilment under its allocation/order locks.
 * A free text reason cannot establish a return or a fulfilment stage. */
export type ShippingRefundStage = "before_dispatch" | "after_dispatch";
export type ShippingRefundPortion = {
  kind: "shipping";
  fromMinor: 0;
  amountMinor: number;
  feeMinor: number;
  taxMinor: null;
  taxBasis: "inclusive_unspecified";
};

function amount(value: number, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum || value > 99999999)
    throw new SellerError("CONFLICT");
  return value;
}
function proportional(prefix: number, fee: number, originalGross: number) {
  return Number(
    (BigInt(prefix) * BigInt(fee) + BigInt(Math.floor(originalGross / 2))) /
      BigInt(originalGross),
  );
}

/** Preserve original agreed unit prices and reserved quantity ranges. Shipping
 * is a distinct original monetary component, never a fabricated SKU.
 * Unknown/emitted reservations are supplied without being released here. */
export function shippingRefundPortions(
  original: FrozenRefundLine[],
  basis: ShippingRefundBasis,
  selected: ShippingRefundSelection,
  stage: ShippingRefundStage,
  reservedShippingMinor: number,
): {
  lines: RefundPortion[];
  shipping: ShippingRefundPortion | null;
  amountMinor: number;
  feeMinor: number;
  taxBasis: "inclusive_unspecified";
} {
  amount(basis.merchandiseMinor, 1);
  amount(basis.shippingMinor);
  amount(basis.totalMinor, 50);
  amount(basis.applicationFeeMinor);
  if (
    basis.buyerFeeMinor !== 0 ||
    basis.taxMinor !== null ||
    basis.taxBasis !== "inclusive_unspecified"
  )
    throw new SellerError("NOT_AVAILABLE");
  if (
    basis.totalMinor !== basis.merchandiseMinor + basis.shippingMinor ||
    basis.applicationFeeMinor > basis.totalMinor ||
    typeof selected.shipping !== "boolean" ||
    !["before_dispatch", "after_dispatch"].includes(stage) ||
    (selected.merchandise !== "remaining" &&
      !Array.isArray(selected.merchandise)) ||
    !Number.isSafeInteger(reservedShippingMinor) ||
    ![0, basis.shippingMinor].includes(reservedShippingMinor)
  )
    throw new SellerError("CONFLICT");

  // Validate every original SKU/prefix/quantity/price even for a shipping-only
  // refund after all merchandise units have already been reserved.
  refundPortions(
    original.map((line) => ({ ...line, reservedQuantity: 0 })),
    "remaining",
    basis.merchandiseMinor,
    0,
  );
  for (const line of original)
    if (
      !Number.isSafeInteger(line.reservedQuantity) ||
      line.reservedQuantity < 0 ||
      line.reservedQuantity > line.quantity
    )
      throw new SellerError("CONFLICT");
  const units =
    selected.merchandise === "remaining"
      ? original
          .filter(
            (line) =>
              line.unitPriceMinor > 0 && line.reservedQuantity < line.quantity,
          )
          .map((line) => ({
            skuId: line.skuId,
            quantity: line.quantity - line.reservedQuantity,
          }))
      : selected.merchandise;
  const lines = (
    units.length
      ? refundPortions(original, units, basis.merchandiseMinor, 0)
      : []
  ).map((part): RefundPortion => {
    const line = original.find((item) => item.skuId === part.skuId)!;
    const start =
      line.originalPrefixMinor + part.fromQuantity * line.unitPriceMinor;
    const end = start + part.amountMinor;
    return {
      ...part,
      feeMinor:
        proportional(end, basis.applicationFeeMinor, basis.totalMinor) -
        proportional(start, basis.applicationFeeMinor, basis.totalMinor),
    };
  });
  let shipping: ShippingRefundPortion | null = null;
  if (selected.shipping) {
    const rule =
      stage === "before_dispatch"
        ? basis.shippingRefund.beforeDispatch
        : basis.shippingRefund.afterDispatch;
    if (rule !== "refundable") throw new SellerError("NOT_AVAILABLE");
    if (basis.shippingMinor < 1 || reservedShippingMinor !== 0)
      throw new SellerError("CONFLICT");
    shipping = {
      kind: "shipping",
      fromMinor: 0,
      amountMinor: basis.shippingMinor,
      feeMinor:
        proportional(
          basis.totalMinor,
          basis.applicationFeeMinor,
          basis.totalMinor,
        ) -
        proportional(
          basis.merchandiseMinor,
          basis.applicationFeeMinor,
          basis.totalMinor,
        ),
      taxMinor: null,
      taxBasis: "inclusive_unspecified",
    };
  }
  const amountMinor =
      lines.reduce((sum, line) => sum + line.amountMinor, 0) +
      (shipping?.amountMinor ?? 0),
    feeMinor =
      lines.reduce((sum, line) => sum + line.feeMinor, 0) +
      (shipping?.feeMinor ?? 0),
    reservedGross =
      original.reduce(
        (sum, line) => sum + line.reservedQuantity * line.unitPriceMinor,
        0,
      ) + reservedShippingMinor;
  if (
    amountMinor < 1 ||
    amountMinor + reservedGross > basis.totalMinor ||
    feeMinor < 0 ||
    feeMinor > amountMinor
  )
    throw new SellerError("CONFLICT");
  return {
    lines,
    shipping,
    amountMinor,
    feeMinor,
    taxBasis: "inclusive_unspecified",
  };
}
