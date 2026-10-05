import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations, getFormatter } from "next-intl/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { BackendUnavailable } from "../sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { getDatabase } from "../../server/db/database";
import { PrivatePurchaseBoundary } from "../purchase-reviews/controls";
import { readInquiryQueue, readInquiryDetail } from "./queries.server";
import { INQUIRY_STATUSES } from "./model";
import { InquiryWorkflow } from "./workflow";
import { inquiryWorkflowView } from "./workflow-model";
import s from "../purchase-reviews/reviews.module.css";
import a from "../sellers/admin.module.css";
type Query = { lang?: string; status?: string; before?: string; q?: string };
type PageProps = {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<Query>;
};
export async function SellerInquiriesPage(props: PageProps) {
  await connection();
  const { sellerId } = await props.params,
    query = await props.searchParams,
    language = await pageLocale(query.lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const base = "/app/sellers/" + sellerId + "/inquiries",
    identity = await requirePageIdentity(base + "?lang=" + language);
  const data = await readPrivatePage(() =>
    readInquiryQueue(getDatabase(), identity, {
      sellerId,
      status: query.status,
      before: query.before,
      q: query.q,
    }),
  );
  const t = await getTranslations({
      locale: language,
      namespace: "contactOperations",
    }),
    format = await getFormatter({ locale: language }),
    status = query.status ?? "open";
  const url = (nextStatus: string, before?: string) =>
    base +
    "?" +
    new URLSearchParams({
      lang: language,
      status: nextStatus,
      ...(query.q ? { q: query.q } : {}),
      ...(before ? { before } : {}),
    });
  return (
    <main className={s.merchant}>
      <header className={a.pageBar}>
        <h1>{t("title")}</h1>
      </header>
      <div className={a.pageBody}>
        <PrivatePurchaseBoundary actorSubject={identity.subject}>
          <div className={s.stack}>
            <p>{t("boundary")}</p>
            <form action={base} className={s.actions}>
              <input
                name="q"
                type="search"
                maxLength={80}
                defaultValue={query.q ?? ""}
                aria-label={t("search")}
                placeholder={t("search")}
              />
              <label className={s.field}>
                {t("status")}
                <select name="status" defaultValue={status}>
                  {(["open", "all", ...INQUIRY_STATUSES] as const).map(
                    (value) => (
                      <option key={value} value={value}>
                        {t(value)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <input name="lang" type="hidden" value={language} />
              <button className={s.secondary}>{t("searchSubmit")}</button>
            </form>
            <nav className={s.actions} aria-label={t("title")}>
              <Link
                className={s.secondary}
                href={url("open")}
                aria-current={status === "open" ? "page" : undefined}
              >
                {t("open")}
              </Link>
              <Link
                className={s.secondary}
                href={url("all")}
                aria-current={status === "all" ? "page" : undefined}
              >
                {t("all")}
              </Link>
              <Link
                className={s.secondary}
                href={"/app/sellers/" + sellerId + "/inbox?lang=" + language}
              >
                {t("inbox")}
              </Link>
            </nav>
            {!data.items.length && (
              <section className={s.card}>
                <p>{t("empty")}</p>
              </section>
            )}
            <div className={s.list}>
              {data.items.map((item) => (
                <Link
                  className={s.card}
                  key={item.id}
                  href={base + "/" + item.id + "?lang=" + language}
                >
                  <div className={s.row}>
                    <h2>{item.lines[0]?.title}</h2>
                    <span className={s.badge}>{t(item.status)}</span>
                  </div>
                  <p>
                    {t("lines", { count: item.lines.length })} ·{" "}
                    {format.number(item.merchandiseMinor / 100, {
                      style: "currency",
                      currency: item.currency,
                    })}
                  </p>
                  <small>
                    {t("sentAt", {
                      time: format.dateTime(new Date(item.sentAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    })}
                  </small>
                  <p>{t("openInquiry")}</p>
                </Link>
              ))}
            </div>
            {data.nextBefore && (
              <Link className={s.secondary} href={url(status, data.nextBefore)}>
                {t("older")}
              </Link>
            )}
          </div>
        </PrivatePurchaseBoundary>
      </div>
    </main>
  );
}
export async function SellerInquiryPage(props: {
  params: Promise<{ sellerId: string; reviewId: string }>;
  searchParams: Promise<Query>;
}) {
  await connection();
  const { sellerId, reviewId } = await props.params,
    query = await props.searchParams,
    language = await pageLocale(query.lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const base = "/app/sellers/" + sellerId,
    identity = await requirePageIdentity(
      base + "/inquiries/" + reviewId + "?lang=" + language,
    );
  const data = await readPrivatePage(() =>
    readInquiryDetail(getDatabase(), identity, sellerId, reviewId),
  );
  const t = await getTranslations({
      locale: language,
      namespace: "contactOperations",
    }),
    p = await getTranslations({
      locale: language,
      namespace: "purchaseReviews",
    }),
    format = await getFormatter({ locale: language }),
    item = data.item;
  const money = (minor: number) =>
    format.number(minor / 100, { style: "currency", currency: item.currency });
  return (
    <main className={s.merchant}>
      <header className={a.pageBar}>
        <h1>{t("detail")}</h1>
      </header>
      <div className={a.pageBody}>
        <PrivatePurchaseBoundary actorSubject={identity.subject}>
          <div className={s.stack}>
            <nav className={s.actions} aria-label={t("title")}>
              <Link
                className={s.secondary}
                href={base + "/inquiries?lang=" + language}
              >
                {t("title")}
              </Link>
              <Link
                className={s.primary}
                href={base + "/inbox/" + item.threadId + "?lang=" + language}
              >
                {t("conversation")}
              </Link>
            </nav>
            <section className={s.card}>
              <div className={s.row}>
                <h2>{t("detail")}</h2>
                <span className={s.badge}>{t(item.status)}</span>
              </div>
              <p>{t("snapshot")}</p>
              {item.expired && (
                <p className={s.notice}>{t("expiredSnapshot")}</p>
              )}
              <small>
                {t("sentAt", {
                  time: format.dateTime(new Date(item.sentAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </small>
              <ul className={s.lines}>
                {item.lines.map((line) => (
                  <li key={line.skuId}>
                    <div className={s.row}>
                      <strong>{line.title}</strong>
                      <strong>
                        {money(line.quantity * line.unitPriceMinor)}
                      </strong>
                    </div>
                    <p>
                      {line.quantity} × {money(line.unitPriceMinor)} ·{" "}
                      {Object.values(line.options).join(" / ")}
                    </p>
                    <p>{line.deliveryDetails}</p>
                  </li>
                ))}
              </ul>
              <dl className={s.totals}>
                <div>
                  <dt>{t("subtotal")}</dt>
                  <dd>{money(item.merchandiseMinor)}</dd>
                </div>
                <div>
                  <dt>{p("handover")}</dt>
                  <dd>{p(item.handover)}</dd>
                </div>
                <div>
                  <dt>{p("payable")}</dt>
                  <dd>{p("unknown")}</dd>
                </div>
              </dl>
              <p className={s.muted}>
                {t("reference")}: {item.id}
              </p>
            </section>
            <InquiryWorkflow
              key={identity.subject + sellerId + reviewId}
              initial={inquiryWorkflowView(data)}
              actorSubject={identity.subject}
            />
          </div>
        </PrivatePurchaseBoundary>
      </div>
    </main>
  );
}
