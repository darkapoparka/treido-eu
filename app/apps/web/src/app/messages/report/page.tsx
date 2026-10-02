import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { readReportTarget } from "@/features/trust/report-views.server";
import { ReportForm } from "@/features/trust/report-form";
import s from "@/features/messaging/messaging.module.css";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; kind?: string; id?: string }>;
}) {
  const input = await searchParams,
    language = await pageLocale(input.lang),
    t = await getTranslations({ locale: language, namespace: "trust" });
  if (!backendConfigured())
    return (
      <main className={s.root}>
        <h1>{t("report")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  const actor = await requirePageIdentity(
    "/messages/report?kind=" +
      input.kind +
      "&id=" +
      input.id +
      "&lang=" +
      language,
  );
  const target = await readPrivatePage(() =>
    readReportTarget(getDatabase(), actor, input.kind, input.id),
  );
  return (
    <main className={s.root}>
      <header className={s.header}>
        <h1>{t("report")}</h1>
      </header>
      <section className={s.notice}>
        <p>{t("note")}</p>
        <ReportForm {...target} />
      </section>
    </main>
  );
}
