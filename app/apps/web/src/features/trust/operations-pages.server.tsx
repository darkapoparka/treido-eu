import { CaseDecisionForm } from "./case-form";
import { ReportEvidenceImages } from "./image-evidence";
import { readReportImageEvidence } from "./image-evidence.server";
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
import { Workspace } from "../sellers/workspace";
import { getDatabase } from "../../server/db/database";
import {
  readReportQueue,
  readOperationReport,
} from "./operations-reports.server";
import {
  readAppealQueue,
  readListingOperation,
  readOperationAppeal,
} from "./operations-appeals.server";
import { REPORT_REASONS, parseReportQuery } from "./operations-model";
import { OperatorDecisionForm } from "./operator-form";
import {
  OperationsNav,
  ListingFacts,
  DecisionHistory,
  AppealCards,
} from "./operations-ui.server";
import w from "../sellers/workspace.module.css";
import s from "./operations.module.css";
type Query = {
  lang?: string;
  state?: string;
  kind?: string;
  reason?: string;
  q?: string;
  before?: string;
};
type PageProps = { searchParams: Promise<Query> };
function params(language: string, query: Record<string, string | null>) {
  return new URLSearchParams({
    lang: language,
    ...Object.fromEntries(
      Object.entries(query).filter(
        (entry): entry is [string, string] => entry[1] !== null,
      ),
    ),
  });
}
async function Unavailable({ language }: { language: "bg" | "en" }) {
  const t = await getTranslations({
    locale: language,
    namespace: "trustOperations",
  });
  return (
    <Workspace title={t("reports")} language={language} back="/">
      <p role="status">{t("failed")}</p>
    </Workspace>
  );
}
export async function OperatorReportsPage({ searchParams }: PageProps) {
  await connection();
  const raw = await searchParams,
    language = await pageLocale(raw.lang);
  if (!backendConfigured()) return <Unavailable language={language} />;
  const actor = await requirePageIdentity("/ops?lang=" + language);
  const data = await readPrivatePage(() =>
    readReportQueue(getDatabase(), actor, {
      state: raw.state,
      kind: raw.kind,
      reason: raw.reason,
      q: raw.q,
      before: raw.before,
    }),
  );
  const t = await getTranslations({
      locale: language,
      namespace: "trustOperations",
    }),
    format = await getFormatter({ locale: language });
  const query = params(language, data.query);
  return (
    <Workspace title={t("reports")} language={language} back="/">
      <div className={s.stack}>
        <OperationsNav language={language} active="reports" />
        <p>{t("reportsNote")}</p>
        <div className={s.actions}>
          <span className={s.badge}>
            {t("openCount", { count: data.counts.open })}
          </span>
          <span className={s.badge}>
            {t("reviewedCount", { count: data.counts.reviewed })}
          </span>
        </div>
        <form action="/ops" className={s.toolbar}>
          <label>
            {t("search")}
            <input
              type="search"
              name="q"
              maxLength={80}
              defaultValue={data.query.q}
              placeholder={t("searchPlaceholder")}
            />
          </label>
          <label>
            {t("state")}
            <select name="state" defaultValue={data.query.state}>
              {(["open", "resolved", "all"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("kind")}
            <select name="kind" defaultValue={data.query.kind}>
              {(["all", "listing", "message"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("reason")}
            <select name="reason" defaultValue={data.query.reason}>
              {(["all", ...REPORT_REASONS] as const).map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="lang" value={language} />
          <button className={w.button}>{t("search")}</button>
        </form>
        {!data.items.length && <p className={s.card}>{t("emptyReports")}</p>}
        <ul className={s.list}>
          {data.items.map((item) => (
            <li key={item.id} className={s.card}>
              <div className={s.row}>
                <h2>{item.title ?? t("missingTitle")}</h2>
                <span className={s.badge}>{t(item.state)}</span>
              </div>
              <p>
                {t(item.resourceKind)} · {t(item.reason)}
              </p>
              <p className={s.text}>{item.summary}</p>
              <p className={s.muted}>
                {t("submitted", {
                  time: format.dateTime(new Date(item.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </p>
              <Link
                className={w.button}
                href={"/ops/reports/" + item.id + "?" + query}
              >
                {t("openReport")}
              </Link>
            </li>
          ))}
        </ul>
        <div className={s.actions}>
          {data.query.before && (
            <Link
              className={w.button}
              href={"/ops?" + params(language, { ...data.query, before: null })}
            >
              {t("newest")}
            </Link>
          )}
          {data.nextBefore && (
            <Link
              className={w.button}
              href={
                "/ops?" +
                params(language, { ...data.query, before: data.nextBefore })
              }
            >
              {t("older")}
            </Link>
          )}
        </div>
      </div>
    </Workspace>
  );
}
export async function OperatorReportPage({
  params: route,
  searchParams,
}: PageProps & { params: Promise<{ reportId: string }> }) {
  await connection();
  const { reportId } = await route,
    raw = await searchParams,
    language = await pageLocale(raw.lang);
  if (!backendConfigured()) return <Unavailable language={language} />;
  const actor = await requirePageIdentity(
    "/ops/reports/" + reportId + "?lang=" + language,
  );
  const data = await readPrivatePage(() =>
    readOperationReport(getDatabase(), actor, reportId),
  );
  const query = await readPrivatePage(async () =>
    parseReportQuery({
      state: raw.state,
      kind: raw.kind,
      reason: raw.reason,
      q: raw.q,
      before: raw.before,
    }),
  );
  const t = await getTranslations({
      locale: language,
      namespace: "trustOperations",
    }),
    format = await getFormatter({ locale: language });
  return (
    <Workspace title={t("reportDetail")} language={language} back="/ops">
      <div className={s.stack}>
        <OperationsNav language={language} />
        <div className={s.actions}>
          <Link className={w.button} href={"/ops?" + params(language, query)}>
            {t("back")}
          </Link>
          <Link
            className={w.button}
            href={"/ops/listings/" + data.listing.id + "?lang=" + language}
          >
            {t("reviewListing")}
          </Link>
        </div>
        <section className={s.card}>
          <div className={s.row}>
            <h2>{t("reportText")}</h2>
            <span className={s.badge}>{t(data.report.state)}</span>
          </div>
          <p>
            {t(data.report.resourceKind)} · {t(data.report.reason)}
          </p>
          <p className={s.text}>{data.report.details}</p>
          <p>
            {t("submitted", {
              time: format.dateTime(new Date(data.report.createdAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
          <p className={s.reference}>
            {t("reference")}: {data.report.id}
          </p>
        </section>
        {data.reportedMessage && (
          <section className={s.card}>
            <h2>{t("reportedMessage")}</h2>
            <p className={s.text}>{data.reportedMessage.body}</p>
            <p className={s.muted}>
              {t("attachmentCount", {
                count: data.reportedMessage.attachments,
              })}
            </p>
            <p className={s.notice}>{t("messageReportNote")}</p>
            <ReportEvidenceImages
              reportId={reportId}
              language={language}
              images={await readPrivatePage(() =>
                readReportImageEvidence(getDatabase(), actor, reportId),
              )}
            />
          </section>
        )}
        <ListingFacts language={language} listing={data.listing} />
        {data.report.resourceKind === "listing" && (
          <OperatorDecisionForm
            key={actor.subject + reportId}
            actorSubject={actor.subject}
            initial={data.context}
          />
        )}
        {data.caseContext && (
          <CaseDecisionForm
            key={actor.subject + reportId + ":case"}
            initial={data.caseContext}
            actorSubject={actor.subject}
          />
        )}
        <DecisionHistory language={language} decisions={data.decisions} />
      </div>
    </Workspace>
  );
}
export async function OperatorAppealsPage({ searchParams }: PageProps) {
  await connection();
  const raw = await searchParams,
    language = await pageLocale(raw.lang);
  if (!backendConfigured()) return <Unavailable language={language} />;
  const actor = await requirePageIdentity("/ops/appeals?lang=" + language);
  const data = await readPrivatePage(() =>
    readAppealQueue(getDatabase(), actor, {
      state: raw.state,
      q: raw.q,
      before: raw.before,
    }),
  );
  const t = await getTranslations({
    locale: language,
    namespace: "trustOperations",
  });
  return (
    <Workspace title={t("appeals")} language={language} back="/ops">
      <div className={s.stack}>
        <OperationsNav language={language} active="appeals" />
        <p>{t("appealsNote")}</p>
        {!data.available && (
          <p role="status" className={s.notice}>
            {t("caseStorageUnavailable")}
          </p>
        )}
        <form action="/ops/appeals" className={s.toolbar}>
          <label>
            {t("search")}
            <input
              type="search"
              name="q"
              maxLength={80}
              defaultValue={data.query.q}
              placeholder={t("searchPlaceholder")}
            />
          </label>
          <label>
            {t("state")}
            <select name="state" defaultValue={data.query.state}>
              {(
                ["open", "resolved", "all", "current", "superseded"] as const
              ).map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="lang" value={language} />
          <button className={w.button}>{t("search")}</button>
        </form>
        {!data.items.length && <p className={s.card}>{t("emptyAppeals")}</p>}
        <AppealCards language={language} items={data.items} />
        <div className={s.actions}>
          {data.query.before && (
            <Link
              className={w.button}
              href={
                "/ops/appeals?" +
                params(language, { ...data.query, before: null })
              }
            >
              {t("newest")}
            </Link>
          )}
          {data.nextBefore && (
            <Link
              className={w.button}
              href={
                "/ops/appeals?" +
                params(language, { ...data.query, before: data.nextBefore })
              }
            >
              {t("older")}
            </Link>
          )}
        </div>
      </div>
    </Workspace>
  );
}
export async function OperatorListingPage({
  params: route,
  searchParams,
}: PageProps & { params: Promise<{ listingId: string }> }) {
  await connection();
  const { listingId } = await route,
    raw = await searchParams,
    language = await pageLocale(raw.lang);
  if (!backendConfigured()) return <Unavailable language={language} />;
  const actor = await requirePageIdentity(
    "/ops/listings/" + listingId + "?lang=" + language,
  );
  const data = await readPrivatePage(() =>
    readListingOperation(getDatabase(), actor, listingId, raw.before ?? null),
  );
  const t = await getTranslations({
    locale: language,
    namespace: "trustOperations",
  });
  return (
    <Workspace title={t("reviewListing")} language={language} back="/ops">
      <div className={s.stack}>
        <OperationsNav language={language} />
        <ListingFacts language={language} listing={data.listing} />
        <p className={s.notice}>{t("followUpNote")}</p>
        <OperatorDecisionForm
          key={actor.subject + listingId}
          actorSubject={actor.subject}
          initial={data.context}
        />
        <DecisionHistory language={language} decisions={data.decisions} />
        <h2>{t("appeals")}</h2>
        <p className={s.muted}>{t("appealsNote")}</p>
        {!data.appeals.length && <p>{t("emptyAppeals")}</p>}
        <AppealCards language={language} items={data.appeals} />
        {data.nextAppeal && (
          <Link
            className={w.button}
            href={
              "/ops/listings/" +
              listingId +
              "?" +
              params(language, { before: data.nextAppeal })
            }
          >
            {t("older")}
          </Link>
        )}
      </div>
    </Workspace>
  );
}
export async function OperatorAppealPage({
  params: route,
  searchParams,
}: PageProps & { params: Promise<{ appealId: string }> }) {
  await connection();
  const { appealId } = await route,
    raw = await searchParams,
    language = await pageLocale(raw.lang);
  if (!backendConfigured()) return <Unavailable language={language} />;
  const actor = await requirePageIdentity(
    "/ops/appeals/" + appealId + "?lang=" + language,
  );
  const data = await readPrivatePage(() =>
    readOperationAppeal(getDatabase(), actor, appealId),
  );
  const t = await getTranslations({
      locale: language,
      namespace: "trustOperations",
    }),
    format = await getFormatter({ locale: language });
  return (
    <Workspace
      title={t("appealDetail")}
      language={language}
      back="/ops/appeals"
    >
      <div className={s.stack}>
        <OperationsNav language={language} />
        <section className={s.card}>
          <h2>{t("appealText")}</h2>
          <p className={s.text}>{data.appeal.details}</p>
          <p>
            {t("submitted", {
              time: format.dateTime(new Date(data.appeal.at), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
          <p className={s.reference}>
            {t("reference")}: {data.appeal.id}
          </p>
          <p className={s.badge}>{t(data.appeal.resolution)}</p>
        </section>
        <h2>{t("originalDecision")}</h2>
        <DecisionHistory language={language} decisions={[data.original]} />
        <ListingFacts language={language} listing={data.listing} />
        <Link
          className={w.button}
          href={"/ops/listings/" + data.listing.id + "?lang=" + language}
        >
          {t("reviewListing")}
        </Link>
        <CaseDecisionForm
          key={actor.subject + appealId}
          actorSubject={actor.subject}
          initial={data.caseContext}
        />
      </div>
    </Workspace>
  );
}
