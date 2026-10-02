import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { readSellerDecisions } from "@/features/trust/report-views.server";
import { DecisionCard } from "@/features/trust/decision-card";
import s from "@/features/messaging/messaging.module.css";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string; draftId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { sellerId, draftId } = await params,
    language = await pageLocale((await searchParams).lang),
    t = await getTranslations({ locale: language, namespace: "trust" });
  if (!backendConfigured())
    return (
      <main className={s.root}>
        <h1>{t("history")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  const base = "/app/sellers/" + sellerId + "/listings/" + draftId;
  const actor = await requirePageIdentity(
    base + "/moderation?lang=" + language,
  );
  const data = await readPrivatePage(() =>
    readSellerDecisions(getDatabase(), actor, sellerId, draftId),
  );
  return (
    <main className={s.root} data-merchant>
      <header className={s.header}>
        <h1>{t("history")}</h1>
        <Link className={s.button} href={base + "/review?lang=" + language}>
          {t("back")}
        </Link>
      </header>
      {!data.length && <p>{t("noHistory")}</p>}
      {data.map((decision) => (
        <DecisionCard key={decision.id} decision={decision} />
      ))}
    </main>
  );
}
