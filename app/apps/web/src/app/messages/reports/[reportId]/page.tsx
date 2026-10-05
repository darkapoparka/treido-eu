import { CaseDecisionCard } from "@/features/trust/case-form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { readReportDetail } from "@/features/trust/report-views.server";
import { DecisionCard } from "@/features/trust/decision-card";
import s from "@/features/messaging/messaging.module.css";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { reportId } = await params,
    language = await pageLocale((await searchParams).lang),
    t = await getTranslations({ locale: language, namespace: "trust" });
  if (!backendConfigured())
    return (
      <main className={s.root}>
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  const actor = await requirePageIdentity(
    "/messages/reports/" + reportId + "?lang=" + language,
  );
  const data = await readPrivatePage(() =>
    readReportDetail(getDatabase(), actor, reportId),
  );
  return (
    <main className={s.root}>
      <header className={s.header}>
        <h1>{t("report")}</h1>
        <Link className={s.button} href={"/messages/reports?lang=" + language}>
          {t("back")}
        </Link>
      </header>
      <section className={s.notice}>
        <h2>{t(data.report.reason)}</h2>
        <p>{t(data.report.state)}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{data.report.details}</p>
        <small>
          {t("reference")}: {data.report.id}
        </small>
      </section>
      <h2>{t("decisions")}</h2>
      {data.formalDecision && (
        <CaseDecisionCard decision={data.formalDecision} />
      )}
      {!data.decisions.length && !data.formalDecision && (
        <p>{t("noDecisions")}</p>
      )}
      {data.decisions.map((decision) => (
        <DecisionCard key={decision.id} decision={decision} />
      ))}
    </main>
  );
}
