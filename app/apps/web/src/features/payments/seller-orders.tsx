import Link from "next/link";
import type { ReactNode } from "react";
import type { OrderView } from "./model";
import { paymentText, type PaymentLanguage } from "./messages";
import { orderAftercareHref } from "../order-aftercare/integration";
import a from "../sellers/admin.module.css";
import e from "../sellers/admin-editor.module.css";
import p from "../sellers/preview/preview.module.css";
import s from "./seller-orders.module.css";

export type SellerOrdersProps = {
  orders: OrderView[];
  sellerId: string;
  language: PaymentLanguage;
  detail: boolean;
  controls?: ReactNode;
};

const copy = {
  en: {
    order: "Order",
    back: "Back to orders",
    items: "Items",
    quantity: "Quantity",
    support: "Order support",
    shipping: "Shipping",
    buyerFee: "Buyer fee",
    shippingState: "Delivery",
    unavailable: "Status unavailable",
    pending: "Pending",
    seller_reported_dispatched: "Seller reported dispatch",
    buyer_confirmed_delivery: "Buyer confirmed delivery",
    blocked: "Delivery blocked",
    terms: "Accepted shipping terms",
    rights: "Accepted order rights",
    refundTerms: "Accepted refund terms",
    tax: "Tax information",
    country: "Shipping country",
    purpose: "Recipient data purpose",
    retention: "Recipient data retention",
    method: "Handover",
    refund: "Refund",
    refundStates: {
      prepared: "Refund request recorded",
      creating: "Submitting refund",
      pending: "Refund pending",
      reconciling: "Checking refund",
      succeeded: "Refund verified",
      failed: "Refund failed. Check status before continuing.",
    } as Record<string, string>,
    refundUnknown: "Refund result unconfirmed",
  },
  bg: {
    order: "Поръчка",
    back: "Към поръчките",
    items: "Артикули",
    quantity: "Количество",
    support: "Поддръжка за поръчката",
    shipping: "Доставка",
    buyerFee: "Такса за купувача",
    shippingState: "Доставка",
    unavailable: "Статусът не е достъпен",
    pending: "Чака",
    seller_reported_dispatched: "Продавачът е посочил изпращане",
    buyer_confirmed_delivery: "Купувачът е потвърдил получаване",
    blocked: "Доставката е блокирана",
    terms: "Приети условия за доставка",
    rights: "Приети права за поръчката",
    refundTerms: "Приети условия за възстановяване",
    tax: "Данъчна информация",
    country: "Държава за доставка",
    purpose: "Цел на данните за получателя",
    retention: "Съхранение на данните за получателя",
    method: "Получаване",
    refund: "Възстановяване",
    refundStates: {
      prepared: "Заявката за възстановяване е записана",
      creating: "Изпращане на възстановяването",
      pending: "Чака възстановяване",
      reconciling: "Проверка на възстановяването",
      succeeded: "Възстановяването е потвърдено",
      failed:
        "Възстановяването е неуспешно. Проверете статуса, преди да продължите.",
    } as Record<string, string>,
    refundUnknown: "Резултатът от възстановяването не е потвърден",
  },
};

function money(amount: number, language: PaymentLanguage) {
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: "EUR",
  }).format(amount / 100);
}
function fulfilment(order: OrderView, language: PaymentLanguage) {
  const t = paymentText(language),
    c = copy[language];
  return order.handover === "shipping"
    ? [
        c.shippingState,
        order.shippingFulfilmentState
          ? c[order.shippingFulfilmentState]
          : c.unavailable,
      ]
    : [t.fulfilment, t.statuses[order.fulfilmentState]];
}

function refundOutcome(state: string, language: PaymentLanguage) {
  const c = copy[language];
  return Object.hasOwn(c.refundStates, state)
    ? c.refundStates[state]
    : c.refundUnknown;
}

