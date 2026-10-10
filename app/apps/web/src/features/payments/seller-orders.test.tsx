import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SellerOrders } from "./seller-orders";
import {
  SellerOrderActions,
  type SellerOrderActionsProps,
} from "./seller-order-actions";
import type { OrderCommand, OrderView } from "./model";
import type { PaymentLanguage } from "./messages";

const order: OrderView = {
  id: "10000000-0000-4000-8000-000000000001",
  quoteId: "10000000-0000-4000-8000-000000000002",
  sellerId: "10000000-0000-4000-8000-000000000003",
  sellerName: "Synthetic seller",
  totalMinor: 100,
  merchandiseMinor: 100,
  shippingMinor: 0,
  buyerFeeMinor: 0,
  currency: "EUR",
  handover: "pickup",
  shipping: null,
  shippingFulfilmentState: null,
  paymentState: "paid",
  fulfilmentState: "collected",
  settlementState: "transferred",
  refundState: null,
  revision: 2,
  createdAt: "2026-10-10T08:00:00Z",
  lines: [
    {
      listingId: "10000000-0000-4000-8000-000000000004",
      skuId: "10000000-0000-4000-8000-000000000005",
      publicationRevision: 3,
      title: "Original accepted title",
      options: {},
      quantity: 1,
      unitPriceMinor: 100,
      deliveryDetails: "TEST simulated collection",
      current: false,
      available: 0,
    },
  ],
};
function view(
  changes: Partial<OrderView> = {},
  language: PaymentLanguage = "en",
  detail = true,
) {
  return renderToStaticMarkup(
    <SellerOrders
      orders={[{ ...order, ...changes }]}
      sellerId={order.sellerId}
      language={language}
      detail={detail}
    />,
  );
}
function actions(changes: Partial<SellerOrderActionsProps> = {}) {
  return renderToStaticMarkup(
    <SellerOrderActions
      order={order}
      canFulfil
      canRefund
      language="en"
      pending={false}
      blocked={false}
      recovery={null}
      reason="TEST full refund"
      confirmed
      error={null}
      onReason={vi.fn()}
      onConfirmed={vi.fn()}
      onSubmit={vi.fn()}
      onRefresh={vi.fn()}
      {...changes}
    />,
  );
}

describe("private Studio order facts", () => {
  it.each([
    [
      "prepared",
      "Refund request recorded",
      "Заявката за възстановяване е записана",
    ],
    ["creating", "Submitting refund", "Изпращане на възстановяването"],
    ["pending", "Refund pending", "Чака възстановяване"],
    ["reconciling", "Checking refund", "Проверка на възстановяването"],
    ["succeeded", "Refund verified", "Възстановяването е потвърдено"],
    [
      "failed",
      "Refund failed. Check status before continuing.",
      "Възстановяването е неуспешно. Проверете статуса, преди да продължите.",
    ],
    [
      "__proto__",
      "Refund result unconfirmed",
      "Резултатът от възстановяването не е потвърден",
    ],
  ])(
    "renders %s separately from payment in both languages",
    (refundState, en, bg) => {
      expect(view({ refundState })).toContain(en);
      expect(view({ refundState }, "bg")).toContain(bg);
      expect(view({ refundState }, "en", false)).toContain(en);
      if (refundState !== "succeeded")
        expect(view({ refundState })).not.toContain("Refund verified");
    },
  );
  it("keeps accepted line facts and does not infer stock from refund", () => {
    const html = view({
      paymentState: "refunded",
      settlementState: "reversed",
      refundState: "succeeded",
    });
    expect(html).toContain("Original accepted title");
    expect(html).toContain("TEST simulated collection");
    expect(html).toContain("Collected");
    expect(html).toContain("Transfer reversed");
    expect(html).not.toContain("Available");
  });
  it("keeps the seller and language on list, support and return links", () => {
    expect(view({}, "bg", false)).toContain(
      `/app/sellers/${order.sellerId}/orders/${order.id}?lang=bg`,
    );
    const html = view({}, "bg");
    expect(html).toContain(`/app/sellers/${order.sellerId}/orders?lang=bg`);
    expect(html).toContain(
      `/app/sellers/${order.sellerId}/orders/${order.id}/support?lang=bg`,
    );
  });
  it.each([
    [
      "en",
      "Shipping country",
      "Recipient data purpose",
      "Recipient data retention",
      "Shipping",
      "Buyer fee",
      "€0.00",
    ],
    [
      "bg",
      "Държава за доставка",
      "Цел на данните за получателя",
      "Съхранение на данните за получателя",
      "Доставка",
      "Такса за купувача",
      "0,00\u00a0€",
    ],
  ] as const)(
    "retains accepted shipping disclosures and zero costs in %s",
    (language, country, purpose, retention, shipping, buyerFee, zero) => {
      const html = view(
        {
          handover: "shipping",
          shippingFulfilmentState: "pending",
          shipping: {
            format: "goods-shipping-v1",
            country: "BG",
            terms: "Original shipping terms",
            rights: "Original order rights",
            refundTerms: "Original refund terms",
            taxDescription: "Original tax treatment",
            recipientPurpose: "Original accepted recipient purpose",
            retentionDescription: "Original accepted retention duration",
            costs: {
              merchandiseMinor: 100,
              shippingMinor: 0,
              buyerFeeMinor: 0,
              taxMinor: null,
              taxBasis: "inclusive_unspecified",
              totalMinor: 100,
              applicationFeeMinor: 0,
            },
          },
        },
        language,
      );
      expect(html).toContain(`<h2>${country}</h2><p>BG</p>`);
      expect(html).toContain(
        `<h2>${purpose}</h2><p>Original accepted recipient purpose</p>`,
      );
      expect(html).toContain(
        `<h2>${retention}</h2><p>Original accepted retention duration</p>`,
      );
      expect(html).toContain("Original shipping terms");
      expect(html).toContain("Original order rights");
      expect(html).toContain("Original refund terms");
      expect(html).toContain("Original tax treatment");
      expect(html).toContain(`<dt>${shipping}</dt><dd>${zero}</dd>`);
      expect(html).toContain(`<dt>${buyerFee}</dt><dd>${zero}</dd>`);
    },
  );
  it.each(["en", "bg"] as const)(
    "preserves the zero-fee pickup receipt in %s",
    (language) => {
      const html = view({}, language);
      expect(html).not.toContain("<dt>Shipping</dt>");
      expect(html).not.toContain("<dt>Buyer fee</dt>");
      expect(html).not.toContain("<dt>Доставка</dt>");
      expect(html).not.toContain("<dt>Такса за купувача</dt>");
      expect(html).not.toContain("<p>BG</p>");
      expect(html).not.toContain("Recipient data purpose");
      expect(html).not.toContain("Цел на данните за получателя");
    },
  );
});

