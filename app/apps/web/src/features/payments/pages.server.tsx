import "server-only";
import Link from "next/link";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDatabase } from "../../server/db/database";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { readSellerContext } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { pageLocale } from "../locale/page-locale.server";
import { ShopSurface } from "../discovery/hydration-boundary";
import { FloatingNav } from "../discovery/components";
import { variantCaption } from "../inventory/model";
import {
  orderAftercareHref,
  orderFeedbackHref,
} from "../order-aftercare/integration";
import { readPayableQuote } from "./quotes.server";
import { readNewQuoteAftercareChoice } from "../order-aftercare/quote-choice.server";
import { NewQuoteAftercareControl } from "../order-aftercare/quote-choice";
import { readShippingStartEligibility } from "../order-shipping/start.server";
import { readPaidOrders } from "./orders.server";
import { readPaymentOverview } from "./overview.server";
import { readConnectReadiness } from "./connect.server";
import { SellerError } from "../sellers/errors";
import {
  PaymentBoundary,
  CreateQuoteButton,
  OnboardingButton,
  OrderControls,
} from "./controls";
import { PaymentCheckout } from "./checkout";
import { paymentText, type PaymentLanguage } from "./messages";
import type { PublicShippingTerms } from "./model";
import type { ReviewLine } from "../purchase-reviews/model";
import s from "../purchase-reviews/reviews.module.css";
import a from "../sellers/admin.module.css";
export type PaymentPageProps = {
  params: Promise<{ id?: string; sellerId?: string }>;
  searchParams: Promise<{ lang?: string }>;
};
function money(value: number, language: PaymentLanguage) {
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}
function BuyerShell({
  language,
  title,
  children,
}: {
  language: PaymentLanguage;
  title: string;
  children: ReactNode;
}) {
  const t = paymentText(language);
  return (
    <ShopSurface className={"shop-page " + s.page}>
      <header className={s.header}>
        <h1>{title}</h1>
        <nav className={s.actions} aria-label={t.payments}>
          <Link
            className={s.secondary}
            href={`/checkout/payments?lang=${language}`}
          >
            {t.payments}
          </Link>
          <Link className={s.secondary} href={`/orders?lang=${language}`}>
            {t.orders}
          </Link>
          <Link className={s.secondary} href={`/cart?lang=${language}`}>
            {t.cart}
          </Link>
        </nav>
      </header>
      {children}
      <FloatingNav back marketplace />
    </ShopSurface>
  );
}
function Lines({
  lines,
  language,
}: {
  lines: ReviewLine[];
  language: PaymentLanguage;
}) {
  return (
    <ul>
      {lines.map((line) => (
        <li key={line.skuId}>
          <div className={s.row}>
            <span>
              {line.title} · {variantCaption(line.options)} · {line.quantity}
            </span>
            <strong>
              {money(line.unitPriceMinor * line.quantity, language)}
            </strong>
          </div>
          <p className={s.muted}>{line.deliveryDetails}</p>
        </li>
      ))}
    </ul>
  );
}
const shippingCopy = {
  bg: {
    items: "Артикули",
    shipping: "Доставка",
    buyerFee: "Такса за купувача",
    country: "Държава за доставка",
    terms: "Приети условия за доставка",
    rights: "Приети права за поръчката",
    refund: "Приети условия за възстановяване",
    tax: "Данъчна информация",
    purpose: "Цел на данните за получателя",
    retention: "Съхранение на данните за получателя",
    fulfilment: "Изпълнение на поръчката",
    stateUnavailable:
      "Статусът на доставката в момента не е достъпен. Проверете поддръжката за поръчката.",
    empty:
      "Още няма плащания за преглед. Проверете текущите възможности от количката или приета оферта.",
    pickupUnavailable:
      "Личното получаване в момента не е достъпно за тези артикули и условия.",
    statuses: {
      pending: "Чака изпълнение",
      seller_reported_dispatched: "Продавачът съобщава за изпращане",
      buyer_confirmed_delivery: "Купувачът потвърди получаването",
      blocked: "Изпълнението е блокирано",
    },
  },
  en: {
    items: "Items",
    shipping: "Shipping",
    buyerFee: "Buyer fee",
    country: "Shipping country",
    terms: "Accepted shipping terms",
    rights: "Accepted order rights",
    refund: "Accepted refund terms",
    tax: "Tax information",
    purpose: "Recipient data purpose",
    retention: "Recipient data retention",
    fulfilment: "Fulfilment",
    stateUnavailable:
      "Shipping progress is currently unavailable. Check order support.",
    empty:
      "No payments to review yet. Check current options from your cart or an accepted offer.",
    pickupUnavailable:
      "Collection in person is currently unavailable for these items and terms.",
    statuses: {
      pending: "Pending fulfilment",
      seller_reported_dispatched: "Seller reported dispatch",
      buyer_confirmed_delivery: "Buyer confirmed receipt",
      blocked: "Fulfilment blocked",
    },
  },
} as const;
function ShippingSummary({
  shipping,
  amounts,
  language,
}: {
  shipping: PublicShippingTerms;
  amounts: {
    merchandiseMinor: number;
    shippingMinor: number;
    buyerFeeMinor: number;
  };
  language: PaymentLanguage;
}) {
  const copy = shippingCopy[language];
  return (
    <div>
      {(
        [
          [copy.items, amounts.merchandiseMinor],
          [copy.shipping, amounts.shippingMinor],
          [copy.buyerFee, amounts.buyerFeeMinor],
        ] as const
      ).map(([label, value]) => (
        <p className={s.row} key={label}>
          <span>{label}</span>
          <strong>{money(value, language)}</strong>
        </p>
      ))}
      {(
        [
          [copy.country, shipping.country],
          [copy.tax, shipping.taxDescription],
          [copy.terms, shipping.terms],
          [copy.rights, shipping.rights],
          [copy.refund, shipping.refundTerms],
          [copy.purpose, shipping.recipientPurpose],
          [copy.retention, shipping.retentionDescription],
        ] as const
      ).map(([label, value]) => (
        <p className={s.muted} key={label}>
          {label}: {value}
        </p>
      ))}
    </div>
  );
}
export async function PaymentOverviewPage(props: PaymentPageProps) {
  await connection();
  const language = await pageLocale((await props.searchParams).lang),
    t = paymentText(language);
  if (!backendConfigured())
    return (
      <BuyerShell language={language} title={t.payments}>
        <p>{t.unavailable}</p>
      </BuyerShell>
    );
  const identity = await requirePageIdentity(
      `/checkout/payments?lang=${language}`,
    ),
    data = await readPrivatePage(() =>
      readPaymentOverview(getDatabase(), identity),
    );
  const aftercareByPolicy = new Map<
    string,
    Awaited<ReturnType<typeof readNewQuoteAftercareChoice>>
  >();
  for (const policyId of new Set(
    data.starts
      .filter((item) => item.pickupAvailable)
      .map((item) => item.policyId),
  )) {
    aftercareByPolicy.set(
      policyId,
      await readPrivatePage(() =>
        readNewQuoteAftercareChoice(
          getDatabase(),
          identity,
          policyId,
          language,
        ),
      ),
    );
  }
  const shippingStarts: Awaited<
    ReturnType<typeof readShippingStartEligibility>
  >[] = [];
  for (const item of data.starts) {
    shippingStarts.push(
      await readPrivatePage(async () => {
        try {
          return await readShippingStartEligibility(
            getDatabase(),
            identity,
            item.source,
            language,
          );
        } catch (error) {
          if (error instanceof SellerError && error.code === "NOT_AVAILABLE")
            return { available: false, href: null };
          throw error;
        }
      }),
    );
  }
  return (
    <BuyerShell language={language} title={t.payments}>
      <PaymentBoundary actorSubject={identity.subject} language={language}>
        {!data.available && <p>{t.policyUnavailable}</p>}
        {!data.starts.length && !data.quotes.length && (
          <p role="status">{shippingCopy[language].empty}</p>
        )}
        <div className={s.stack}>
          {data.starts.map((item, index) => {
            const aftercare = aftercareByPolicy.get(item.policyId)?.choice;
            const shipping = shippingStarts[index];
            return (
              <section className={s.card} key={item.policyId + index}>
                <h2>{item.sellerName}</h2>
                {item.pickupAvailable ? (
                  <>
                    <p>{t.pickup}</p>
                    {aftercare ? (
                      <NewQuoteAftercareControl
                        actorKey={libraryActorKey(identity)}
                        actorSubject={identity.subject}
                        source={item.source}
                        policyId={item.policyId}
                        language={language}
                        choice={aftercare}
                      />
                    ) : (
                      <CreateQuoteButton
                        actorKey={libraryActorKey(identity)}
                        actorSubject={identity.subject}
                        source={item.source}
                        policyId={item.policyId}
                        language={language}
                      />
                    )}
                  </>
                ) : (
                  <p>{shippingCopy[language].pickupUnavailable}</p>
                )}
                {shipping?.href ? (
                  <Link className={s.link} href={shipping.href}>
                    {language === "bg"
                      ? "Преглед на доставка"
                      : "Review shipping"}
                  </Link>
                ) : (
                  <p>
                    {language === "bg"
                      ? "Доставката в момента не е достъпна за тези артикули и условия."
                      : "Shipping is currently unavailable for these items and terms."}
                  </p>
                )}
              </section>
            );
          })}
        </div>
        <div className={s.list}>
          {data.quotes.map((quote) => (
            <Link
              className={s.card}
              key={quote.id}
              href={`/checkout/payments/${quote.id}?lang=${language}`}
            >
              <strong>{quote.sellerName}</strong>
              <span> {money(quote.totalMinor, language)}</span>
              {quote.state && <p>{t.statuses[quote.state]}</p>}
              <p>
                {t.deadline}:{" "}
                {new Intl.DateTimeFormat(language, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(quote.expiresAt))}
              </p>
            </Link>
          ))}
        </div>
      </PaymentBoundary>
    </BuyerShell>
  );
}
export async function PaymentQuotePage(props: PaymentPageProps) {
  await connection();
  const { id } = await props.params,
    language = await pageLocale((await props.searchParams).lang),
    t = paymentText(language);
  if (!id) notFound();
  if (!backendConfigured())
    return (
      <BuyerShell language={language} title={t.checkout}>
        <p>{t.unavailable}</p>
      </BuyerShell>
    );
  const identity = await requirePageIdentity(
      `/checkout/payments/${id}?lang=${language}`,
    ),
    quote = await readPrivatePage(() =>
      readPayableQuote(getDatabase(), identity, id),
    );
  return (
    <BuyerShell language={language} title={t.checkout}>
      <PaymentBoundary actorSubject={identity.subject} language={language}>
        <section className={s.card}>
          <h2>{quote.sellerName}</h2>
          <Lines lines={quote.lines} language={language} />
          <p>
            <strong>
              {t.total}: {money(quote.totalMinor, language)}
            </strong>
          </p>
          {quote.terms.handover === "shipping" ? (
            quote.terms.shipping ? (
              <ShippingSummary
                shipping={quote.terms.shipping}
                amounts={quote}
                language={language}
              />
            ) : (
              <p>{t.unavailable}</p>
            )
          ) : (
            <>
              <p>{t.pickup}</p>
              <p>{t.tax}</p>
            </>
          )}
          <p>
            {t.deadline}:{" "}
            {new Intl.DateTimeFormat(language, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(quote.expiresAt))}
          </p>
          <p className={s.muted}>
            {t.terms}: {quote.terms.buyerTerms}
          </p>
          {quote.terms.aftercare && (
            <p className={s.muted}>
              {t.terms}: {quote.terms.aftercare.buyerTerms}
            </p>
          )}
        </section>
        {(quote.terms.handover !== "shipping" || quote.terms.shipping) && (
          <PaymentCheckout
            key={libraryActorKey(identity) + quote.id}
            quote={quote}
            actorKey={libraryActorKey(identity)}
            actorSubject={identity.subject}
            language={language}
          />
        )}
      </PaymentBoundary>
    </BuyerShell>
  );
}
export async function PaidOrdersPage(props: PaymentPageProps) {
  await connection();
  const { id, sellerId } = await props.params,
    language = await pageLocale((await props.searchParams).lang),
    t = paymentText(language);
  const merchant = !!sellerId;
  function shell(children: ReactNode) {
    return merchant ? (
      <main className={s.merchant}>
        <header className={a.pageBar}>
          <h1>{t.orders}</h1>
        </header>
        <div className={a.pageBody}>{children}</div>
      </main>
    ) : (
      <BuyerShell language={language} title={t.orders}>
        {children}
      </BuyerShell>
    );
  }
  if (!backendConfigured()) return shell(<p>{t.unavailable}</p>);
  const path = merchant
    ? `/app/sellers/${sellerId}/orders${id ? "/" + id : ""}`
    : `/orders${id ? "/" + id : ""}`;
  const identity = await requirePageIdentity(path + `?lang=${language}`),
    orders = await readPrivatePage(() =>
      readPaidOrders(getDatabase(), identity, sellerId ?? null, id),
    );
  const context = sellerId
    ? await readPrivatePage(() =>
        readSellerContext(getDatabase(), identity, sellerId),
      )
    : null;
  return shell(
    <PaymentBoundary actorSubject={identity.subject} language={language}>
      <div className={s.stack}>
        {!orders.length && <p>{t.empty}</p>}
        {orders.map((order) => (
          <section className={s.card} key={order.id}>
            <h2>{order.sellerName}</h2>
            <p>
              <strong>{money(order.totalMinor, language)}</strong>
            </p>
            <p>
              {t.payment}: {t.statuses[order.paymentState]}
            </p>
            <p>
              {order.handover === "shipping"
                ? `${shippingCopy[language].fulfilment}: ${order.shippingFulfilmentState ? shippingCopy[language].statuses[order.shippingFulfilmentState] : shippingCopy[language].stateUnavailable}`
                : `${t.fulfilment}: ${t.statuses[order.fulfilmentState]}`}
            </p>
            <p>
              {t.settlement}: {t.statuses[order.settlementState]}
            </p>
            <p className={s.muted}>{t.settlementNotice}</p>
            {id ? (
              <>
                <Lines lines={order.lines} language={language} />
                {order.handover === "shipping" &&
                  (order.shipping ? (
                    <ShippingSummary
                      shipping={order.shipping}
                      amounts={order}
                      language={language}
                    />
                  ) : (
                    <p>{t.unavailable}</p>
                  ))}
                <nav className={s.actions} aria-label={t.orders}>
                  <Link
                    className={s.secondary}
                    href={orderAftercareHref(
                      order.id,
                      sellerId ?? null,
                      language,
                    )}
                  >
                    {language === "bg"
                      ? "Поддръжка за поръчката"
                      : "Order support"}
                  </Link>
                  {!merchant && (
                    <Link
                      className={s.secondary}
                      href={orderFeedbackHref(order.id, language)}
                    >
                      {language === "bg"
                        ? "Прегледай възможността за отзив"
                        : "Review feedback eligibility"}
                    </Link>
                  )}
                </nav>
                {order.handover === "pickup" && (
                  <OrderControls
                    order={order}
                    actorKey={libraryActorKey(identity)}
                    actorSubject={identity.subject}
                    sellerId={sellerId ?? null}
                    canFulfil={
                      context?.capabilities.includes("order.fulfil") ?? false
                    }
                    canRefund={
                      context?.capabilities.includes("refund.request") ?? false
                    }
                    language={language}
                  />
                )}
              </>
            ) : (
              <Link
                className={s.secondary}
                href={`${path}/${order.id}?lang=${language}`}
              >
                {t.orders}
              </Link>
            )}
          </section>
        ))}
      </div>
    </PaymentBoundary>,
  );
}
export async function SellerPaymentSettingsPage(props: PaymentPageProps) {
  await connection();
  const { sellerId } = await props.params,
    language = await pageLocale((await props.searchParams).lang),
    t = paymentText(language);
  if (!sellerId) notFound();
  if (!backendConfigured()) return <p>{t.unavailable}</p>;
  const path = `/app/sellers/${sellerId}/settings/payments`,
    identity = await requirePageIdentity(path + `?lang=${language}`),
    context = await readPrivatePage(() =>
      readSellerContext(getDatabase(), identity, sellerId),
    );
  let readiness: Awaited<ReturnType<typeof readConnectReadiness>> | null = null;
  try {
    readiness = await readConnectReadiness(getDatabase(), identity, sellerId);
  } catch (error) {
    if (!(error instanceof SellerError && error.code === "NOT_AVAILABLE"))
      throw new Error("Payment account status is unavailable.");
  }
  return (
    <main className={s.merchant}>
      <header className={a.pageBar}>
        <h1>{t.payments}</h1>
      </header>
      <div className={a.pageBody}>
        <PaymentBoundary actorSubject={identity.subject} language={language}>
          <div className={s.stack}>
            <section className={s.card}>
              <h2>{context.name}</h2>
              <p>
                {readiness
                  ? readiness.ready
                    ? t.ready
                    : t.notReady
                  : t.unavailable}
              </p>
              <p className={s.muted}>{t.noRedirect}</p>
              {readiness && (
                <>
                  <p>{t.requirements}</p>
                  <ul>
                    {[
                      ...new Set([
                        ...readiness.currentlyDue,
                        ...readiness.pastDue,
                        ...readiness.pendingVerification,
                      ]),
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {context.capabilities.includes("payment.setup") && (
                    <OnboardingButton
                      actorKey={libraryActorKey(identity)}
                      actorSubject={identity.subject}
                      sellerId={sellerId}
                      language={language}
                    />
                  )}
                </>
              )}
            </section>
            <nav className={s.actions}>
              <Link
                className={s.secondary}
                href={`/app/sellers/${sellerId}/orders?lang=${language}`}
              >
                {t.orders}
              </Link>
              <Link
                className={s.secondary}
                href={`/app/sellers/${sellerId}/settings/contact?lang=${language}`}
              >
                {language === "bg"
                  ? "Настройки за контакт"
                  : "Contact settings"}
              </Link>
              <Link className={s.secondary} href={path + `?lang=${language}`}>
                {t.refresh}
              </Link>
            </nav>
          </div>
        </PaymentBoundary>
      </div>
    </main>
  );
}
