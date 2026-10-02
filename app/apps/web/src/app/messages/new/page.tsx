import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { getDatabase } from "@/server/db/database";
import { readPublicListingState } from "@/features/trust/moderation.server";
import { validId } from "@/features/selling/draft-model";
import { StartConversation } from "@/features/messaging/start-conversation";
import s from "@/features/messaging/messaging.module.css";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string; lang?: string }>;
}) {
  const input = await searchParams,
    language = await pageLocale(input.lang),
    t = await getTranslations({ locale: language, namespace: "messaging" });
  if (!backendConfigured())
    return (
      <main className={s.root}>
        <h1>{t("unavailableTitle")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  if (!validId(input.listing)) notFound();
  await requirePageIdentity(
    "/messages/new?listing=" + input.listing + "&lang=" + language,
  );
  await readPrivatePage(() =>
    readPublicListingState(getDatabase(), input.listing!),
  );
  return (
    <main className={s.root}>
      <header className={s.header}>
        <h1>{t("startTitle")}</h1>
      </header>
      <StartConversation listingId={input.listing} />
    </main>
  );
}
