import "server-only";
import Link from "next/link";
import { OperationsRefresh } from "./operations-feedback";
import { getTranslations, getFormatter } from "next-intl/server";
import type {
  OperationDecision,
  OperationListing,
  AppealItem,
} from "./operations-model";
import w from "../sellers/workspace.module.css";
import s from "./operations.module.css";
export async function OperationsNav({
  language,
  active,
}: {
  language: "bg" | "en";
  active?:
    | "reports"
    | "appeals"
    | "insights"
    | "aftercare"
    | "declarations"
    | "support";
}) {
  const t = await getTranslations({
    locale: language,
    namespace: "trustOperations",
  });
  return (
    <nav className={s.actions} aria-label={t("reports")}>
      <Link
        className={w.button}
        href={"/ops?lang=" + language}
        aria-current={active === "reports" ? "page" : undefined}
      >
        {t("reports")}
      </Link>
      <Link
        className={w.button}
        href={"/ops/declarations?lang=" + language}
        prefetch={false}
        aria-current={active === "declarations" ? "page" : undefined}
      >
        {language === "bg" ? "Декларации" : "Declarations"}
      </Link>
      <Link
        className={w.button}
        href={"/ops/appeals?lang=" + language}
        aria-current={active === "appeals" ? "page" : undefined}
      >
        {t("appeals")}
      </Link>
      <Link
        className={w.button}
        href={"/ops/insights?lang=" + language}
        prefetch={false}
        aria-current={active === "insights" ? "page" : undefined}
      >
        {language === "bg" ? "Анализи" : "Insights"}
      </Link>
      <Link
        className={w.button}
        href={"/ops/order-aftercare?lang=" + language}
        prefetch={false}
        aria-current={active === "aftercare" ? "page" : undefined}
      >
        {language === "bg" ? "Помощ за поръчки" : "Order support"}
      </Link>
      <Link
        className={w.button}
        href={"/ops/support?lang=" + language}
        prefetch={false}
        aria-current={active === "support" ? "page" : undefined}
      >
        {language === "bg" ? "Заявки за помощ" : "Support requests"}
      </Link>
      <Link className={w.button} href={"/?lang=" + language}>
        {t("home")}
      </Link>
      <OperationsRefresh />
    </nav>
  );
}
export async function ListingFacts({
  language,
  listing,
}: {
  language: "bg" | "en";
  listing: OperationListing;
}) {
  const t = await getTranslations({
    locale: language,
    namespace: "trustOperations",
  });
  const publication = ["draft", "published", "withdrawn"].includes(
    listing.publication,
  )
    ? (listing.publication as "draft" | "published" | "withdrawn")
    : "unknown";
  return (
    <section className={s.card}>
      <h2>{listing.title ?? t("missingTitle")}</h2>
      <p>{listing.sellerName}</p>
      <p>{t("listingContext")}</p>
      <dl className={s.facts}>
        <div>
          <dt>{t("state")}</dt>
          <dd>
            {t(listing.state)} · {t("revision", { revision: listing.revision })}
          </dd>
        </div>
        <div>
          <dt>{t("publication")}</dt>
          <dd>{t(publication)}</dd>
        </div>
        <div>
          <dt>{t("reference")}</dt>
          <dd className={s.reference}>{listing.id}</dd>
        </div>
      </dl>
    </section>
  );
}
export async function DecisionHistory({
  language,
  decisions,
}: {
  language: "bg" | "en";
  decisions: OperationDecision[];
}) {
  const t = await getTranslations({
      locale: language,
      namespace: "trustOperations",
    }),
    format = await getFormatter({ locale: language });
  return (
    <section className={s.card}>
      <h2>{t("timeline")}</h2>
      <p className={s.muted}>{t("latest50")}</p>
      {!decisions.length && <p>{t("noTimeline")}</p>}
      <ol className={s.timeline}>
        {decisions.map((item) => (
          <li key={item.id}>
            <strong>
              {t("transition", { from: t(item.from), to: t(item.to) })}
            </strong>
            <p className={s.text}>{item.reason}</p>
            <p className={s.muted}>
              {format.dateTime(new Date(item.at), {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              · {t("revision", { revision: item.revision })} ·{" "}
              {t(item.own ? "yourChange" : "operatorChange")}
            </p>
            {item.reportId ? (
              <Link
                href={"/ops/reports/" + item.reportId + "?lang=" + language}
              >
                {t("openOriginalReport")}
              </Link>
            ) : (
              <small>{t("noReport")}</small>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
export async function AppealCards({
  language,
  items,
}: {
  language: "bg" | "en";
  items: AppealItem[];
}) {
  const t = await getTranslations({
      locale: language,
      namespace: "trustOperations",
    }),
    format = await getFormatter({ locale: language });
  return (
    <ul className={s.list}>
      {items.map((item) => (
        <li key={item.id} className={s.card}>
          <div className={s.row}>
            <h2>{item.title ?? t("missingTitle")}</h2>
            <span className={s.badge}>
              {t(item.resolution)} ·{" "}
              {t(
                item.appealedRevision === item.currentRevision
                  ? "current"
                  : "superseded",
              )}
            </span>
          </div>
          <p className={s.text}>
            {item.details.slice(0, 240)}
            {item.details.length > 240 ? "…" : ""}
          </p>
          <p>
            {t("appealedState", {
              state: t(item.appealedState),
              revision: item.appealedRevision,
            })}
          </p>
          <p className={s.muted}>
            {t("submitted", {
              time: format.dateTime(new Date(item.at), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
          <Link
            className={w.button}
            href={"/ops/appeals/" + item.id + "?lang=" + language}
          >
            {t("openAppeal")}
          </Link>
        </li>
      ))}
    </ul>
  );
}
