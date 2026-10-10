import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OrderView } from "../payments/model";
import { BuyerPaidOrderDetail } from "./paid-order-detail";

const order: OrderView = {
  id: "30900b58-07c9-4574-88f1-2d0368fe8004",
  quoteId: "quote-test",
  sellerId: "seller-test",
  sellerName: "Actual seller name",
  totalMinor: 2500,
  merchandiseMinor: 2000,
  shippingMinor: 400,
  buyerFeeMinor: 100,
  currency: "EUR",
  handover: "pickup",
  shipping: null,
  shippingFulfilmentState: null,
  paymentState: "paid",
  fulfilmentState: "collected",
  settlementState: "transferred",
  refundState: null,
  revision: 2,
  createdAt: "2026-10-10T03:00:00.000Z",
  lines: [
    {
      listingId: "listing-test",
      skuId: "sku-test",
      publicationRevision: 3,
      title: "Original accepted title",
      options: { size: "Large" },
      quantity: 2,
      unitPriceMinor: 1000,
      deliveryDetails: "Simulated TEST pickup only",
      current: false,
      available: null,
    },
  ],
};
function render(
  changes: Partial<OrderView> = {},
  language: "bg" | "en" = "en",
) {
  return renderToStaticMarkup(
    <BuyerPaidOrderDetail
      order={{ ...order, ...changes }}
      language={language}
    />,
  );
}

describe("authorized buyer order presentation", () => {
  it("retains original amounts and purchased facts without reference receipt claims", () => {
    const html = render();
    expect(html).toContain("Original accepted title");
    expect(html).toContain("2 × €10.00");
    expect(html).toContain("€20.00");
    expect(html).toContain("€4.00");
    expect(html).toContain("€1.00");
    expect(html).toContain("€25.00");
    expect(html).toContain("Simulated TEST pickup only");
    expect(html).not.toContain("reference-media");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("Arrives");
    expect(html).not.toContain("Shop Pay");
  });

  it("keeps a pending refund separate from a completed refund and the original total", () => {
    const html = render({
      paymentState: "refund_pending",
      fulfilmentState: "blocked",
      refundState: "pending",
    });
    expect(html).toContain("Refund pending");
    expect(html).not.toContain("Refunded");
    expect(html).toContain("Collection blocked");
    expect(html).toContain("€25.00");
    expect(html).toContain("Refunds do not automatically restock items");
  });

  it("shows persisted refund and transfer reversal without claiming a bank payout", () => {
    const html = render({
      paymentState: "refunded",
      fulfilmentState: "blocked",
      settlementState: "reversed",
      refundState: "succeeded",
    });
    expect(html).toContain("Refunded");
    expect(html).toContain("Transfer reversed");
    expect(html).toContain("separate from a payout to the seller’s bank");
    expect(html).toContain("€25.00");
  });

  it.each([
    ["failed", "Refund unsuccessful"],
    ["reconciling", "Checking refund"],
    ["unexpected-provider-state", "Refund status unavailable"],
  ])("never turns %s into a completed refund", (refundState, expected) => {
    const html = render({ paymentState: "reconciliation", refundState });
    expect(html).toContain(expected);
    expect(html).not.toContain("Refunded");
  });

  it("does not infer shipping completion from the pickup collection field", () => {
    const html = render({ handover: "shipping" });
    expect(html).toContain("Shipping progress is currently unavailable");
    expect(html).not.toContain("Collected");
    const dispatched = render({
      handover: "shipping",
      shippingFulfilmentState: "seller_reported_dispatched",
    });
    expect(dispatched).toContain("Seller reported dispatch");
    expect(dispatched).not.toContain("Buyer confirmed receipt");
  });

  it("translates the uncertain refund facts in Bulgarian while preserving authored copy", () => {
    const html = render({ refundState: "reconciling" }, "bg");
    expect(html).toContain("Проверка на възстановяването");
    expect(html).toContain("Original accepted title");
    expect(html).toContain("Simulated TEST pickup only");
    expect(html).not.toContain("Refunded");
  });
});

describe.each([
  {
    language: "en" as const,
    pending: "Refund pending",
    succeeded: "Refunded",
    reversed: "Transfer reversed",
    failed: "Refund unsuccessful",
    checking: "Checking refund",
    unavailable: "Refund status unavailable",
    restock: "Refunds do not automatically restock items",
  },
  {
    language: "bg" as const,
    pending: "Чака възстановяване",
    succeeded: "Възстановено",
    reversed: "Преводът е обърнат",
    failed: "Възстановяването не е успешно",
    checking: "Проверка на възстановяването",
    unavailable: "Статусът на възстановяването не е достъпен",
    restock: "Артикулите не се връщат автоматично в наличността",
  },
])("buyer refund facts in $language", (copy) => {
  it.each(["prepared", "creating", "pending"])(
    "does not present %s as provider-confirmed success",
    (refundState) => {
      const html = render(
        { paymentState: "refund_pending", refundState },
        copy.language,
      );
      expect(html).toContain(copy.pending);
      expect(html).not.toContain(copy.succeeded);
      expect(html).toContain(copy.restock);
      expect(html).toContain("Original accepted title");
    },
  );

  it("presents the confirmed refund and reversal while retaining the accepted receipt", () => {
    const html = render(
      {
        paymentState: "refunded",
        settlementState: "reversed",
        refundState: "succeeded",
      },
      copy.language,
    );
    expect(html).toContain(copy.succeeded);
    expect(html).toContain(copy.reversed);
    expect(html).not.toContain(copy.pending);
    expect(html).toContain("Original accepted title");
    expect(html).toContain("Simulated TEST pickup only");
    expect(html).toContain(copy.restock);
  });

  it.each([
    { state: "failed", label: "failed" as const },
    { state: "reconciling", label: "checking" as const },
    { state: "unknown-new-provider-state", label: "unavailable" as const },
    { state: "", label: "unavailable" as const },
  ])("retains truthful $state recovery facts", ({ state, label }) => {
    const html = render(
      { paymentState: "reconciliation", refundState: state },
      copy.language,
    );
    expect(html).toContain(copy[label]);
    expect(html).not.toContain(copy.succeeded);
    expect(html).toContain(copy.restock);
  });
});
