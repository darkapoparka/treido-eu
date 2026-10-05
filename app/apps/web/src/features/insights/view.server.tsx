import "server-only";
import Link from "next/link";
import {
  DATASETS,
  AGE_BANDS,
  REPORT_REASONS,
  insightParams,
  scopeBase,
  type InsightQuery,
  type InsightReport,
} from "./model";
import {
  insightCopy,
  insightLabel,
  basisLabel,
  type InsightLanguage,
} from "./copy";
import type { InsightContext, InsightView } from "./summary";
import { ExportInsights, RefreshInsights } from "./controls";
import s from "./insights.module.css";

function time(language: InsightLanguage, value: string) {
  return new Intl.DateTimeFormat(language === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
function underlying(context: InsightContext): string | null {
  if (context.scope.kind === "operator")
    return ["reports", "report_backlog"].includes(context.query.dataset)
      ? "/ops"
      : ["appeals", "appeal_backlog"].includes(context.query.dataset)
        ? "/ops/appeals"
        : null;
  const suffix = ["publications", "listing_status", "stock"].includes(
    context.query.dataset,
  )
    ? "listings"
    : ["offers", "conversations"].includes(context.query.dataset)
      ? "inbox"
      : ["inquiries", "inquiry_activity"].includes(context.query.dataset)
        ? "inquiries"
        : "imports";
  return "/app/sellers/" + context.scope.sellerId + "/" + suffix;
}
function Filters({
  context,
  language,
}: {
  context: InsightContext;
  language: InsightLanguage;
}) {
  const { query, availableDatasets } = context,
    definition = DATASETS[query.dataset],
    base = scopeBase(context.scope),
    { ui, titles } = insightCopy(language);
  const today = context.observedAt.slice(0, 10),
    reset = { dataset: query.dataset, lang: language };
  return (
    <section className={s.card}>
      <div className={s.stack}>
        <form
          action={base}
          className={s.filters}
          key={query.dataset + query.from + query.to + language}
        >
          <label>
            {ui.report}
            <select name="dataset" defaultValue={query.dataset}>
              {availableDatasets.map((dataset) => (
                <option key={dataset} value={dataset}>
                  {titles[dataset]}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="from" value={query.from} />
          <input type="hidden" name="to" value={query.to} />
          <input type="hidden" name="lang" value={language} />
          <button className={s.button}>{ui.choose}</button>
        </form>
        <form
          action={base}
          className={s.filters}
          key={insightParams(query, language).toString()}
        >
          <input type="hidden" name="dataset" value={query.dataset} />
          <input type="hidden" name="lang" value={language} />
          <label>
            {ui.from}
            <input
              type="date"
              name="from"
              required
              min="2000-01-01"
              max={today}
              defaultValue={query.from}
            />
          </label>
          <label>
            {ui.to}
            <input
              type="date"
              name="to"
              required
              min="2000-01-01"
              max={today}
              defaultValue={query.to}
            />
          </label>
          <label>
            {ui.search}
            <input
              type="search"
              name="q"
              maxLength={80}
              defaultValue={query.q}
            />
          </label>
          <label>
            {ui.state}
            <select name="status" defaultValue={query.status}>
              {["all", ...definition.statuses].map((key) => (
                <option key={key} value={key}>
                  {insightLabel(language, key)}
                </option>
              ))}
            </select>
          </label>
          {definition.kinds.length > 0 && (
            <label>
              {ui.group}
              <select name="kind" defaultValue={query.kind}>
                {["all", ...definition.kinds].map((key) => (
                  <option key={key} value={key}>
                    {insightLabel(language, key)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {["reports", "report_backlog"].includes(query.dataset) && (
            <label>
              {ui.reason}
              <select name="reason" defaultValue={query.reason}>
                {["all", ...REPORT_REASONS].map((key) => (
                  <option key={key} value={key}>
                    {insightLabel(language, key)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {query.dataset.endsWith("_backlog") && (
            <label>
              {ui.age}
              <select name="age" defaultValue={query.age}>
                {["all", ...AGE_BANDS].map((key) => (
                  <option key={key} value={key}>
                    {insightLabel(language, key)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className={s.button}>{ui.apply}</button>
          <Link
            className={s.button}
            href={base + "?" + new URLSearchParams(reset)}
            prefetch={false}
          >
            {ui.reset}
          </Link>
        </form>
        <p className={s.muted}>{ui.period}</p>
      </div>
    </section>
  );
}
function Breakdown({
  report,
  language,
  field,
  title,
  items,
}: {
  report: InsightReport;
  language: InsightLanguage;
  field: "status" | "kind" | "reason" | "age";
  title: string;
  items: { key: string; count: number }[];
}) {
  if (!items.length) return null;
  const base = scopeBase(report.scope),
    format = new Intl.NumberFormat(language === "bg" ? "bg-BG" : "en-GB");
  return (
    <section className={s.card}>
      <h2>{title}</h2>
      <ul className={s.groups}>
        {items.map((item) => {
          const patch: Partial<InsightQuery> = {
            [field]: item.key,
            page: 1,
            ...(field === "age"
              ? { status: "open" }
              : field === "status" && item.key === "resolved"
                ? { age: "all" }
                : {}),
          };
          return (
            <li key={item.key}>
              <Link
                className={s.groupLink}
                href={base + "?" + insightParams(report.query, language, patch)}
                prefetch={false}
              >
                <span>{insightLabel(language, item.key)}</span>
                <strong>{format.format(item.count)}</strong>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
function Records({
  report,
  language,
}: {
  report: InsightReport;
  language: InsightLanguage;
}) {
  const { ui } = insightCopy(language),
    base = scopeBase(report.scope),
    values = DATASETS[report.query.dataset].values,
    format = new Intl.NumberFormat(language === "bg" ? "bg-BG" : "en-GB");
  if (!report.total) return <p className={s.card}>{ui.empty}</p>;
  return (
    <section className={s.stack}>
      <div
        className={s.scroll}
        role="region"
        aria-label={ui.details}
        tabIndex={0}
      >
        <table className={s.table}>
          <caption>{ui.details}</caption>
          <thead>
            <tr>
              <th scope="col">{ui.reference}</th>
              <th scope="col">{ui.state}</th>
              <th scope="col">{ui.group}</th>
              <th scope="col">
                {report.basis === "snapshot" &&
                !report.query.dataset.endsWith("_backlog")
                  ? ui.snapshotTime
                  : ui.recordTime}
              </th>
              {values.map((key) => (
                <th className={s.numeric} scope="col" key={key}>
                  {insightLabel(language, key)}
                </th>
              ))}
              <th scope="col">{ui.history}</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className={s.label}>{row.label || row.resourceId}</span>
                  <span className={s.reference}>{row.id}</span>
                </td>
                <td>{insightLabel(language, row.status)}</td>
                <td>{row.kind ? insightLabel(language, row.kind) : "—"}</td>
                <td>
                  <time dateTime={row.at}>{time(language, row.at)}</time>
                </td>
                {values.map((key) => (
                  <td className={s.numeric} key={key}>
                    {row.values[key] === null || row.values[key] === undefined
                      ? insightLabel(language, "unknown")
                      : format.format(row.values[key])}
                  </td>
                ))}
                <td>
                  <Link href={row.href + "?lang=" + language} prefetch={false}>
                    {ui.history}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!report.rows.length && <p role="status">{ui.pageEmpty}</p>}
      <nav className={s.actions} aria-label={ui.page}>
        <span>
          {ui.page} {format.format(report.query.page)} {ui.of}{" "}
          {format.format(report.pages)}
        </span>
        {report.query.page > 1 && (
          <>
            <Link
              className={s.button}
              href={
                base + "?" + insightParams(report.query, language, { page: 1 })
              }
              prefetch={false}
            >
              {ui.newest}
            </Link>
            <Link
              className={s.button}
              href={
                base +
                "?" +
                insightParams(report.query, language, {
                  page: report.query.page - 1,
                })
              }
              prefetch={false}
            >
              {ui.previous}
            </Link>
          </>
        )}
        {report.query.page < report.pages && (
          <Link
            className={s.button}
            href={
              base +
              "?" +
              insightParams(report.query, language, {
                page: report.query.page + 1,
              })
            }
            prefetch={false}
          >
            {ui.next}
          </Link>
        )}
      </nav>
    </section>
  );
}
export function InsightScreen({
  view,
  language,
  actorSubject,
  exportsReady,
}: {
  view: InsightView;
  language: InsightLanguage;
  actorSubject: string;
  exportsReady: boolean;
}) {
  const { context, report, problem } = view,
    { ui, titles, definitions } = insightCopy(language),
    base = scopeBase(context.scope),
    history = underlying(context),
    format = new Intl.NumberFormat(language === "bg" ? "bg-BG" : "en-GB");
  const exportParams = insightParams(context.query, language, { page: 1 });
  exportParams.set("actor", context.actorKey);
  const error =
    problem === "INVALID_INPUT"
      ? ui.invalid
      : problem === "SCOPE_TOO_LARGE"
        ? ui.limit
        : problem === "EXPORT_TOO_LARGE"
          ? ui.exportLimit
          : problem === "NOT_AVAILABLE" &&
              context.scope.kind === "operator" &&
              !context.formalStorage
            ? ui.storage
            : ui.failed;
  return (
    <div className={s.root}>
      <div className={s.heading}>
        <div className={s.stack}>
          <h2>{titles[context.query.dataset]}</h2>
          <p>
            {context.sellerName
              ? ui.scope + ": " + context.sellerName
              : ui.operatorScope}
          </p>
          <p className={s.muted}>{ui.availableOnly}</p>
        </div>
        <RefreshInsights language={language} />
      </div>
      <Filters context={context} language={language} />
      <section className={s.card}>
        <div className={s.stack}>
          <h2>{ui.definition}</h2>
          <strong>{basisLabel(language, context.basis)}</strong>
          <p>{definitions[context.query.dataset]}</p>
          <p className={s.muted}>
            {ui.observed}:{" "}
            <time dateTime={context.observedAt}>
              {time(language, context.observedAt)}
            </time>
          </p>
          {history && (
            <Link href={history + "?lang=" + language} prefetch={false}>
              {ui.underlying}
            </Link>
          )}
        </div>
      </section>
      {problem && (
        <p role="alert" className={s.notice}>
          {error}
        </p>
      )}
      {report && (
        <>
          <section className={s.summary} aria-label={ui.records}>
            <div className={s.card}>
              <h3>{ui.records}</h3>
              <strong className={s.number}>
                {format.format(report.total)}
              </strong>
            </div>
            {report.values.map((value) => (
              <div className={s.card} key={value.key}>
                <h3>{insightLabel(language, value.key)}</h3>
                <strong className={s.number}>
                  {value.known > 0 || report.total === 0
                    ? format.format(value.total)
                    : insightLabel(language, "unknown")}
                </strong>
                <p className={s.muted}>
                  {ui.known}: {format.format(value.known)} · {ui.unknownRows}:{" "}
                  {format.format(value.unknown)}
                </p>
              </div>
            ))}
          </section>
          <p className={s.muted}>{ui.exact}</p>
          {context.query.dataset === "stock" && (
            <p className={s.muted}>{ui.stockUnknown}</p>
          )}
          <div className={s.breakdowns}>
            <Breakdown
              report={report}
              language={language}
              field="status"
              title={ui.statusBreakdown}
              items={report.statuses}
            />
            <Breakdown
              report={report}
              language={language}
              field="kind"
              title={ui.groupBreakdown}
              items={report.kinds}
            />
            <Breakdown
              report={report}
              language={language}
              field="reason"
              title={ui.reasonBreakdown}
              items={report.reasons}
            />
            <Breakdown
              report={report}
              language={language}
              field="age"
              title={ui.age}
              items={report.ages}
            />
          </div>
          {report.ages.length > 0 && (
            <p className={s.muted}>{ui.backlogNote}</p>
          )}
          {report.daily.length > 0 && (
            <section className={s.card}>
              <h2>{ui.daily}</h2>
              <p className={s.muted}>{ui.dailyNote}</p>
              <div className={s.days}>
                {report.daily.map((day) => (
                  <Link
                    className={s.groupLink}
                    href={
                      base +
                      "?" +
                      insightParams(context.query, language, {
                        from: day.day,
                        to: day.day,
                        page: 1,
                      })
                    }
                    key={day.day}
                    prefetch={false}
                  >
                    <time dateTime={day.day}>{day.day}</time>
                    <strong>{format.format(day.count)}</strong>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <Records report={report} language={language} />
        </>
      )}
      <section className={s.card}>
        <div className={s.stack}>
          <h2>{ui.export}</h2>
          {exportsReady ? (
            <ExportInsights
              key={actorSubject + base + exportParams.toString()}
              actorSubject={actorSubject}
              language={language}
              enabled={report !== null}
              href={base + "/export?" + exportParams}
            />
          ) : (
            <p role="status">{ui.exportPending}</p>
          )}
          <p className={s.muted}>{ui.exportHint}</p>
          <p className={s.muted}>{ui.exportSafe}</p>
          <p className={s.muted}>{ui.dataNotice}</p>
        </div>
      </section>
      <p className={s.notice}>{ui.noMoney}</p>
    </div>
  );
}