export function SellerOrders({
  orders,
  sellerId,
  language,
  detail,
  controls,
}: SellerOrdersProps) {
  const t = paymentText(language),
    c = copy[language];
  const path = `/app/sellers/${sellerId}/orders`;
  if (!orders.length)
    return (
      <p role="status" className={a.empty}>
        {t.empty}
      </p>
    );
  if (!detail)
    return (
      <section className={`${p.tablePanel} ${s.list}`} aria-label={t.orders}>
        <div className={p.tableScroll}>
          <table className={p.table}>
            <thead>
              <tr>
                <th>{c.order}</th>
                <th>{t.payment}</th>
                <th>{c.method}</th>
                <th>{t.total}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link
                      className={p.cellLink}
                      href={`${path}/${order.id}?lang=${language}`}
                      aria-label={`${c.order} ${order.id}`}
                    >
                      <span className={s.orderId}>{order.id}</span>
                    </Link>
                  </td>
                  <td>
                    <span className={p.badge}>
                      {t.statuses[order.paymentState]}
                    </span>
                    {order.refundState && (
                      <p className={p.help}>
                        {refundOutcome(order.refundState, language)}
                      </p>
                    )}
                  </td>
                  <td>{fulfilment(order, language)[1]}</td>
                  <td>{money(order.totalMinor, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  return (
    <div className={p.stack}>
      {orders.map((order) => {
        const [label, status] = fulfilment(order, language);
        return (
          <article
            key={order.id}
            className={p.stack}
            aria-label={`${c.order} ${order.id}`}
          >
            <nav className={p.actions}>
              <Link
                className={`${p.button} ${s.touchAction}`}
                href={`${path}?lang=${language}`}
              >
                {c.back}
              </Link>
            </nav>
            <div className={e.layout}>
              <div className={e.main}>
                <section className={e.panel}>
                  <div className={s.heading}>
                    <h2>{label}</h2>
                    <span className={`${p.badge} ${s.badge}`}>{status}</span>
                  </div>
                  <ul className={s.lines}>
                    {order.lines.map((line) => (
                      <li key={`${line.listingId}:${line.skuId}`}>
                        <div>
                          <strong>{line.title}</strong>
                          {Object.values(line.options).length > 0 && (
                            <p className={p.help}>
                              {Object.values(line.options).join(" · ")}
                            </p>
                          )}
                          <p className={p.help}>
                            {c.quantity}: {line.quantity}
                          </p>
                          {line.deliveryDetails && (
                            <p className={p.help}>{line.deliveryDetails}</p>
                          )}
                        </div>
                        <span>
                          {money(line.unitPriceMinor * line.quantity, language)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className={e.panel}>
                  <div className={s.heading}>
                    <h2>{t.payment}</h2>
                    <span className={`${p.badge} ${s.badge}`}>
                      {t.statuses[order.paymentState]}
                    </span>
                  </div>
                  <dl className={s.facts}>
                    <div>
                      <dt>{t.settlement}</dt>
                      <dd>{t.statuses[order.settlementState]}</dd>
                    </div>
                    {order.refundState && (
                      <div>
                        <dt>{c.refund}</dt>
                        <dd role="status">
                          {refundOutcome(order.refundState, language)}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className={p.muted}>{t.settlementNotice}</p>
                  {controls}
                </section>
                {order.handover === "shipping" &&
                  (order.shipping ? (
                    <section className={e.panel}>
                      <h2>{c.country}</h2>
                      <p>{order.shipping.country}</p>
                      <h2>{c.terms}</h2>
                      <p>{order.shipping.terms}</p>
                      <h2>{c.rights}</h2>
                      <p>{order.shipping.rights}</p>
                      <h2>{c.refundTerms}</h2>
                      <p>{order.shipping.refundTerms}</p>
                      <h2>{c.tax}</h2>
                      <p>{order.shipping.taxDescription}</p>
                      <h2>{c.purpose}</h2>
                      <p>{order.shipping.recipientPurpose}</p>
                      <h2>{c.retention}</h2>
                      <p>{order.shipping.retentionDescription}</p>
                    </section>
                  ) : (
                    <p role="status">{t.unavailable}</p>
                  ))}
              </div>
              <aside className={e.main}>
                <section className={e.panel}>
                  <h2>{t.total}</h2>
                  <dl className={s.facts}>
                    <div>
                      <dt>{c.items}</dt>
                      <dd>{money(order.merchandiseMinor, language)}</dd>
                    </div>
                    {(order.handover === "shipping" ||
                      order.shippingMinor > 0) && (
                      <div>
                        <dt>{c.shipping}</dt>
                        <dd>{money(order.shippingMinor, language)}</dd>
                      </div>
                    )}
                    {(order.handover === "shipping" ||
                      order.buyerFeeMinor > 0) && (
                      <div>
                        <dt>{c.buyerFee}</dt>
                        <dd>{money(order.buyerFeeMinor, language)}</dd>
                      </div>
                    )}
                    <div className={s.total}>
                      <dt>{t.total}</dt>
                      <dd>{money(order.totalMinor, language)}</dd>
                    </div>
                  </dl>
                  <Link
                    className={`${p.button} ${s.touchAction}`}
                    href={orderAftercareHref(order.id, sellerId, language)}
                  >
                    {c.support}
                  </Link>
                </section>
              </aside>
            </div>
          </article>
        );
      })}
    </div>
  );
}
