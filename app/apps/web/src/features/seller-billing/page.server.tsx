import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDatabase } from "../../server/db/database";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { pageLocale } from "../locale/page-locale.server";
import { PaymentBoundary } from "../payments/controls";
import { validId } from "../selling/draft-model";
import { readSellerBilling } from "./queries.server";
import { PLANS, type PlanId } from "./model";
import { billingText } from "./messages";
import { BillingControls } from "./controls";
import { BillingRecoveryHistory } from "./recovery-history";
import a from "../sellers/admin.module.css";
import s from "./billing.module.css";

export async function SellerBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { sellerId } = await params,
    query = await searchParams;
  if (
    !validId(sellerId) ||
    Object.keys(query).some((k) => k !== "lang") ||
    (query.lang !== undefined && !["bg", "en"].includes(String(query.lang)))
  )
    notFound();
  const language = await pageLocale(query.lang as string | undefined),
    t = billingText(language);
  if (!backendConfigured()) return <p>{t.unavailable}</p>;
  const path = `/app/sellers/${sellerId}/billing?lang=${language}`,
    identity = await requirePageIdentity(path),
    view = await readPrivatePage(() =>
      readSellerBilling(getDatabase(), identity, sellerId),
    );
  const proposed = PLANS[(view.kind + "_pro") as PlanId];
  const format = (n: number) =>
    new Intl.NumberFormat(language, {
      style: "currency",
      currency: "EUR",
    }).format(n / 100);
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t.title}</h1>
      </header>
      <div className={a.pageBody}>
        <PaymentBoundary actorSubject={identity.subject} language={language}>
          <div className={s.body}>
            <section className={s.card}>
              <h2>
                {view.sellerName} · {t.current}:{" "}
                {view.limits.paidUntil ? t.pro : t.free}
              </h2>
              {view.limits.paidUntil && (
                <p>
                  {t.until}:{" "}
                  <time dateTime={view.limits.paidUntil}>
                    {new Date(view.limits.paidUntil).toLocaleString(language)}
                  </time>
                </p>
              )}
              <p className={s.muted}>{t.verified}</p>
              <p className={s.muted}>{t.preservation}</p>
              <table className={s.table}>
                <tbody>
                  <tr>
                    <th scope="row">{t.active}</th>
                    <td>
                      {view.usage.active} / {view.limits.active}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t.drafts}</th>
                    <td>
                      {view.usage.drafts} / {view.limits.drafts}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t.seats}</th>
                    <td>
                      {view.usage.seats} / {view.limits.seats}
                      {view.kind === "business" && (
                        <small className={s.muted}>
                          {" "}
                          · {view.usage.occupiedSeats}{" "}
                          {language === "bg" ? "заети" : "occupied"} +{" "}
                          {view.usage.pendingSeats}{" "}
                          {language === "bg"
                            ? "резервирани покани"
                            : "reserved invitations"}
                        </small>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t.variants}</th>
                    <td>
                      {view.usage.variants} / {view.limits.variants}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t.imports}</th>
                    <td>{view.limits.importRows}</td>
                  </tr>
                  <tr>
                    <th scope="row">{t.history}</th>
                    <td>{view.limits.historyDays}</td>
                  </tr>
                  <tr>
                    <th scope="row">{t.export}</th>
                    <td>{view.limits.commercialExport ? t.yes : t.no}</td>
                  </tr>
                </tbody>
              </table>
            </section>
            <section className={s.card}>
              {view.plans.length ? (
                view.plans.map((p) => (
                  <section key={p.id}>
                    <p>
                      {t.pro}: {format(p.amountMinor)} · {t.version} {p.version}{" "}
                      · {t.terms} {p.termsVersion}
                    </p>
                    <p>{p.terms[language]}</p>
                  </section>
                ))
              ) : (
                <>
                  <h2>
                    {t.proposed}: {format(proposed.amountMinor)}
                  </h2>
                  <p>{t.unavailable}</p>
                </>
              )}
              {view.subscription && (
                <>
                  <p>
                    {t.status}: {view.subscription.state}
                  </p>
                  <p>
                    {t.observed}:{" "}
                    {new Date(view.subscription.observedAt).toLocaleString(
                      language,
                    )}
                  </p>
                  {view.subscription.cancelAtPeriodEnd && <p>{t.ended}</p>}
                </>
              )}
              <BillingControls
                key={view.actorKey + ":" + sellerId}
                view={view}
                language={language}
              />
            </section>
            <section className={s.card}>
              <h2>{t.invoices}</h2>
              {view.invoices.length ? (
                <ul>
                  {view.invoices.map((i) => (
                    <li key={i.id}>
                      {format(i.amountMinor)} · {i.status} ·{" "}
                      {new Date(i.observedAt).toLocaleDateString(language)}{" "}
                      {i.url && (
                        <a
                          href={i.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {t.openInvoice}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {view.financialHistoryAvailable
                    ? t.empty
                    : language === "bg"
                      ? "Историята на фактурите не е достъпна чрез текущата платежна връзка. Това не означава, че няма финансови задължения."
                      : "Invoice history is unavailable through the current payment binding. This does not mean there are no financial obligations."}
                </p>
              )}
            </section>
            <BillingRecoveryHistory
              receipts={view.recoveryRequests}
              language={language}
            />
            <Link href={path}>{t.refresh}</Link>
          </div>
        </PaymentBoundary>
      </div>
    </main>
  );
}
