import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations, getFormatter } from "next-intl/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { getDatabase } from "../../server/db/database";
import { readOwnCaseQueue, readOwnAppeal } from "./own-cases.server";
import { CaseDecisionCard } from "./case-form";
import type { ReportSummary } from "./report-views.server";
import type { OwnCaseTopic } from "./own-case-cursor.server";
import s from "../messaging/messaging.module.css";
import o from "./operations.module.css";
type Query = {
  lang?: string;
  state?: string;
  kind?: string;
  q?: string;
  before?: string;
};
async function OwnNavigation({ language }: { language: "bg" | "en" }) {
  const t = await getTranslations({
    locale: language,
    namespace: "trustCases",
  });
  return (
    <nav className={s.actions}>
      <Link className={s.button} href={"/messages?lang=" + language}>
        {t("back")}
      </Link>
      <Link className={s.button} href={"/messages/reports?lang=" + language}>
        {t("ownReports")}
      </Link>
      <Link className={s.button} href={"/messages/appeals?lang=" + language}>
        {t("yourAppeals")}
      </Link>
      <Link className={s.button} href={"/notifications?lang=" + language}>
        {t("decisionUpdates")}
      </Link>
    </nav>
  );
}
async function OwnedCasesPage({
  searchParams,
  topic,
}: {
  searchParams: Promise<Query>;
  topic: OwnCaseTopic;
}) {
  await connection();
  const raw = await searchParams,
    language = await pageLocale(raw.lang),
    t = await getTranslations({ locale: language, namespace: "trustCases" }),
    reportText = await getTranslations({
      locale: language,
      namespace: "trust",
    }),
    format = await getFormatter({ locale: language });
  if (!backendConfigured())
    return (
      <main className={s.root}>
        <p role="status">{t("unavailable")}</p>
      </main>
    );
  const base = "/messages/" + topic,
    actor = await requirePageIdentity(base + "?lang=" + language);
  const data = await readPrivatePage(() =>
    readOwnCaseQueue(getDatabase(), actor, topic, {
      state: raw.state,
      kind: raw.kind,
      q: raw.q,
      before: raw.before,
    }),
  );
  const href = (before: string | null) =>
    base +
    "?" +
    new URLSearchParams({
      lang: language,
      state: data.query.state,
      kind: data.query.kind,
      q: data.query.q,
      ...(before ? { before } : {}),
    });
  return (
    <main className={s.root}>
      <header className={s.header}>
        <h1>{t(topic === "reports" ? "ownReports" : "yourAppeals")}</h1>
      </header>
      <OwnNavigation language={language} />
      <p>{t("ownOnly")}</p>
      {topic === "appeals" && !data.available && (
        <p className={s.notice} role="status">
          {t("storageUnavailable")}
        </p>
      )}
      <form action={base} className={o.toolbar}>
        <label>
          {t("search")}
          <input
            type="search"
            name="q"
            maxLength={80}
            defaultValue={data.query.q}
          />
        </label>
        <label>
          {t("state")}
          <select name="state" defaultValue={data.query.state}>
            {(["all", "open", "resolved"] as const).map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        {topic === "reports" && (
          <label>
            {t("kind")}
            <select name="kind" defaultValue={data.query.kind}>
              {(["all", "listing", "message"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
        )}
        <input type="hidden" name="lang" value={language} />
        <button className={s.button}>{t("search")}</button>
      </form>
      {!data.items.length && <p className={s.empty}>{t("empty")}</p>}
      <div className={o.stack}>
        {data.items.map((item) => (
          <section className={s.notice} key={item.id}>
            <h2>
              {topic === "reports"
                ? t(item.resourceKind) +
                  " · " +
                  reportText(item.reason as ReportSummary["reason"])
                : t("appealDetail")}
            </h2>
            <p>
              {t(item.state)} ·{" "}
              {format.dateTime(new Date(item.at), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p className={o.text}>{item.details}</p>
            {item.decision && <CaseDecisionCard decision={item.decision} />}
            <Link
              className={s.button}
              href={base + "/" + item.id + "?lang=" + language}
            >
              {topic === "reports" ? reportText("report") : t("openAppeal")}
            </Link>
          </section>
        ))}
      </div>
      <div className={s.pagination}>
        {data.query.before && (
          <Link className={s.button} href={href(null)}>
            {t("newest")}
          </Link>
        )}
        {data.nextBefore && (
          <Link className={s.button} href={href(data.nextBefore)}>
            {t("older")}
          </Link>
        )}
      </div>
    </main>
  );
}
export async function OwnReportsPage(props: { searchParams: Promise<Query> }) {
  return <OwnedCasesPage {...props} topic="reports" />;
}
export async function OwnAppealsPage(props: { searchParams: Promise<Query> }) {
  return <OwnedCasesPage {...props} topic="appeals" />;
}
export async function OwnAppealPage({
  params,
  searchParams,
}: {
  params: Promise<{ appealId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  await connection();
  const { appealId } = await params,
    language = await pageLocale((await searchParams).lang),
    t = await getTranslations({ locale: language, namespace: "trustCases" });
  if (!backendConfigured())
    return (
      <main className={s.root}>
        <p role="status">{t("unavailable")}</p>
      </main>
    );
  const actor = await requirePageIdentity(
    "/messages/appeals/" + appealId + "?lang=" + language,
  );
  const data = await readPrivatePage(() =>
    readOwnAppeal(getDatabase(), actor, appealId),
  );
  return (
    <main className={s.root}>
      <h1>{t("appealDetail")}</h1>
      <OwnNavigation language={language} />
      <p>{t("ownOnly")}</p>
      <section className={s.notice}>
        <h2>{t("originalDecision")}</h2>
        <p>{t(data.appeal.originalState)}</p>
        <p className={o.text}>{data.appeal.originalReason}</p>
        <small>
          {t("reference")}: {data.appeal.actionId}
        </small>
      </section>
      <section className={s.notice}>
        <h2>{t("yourAppeals")}</h2>
        <p className={o.text}>{data.appeal.details}</p>
        <small>
          {t("reference")}: {data.appeal.id}
        </small>
      </section>
      {data.decision ? (
        <CaseDecisionCard decision={data.decision} />
      ) : (
        <p className={s.notice} role="status">
          {t(data.available ? "outcomePending" : "storageUnavailable")}
        </p>
      )}
    </main>
  );
}