describe("seller full-refund presentation", () => {
  it.each([
    { canRefund: false },
    {
      order: {
        ...order,
        refundState: "pending",
        paymentState: "refund_pending" as const,
      },
    },
    {
      order: {
        ...order,
        refundState: "failed",
        paymentState: "reconciliation" as const,
      },
    },
    {
      order: {
        ...order,
        refundState: "succeeded",
        paymentState: "refunded" as const,
        settlementState: "reversed" as const,
      },
    },
  ])(
    "does not offer a new refund for missing capability or an existing request",
    (changes) => {
      expect(actions(changes)).not.toContain("Request full refund");
    },
  );
  it("requires a reason and explicit confirmation before requesting a refund", () => {
    expect(actions({ reason: "  ", confirmed: true })).toMatch(
      /disabled=""[^>]*>Request full refund/,
    );
    expect(actions({ confirmed: false })).toMatch(
      /disabled=""[^>]*>Request full refund/,
    );
    expect(actions()).not.toMatch(/disabled=""[^>]*>Request full refund/);
  });
  it.each([{ pending: true }, { blocked: true }])(
    "locks changed fields during pending or rejected state",
    (changes) => {
      expect(actions(changes)).toMatch(/<fieldset[^>]*disabled=""/);
    },
  );
  it("retains only the original saved request, with reconfirmation before retry", () => {
    const recovery: OrderCommand = {
      actorKey: "a".repeat(64),
      requestId: "10000000-0000-4000-8000-000000000006",
      id: order.id,
      sellerId: order.sellerId,
      expectedRevision: 2,
      action: "refund",
      reason: "Original exact reason",
    };
    const html = actions({
      recovery,
      reason: "Unsubmitted edit",
      confirmed: false,
    });
    expect(html).toContain("Original exact reason");
    expect(html).not.toContain("Unsubmitted edit");
    expect(html).not.toContain("Request full refund");
    expect(html).toMatch(/disabled=""[^>]*>Retry the saved request/);
    expect(html.match(/type="checkbox"/g)).toHaveLength(1);
    expect(html).toContain("Refunds do not automatically restock items.");
  });
  it("shows a failure while preserving the user's reason and Check status action", () => {
    const html = actions({
      error: "Current authority denied",
      reason: "Retained input",
    });
    expect(html).toContain("Retained input");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Current authority denied");
    expect(html).toContain("Check status");
  });
});
