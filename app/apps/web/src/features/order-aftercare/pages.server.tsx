import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getDatabase } from "../../server/db/database";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { pageLocale } from "../locale/page-locale.server";
import { ShopSurface } from "../discovery/hydration-boundary";
import { FloatingNav } from "../discovery/components";
import { PaymentBoundary } from "../payments/controls";
import { readOrderAftercare } from "./queries.server";
import { readOrderFeedback } from "../order-feedback/queries.server";
import { FeedbackComposer } from "../order-feedback/controls";
import {
  CaseComposer,
  RefundComposer,
  ExecuteRefundButton,
  ShippingControls,
} from "./controls";
import { aftercareText, aftercareState } from "./messages";
import s from "../purchase-reviews/reviews.module.css";
import a from "../sellers/admin.module.css";
export type AftercarePageProps = {
  params: Promise<{ id: string; sellerId?: string }>;
  searchParams: Promise<{ lang?: string }>;
};
function Shell({
  merchant,
  title,
  language,
  back,
  children,
}: {
  merchant: boolean;
  title: string;
  language: "bg" | "en";
  back: string;
  children: ReactNode;
}) {
  const header = (
    <header className={merchant ? a.pageBar : s.header}>
      <h1>{title}</h1>
      <Link className={s.secondary} href={back}>
        {aftercareText(language).back}
      </Link>
    </header>
  );
  return merchant ? (
    <main className={s.merchant}>
      {header}
      <div className={a.pageBody}>{children}</div>
    </main>
  ) : (
    <ShopSurface className={"shop-page " + s.page}>
      {header}
      {children}
      <FloatingNav back marketplace />
    </ShopSurface>
  );
}
function money(value: number | null, language: "bg" | "en") {
  return value === null
    ? "—"
    : new Intl.NumberFormat(language, {
        style: "currency",
        currency: "EUR",
      }).format(value / 100);
}
export async function OrderAftercarePage(
  props: AftercarePageProps,
  merchant = false,
) {
  await connection();
  const { id, sellerId } = await props.params,
    language = await pageLocale((await props.searchParams).lang),
    t = aftercareText(language);
  if (merchant && !sellerId) notFound();
  const back = merchant
    ? "/app/sellers/" + sellerId + "/orders/" + id + "?lang=" + language
    : "/orders/" + id + "?lang=" + language;
  if (!backendConfigured())
    return (
      <Shell
        merchant={merchant}
        title={t.support}
        language={language}
        back={back}
      >
        <section className={s.card}>
          <p role="status">{t.unavailable}</p>
          <Link
            className={s.secondary}
            href={
              (merchant
                ? "/app/sellers/" + sellerId + "/orders/"
                : "/orders/") +
              id +
              "/support?lang=" +
              language
            }
          >
            {language === "bg" ? "Обнови" : "Refresh"}
          </Link>
        </section>
      </Shell>
    );
  const path = merchant
    ? "/app/sellers/" + sellerId + "/orders/" + id + "/support"
    : "/orders/" + id + "/support";
  const identity = await requirePageIdentity(path + "?lang=" + language),
    view = await readPrivatePage(() =>
      readOrderAftercare(
        getDatabase(),
        identity,
        merchant ? (sellerId ?? null) : null,
        id,
        language,
      ),
    );
  return (
    <Shell
      merchant={merchant}
      title={t.support}
      language={language}
      back={back}
    >
      <PaymentBoundary actorSubject={view.actorSubject} language={language}>
        <div className={s.stack}>
          <section className={s.card}>
            <h2>{view.sellerName}</h2>
            <p>{money(view.totalMinor, language)}</p>
            <p>
              {t.refunded}: {money(view.refundedMinor, language)}
            </p>
            <p>
              {t.unresolved}: {money(view.unresolvedMinor, language)}
            </p>
            {!view.available && <p role="status">{t.unavailable}</p>}
            {view.policy && (
              <>
                <p>{view.policy.terms}</p>
                <p className={s.muted}>{view.policy.retentionDescription}</p>
              </>
            )}
            <CaseComposer
              key={view.orderId + ":new:" + view.orderRevision}
              view={view}
            />
          </section>
          {view.cases.map((item) => (
            <section className={s.card} key={item.id}>
              <h2>
                {t[item.reason]} — {aftercareState(item.state, language)}
              </h2>
              <ol className={s.lines}>
                {item.events.map((event) => (
                  <li key={event.id}>
                    <p>{event.body}</p>
                    {event.evidence.map((text, index) => (
                      <p key={index}>{text}</p>
                    ))}
                    <time dateTime={event.createdAt}>
                      {new Intl.DateTimeFormat(language, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(event.createdAt))}
                    </time>
                  </li>
                ))}
              </ol>
              {item.moreEvents && <p>{t.more}</p>}
              <CaseComposer
                key={item.id + ":" + item.revision}
                view={view}
                item={item}
              />
            </section>
          ))}
          {view.moreCases && <p>{t.more}</p>}
          <section className={s.card}>
            <h2>{t.refunds}</h2>
            <p className={s.muted}>{t.noRestock}</p>
            <RefundComposer key={view.orderRevision} view={view} />
            {view.refunds.map((item) => (
              <article key={item.id}>
                <h3>
                  {money(item.amountMinor, language)} —{" "}
                  {aftercareState(item.state, language)}
                </h3>
                <p>{item.reason}</p>
                <p>
                  {t.fee}: {money(item.feeMinor, language)}
                </p>
                <p>{aftercareState(item.settlementState, language)}</p>
                <ExecuteRefundButton
                  key={item.id + ":" + item.revision}
                  view={view}
                  item={item}
                />
              </article>
            ))}
            {view.moreRefunds && <p>{t.more}</p>}
          </section>
          <section className={s.card}>
            <h2>{t.tracking}</h2>
            <p>{aftercareState(view.fulfilment.state, language)}</p>
            {view.fulfilment.carrier && (
              <p>
                {view.fulfilment.carrier} — {view.fulfilment.trackingReference}
              </p>
            )}
            {view.fulfilment.description && (
              <p>{view.fulfilment.description}</p>
            )}
            <ShippingControls key={view.fulfilment.revision} view={view} />
          </section>
        </div>
      </PaymentBoundary>
    </Shell>
  );
}
export async function OrderFeedbackPage(props: AftercarePageProps) {
  await connection();
  const { id } = await props.params,
    language = await pageLocale((await props.searchParams).lang),
    t = aftercareText(language);
  if (!backendConfigured())
    return (
      <Shell
        merchant={false}
        title={t.feedback}
        language={language}
        back={"/orders/" + id + "?lang=" + language}
      >
        <section className={s.card}>
          <p role="status">{t.unavailable}</p>
          <Link
            className={s.secondary}
            href={"/orders/" + id + "/feedback?lang=" + language}
          >
            {language === "bg" ? "Обнови" : "Refresh"}
          </Link>
        </section>
      </Shell>
    );
  const identity = await requirePageIdentity(
      "/orders/" + id + "/feedback?lang=" + language,
    ),
    view = await readPrivatePage(() =>
      readOrderFeedback(getDatabase(), identity, id, language),
    );
  return (
    <Shell
      merchant={false}
      title={t.feedback}
      language={language}
      back={"/orders/" + id + "?lang=" + language}
    >
      <PaymentBoundary actorSubject={view.actorSubject} language={language}>
        <section className={s.card}>
          <h2>{view.sellerName}</h2>
          {view.feedback && (
            <article>
              <p>{view.feedback.rating}/5</p>
              <p>{view.feedback.body}</p>
              <p>{aftercareState(view.feedback.state, language)}</p>
              {view.feedback.reason && <p>{view.feedback.reason}</p>}
            </article>
          )}
          <FeedbackComposer key={id + ":" + view.orderRevision} view={view} />
        </section>
      </PaymentBoundary>
    </Shell>
  );
}
