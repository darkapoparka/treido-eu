import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { listOwnReports } from "@/features/trust/report-views.server";
import s from "@/features/messaging/messaging.module.css";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; before?: string }>;
}) {
  const input = await searchParams,
    language = await pageLocale(input.lang),
    t = await getTranslations({ locale: language, namespace: "trust" });
  if (!backendConfigured())
    return (
      <main className={s.root}>
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  const actor = await requirePageIdentity("/messages/reports?lang=" + language);
  const data = await readPrivatePage(() =>
    listOwnReports(getDatabase(), actor, input.before ?? null),
  );
  return (
    <main className={s.root}>
      <header className={s.header}>
        <h1>{t("title")}</h1>
        <Link className={s.button} href={"/messages?lang=" + language}>
          {t("back")}
        </Link>
      </header>
      <p>{t("note")}</p>
      {!data.items.length && <p className={s.empty}>{t("empty")}</p>}
      {data.items.map((report) => (
        <Link
          key={report.id}
          className={s.thread}
          href={"/messages/reports/" + report.id + "?lang=" + language}
        >
          <strong>
            {t(report.resourceKind)} · {t(report.reason)}
          </strong>
          <p>{t(report.state)}</p>
          <small>
            {t("reference")}: {report.id}
          </small>
        </Link>
      ))}
      <div className={s.pagination}>
        {input.before && (
          <Link
            className={s.button}
            href={"/messages/reports?lang=" + language}
          >
            {t("latest")}
          </Link>
        )}
        {data.nextCursor && (
          <Link
            className={s.button}
            href={
              "/messages/reports?lang=" +
              language +
              "&before=" +
              data.nextCursor
            }
          >
            {t("next")}
          </Link>
        )}
      </div>
    </main>
  );
}
