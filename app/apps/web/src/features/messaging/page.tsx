import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { getDatabase } from "../../server/db/database";
import { inboxHref, type InboxScope } from "./inbox-model";
import { readInbox, readConversation } from "./inbox.server";
import { InboxWorkspace } from "./inbox";
import s from "./messaging.module.css";
export async function InboxPage({
  scope,
  threadId,
  searchParams,
}: {
  scope: InboxScope;
  threadId?: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams,
    language = await pageLocale(input.lang),
    t = await getTranslations({ locale: language, namespace: "messaging" });
  if (!backendConfigured())
    return (
      <main className={s.root}>
        <header className={s.header}>
          <h1>{t("unavailableTitle")}</h1>
        </header>
        <p>{t("unavailable")}</p>
        <Link className={s.button} href={"/?lang=" + language}>
          {t("browse")}
        </Link>
      </main>
    );
  if (
    Object.keys(input).some(
      (key) => !["lang", "q", "filter", "cursor"].includes(key),
    )
  )
    notFound();
  const actor = await requirePageIdentity(inboxHref(scope, language, threadId));
  const database = getDatabase(),
    query = {
      ...scope,
      q: input.q ?? "",
      filter: input.filter ?? "all",
      cursor: input.cursor ?? null,
    };
  const result = await readPrivatePage(async () => ({
    inbox: await readInbox(database, actor, query),
    conversation: threadId
      ? await readConversation(database, actor, { ...scope, threadId })
      : null,
  }));
  return (
    <InboxWorkspace
      key={
        actor.subject +
        "/" +
        scope.sellerId +
        "/" +
        (threadId ?? "") +
        JSON.stringify(query)
      }
      initialInbox={result.inbox}
      initialConversation={result.conversation}
      actorSubject={actor.subject}
      language={language}
    />
  );
}
