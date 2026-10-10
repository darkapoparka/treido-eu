import type { ReactNode } from "react";
import { formatMoney } from "../catalog/types";
import { paymentText, type PaymentLanguage } from "../payments/messages";
import type { OrderView } from "../payments/model";
import parity from "./orders-parity.module.css";
import styles from "./paid-order-detail.module.css";

const copy = {
  en: {
    order: "Order",
    details: "Order details",
    items: "Items",
    shipping: "Shipping",
    buyerFee: "Buyer fee",
    refund: "Refund",
    refundChecking: "Checking refund",
    refundFailed: "Refund unsuccessful",
    refundUnavailable: "Refund status unavailable",
    fulfilment: "Fulfilment",
    shippingUnavailable: "Shipping progress is currently unavailable.",
    shippingStates: {
      pending: "Pending fulfilment",
      seller_reported_dispatched: "Seller reported dispatch",
      buyer_confirmed_delivery: "Buyer confirmed receipt",
      blocked: "Fulfilment blocked",
    },
  },
  bg: {
    order: "Поръчка",
    details: "Данни за поръчката",
    items: "Артикули",
    shipping: "Доставка",
    buyerFee: "Такса за купувача",
    refund: "Възстановяване",
    refundChecking: "Проверка на възстановяването",
    refundFailed: "Възстановяването не е успешно",
    refundUnavailable: "Статусът на възстановяването не е достъпен",
    fulfilment: "Изпълнение на поръчката",
    shippingUnavailable: "Статусът на доставката в момента не е достъпен.",
    shippingStates: {
      pending: "Чака изпълнение",
      seller_reported_dispatched: "Продавачът съобщава за изпращане",
      buyer_confirmed_delivery: "Купувачът потвърди получаването",
      blocked: "Изпълнението е блокирано",
    },
  },
} as const;

/** Shop order hierarchy supplied only with the current authorized order view. */
export function BuyerPaidOrderDetail({
  order,
  language,
  children,
}: {
  order: OrderView;
  language: PaymentLanguage;
  children?: ReactNode;
}) {
  const t = paymentText(language),
    c = copy[language],
    money = (amount: number) =>
      formatMoney({ amount, currency: order.currency }, language);
  const refund =
    order.refundState === null
      ? null
      : order.refundState === "succeeded"
        ? t.statuses.refunded
        : order.refundState === "failed"
          ? c.refundFailed
          : order.refundState === "reconciling"
            ? c.refundChecking
            : ["prepared", "creating", "pending"].includes(order.refundState)
              ? t.statuses.refund_pending
              : c.refundUnavailable;
  const headingId = `buyer-order-${order.id}`;
  return (
    <section
      className={`${parity.detail} ${styles.detail}`}
      aria-labelledby={headingId}
      data-buyer-paid-order={order.id}
    >
      <header className={styles.identity}>
        <h2 id={headingId}>{order.sellerName}</h2>
        <p>
          {c.order} <span>{order.id}</span>
        </p>
      </header>
      <section
        className={`account-panel order-status ${styles.status}`}
        aria-label={t.status}
        data-payment-state={order.paymentState}
      >
        <h3>{t.statuses[order.paymentState]}</h3>
        <dl className={styles.facts}>
          <div>
            <dt>
              {order.handover === "shipping" ? c.fulfilment : t.fulfilment}
            </dt>
            <dd>
              {order.handover === "shipping"
                ? order.shippingFulfilmentState
                  ? c.shippingStates[order.shippingFulfilmentState]
                  : c.shippingUnavailable
                : t.statuses[order.fulfilmentState]}
            </dd>
          </div>
          <div>
            <dt>{t.settlement}</dt>
            <dd>{t.statuses[order.settlementState]}</dd>
          </div>
          {refund !== null && (
            <div>
              <dt>{c.refund}</dt>
              <dd>{refund}</dd>
            </div>
          )}
        </dl>
        <p className={styles.notice}>{t.settlementNotice}</p>
        {(refund !== null || order.paymentState !== "paid") && (
          <p className={styles.notice}>{t.refundNotice}</p>
        )}
      </section>
      <section
        className={`account-panel ${styles.receipt}`}
        aria-label={c.details}
      >
        {order.lines.map((line) => (
          <div
            className={`order-item ${styles.item}`}
            key={`${line.listingId}:${line.skuId}`}
          >
            <div>
              <strong>{line.title}</strong>
              <p>
                {line.quantity} × {money(line.unitPriceMinor)}
              </p>
              {Object.keys(line.options).length > 0 && (
                <p>{Object.values(line.options).join(" · ")}</p>
              )}
              {line.deliveryDetails && <small>{line.deliveryDetails}</small>}
            </div>
            <b>{money(line.quantity * line.unitPriceMinor)}</b>
          </div>
        ))}
        <div className={`receipt-totals ${styles.totals}`}>
          <p>
            <span>{c.items}</span>
            <span>{money(order.merchandiseMinor)}</span>
          </p>
          <p>
            <span>{c.shipping}</span>
            <span>{money(order.shippingMinor)}</span>
          </p>
          <p>
            <span>{c.buyerFee}</span>
            <span>{money(order.buyerFeeMinor)}</span>
          </p>
          <p className="receipt-total">
            <strong>{t.total}</strong>
            <strong>{money(order.totalMinor)}</strong>
          </p>
        </div>
      </section>
      {children !== undefined && (
        <div className={`account-panel ${styles.controls}`}>{children}</div>
      )}
    </section>
  );
}
