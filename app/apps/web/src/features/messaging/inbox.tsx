"use client";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "../locale/locale";
import { readInboxAction } from "./actions";
import {
  inboxHref,
  type InboxView,
  type ConversationView,
} from "./inbox-model";
import { useInboxRefresh } from "./use-inbox-refresh";
import { Conversation } from "./conversation";
import s from "./messaging.module.css";
export function InboxWorkspace({
  initialInbox,
  initialConversation,
  actorSubject,
  language,
}: {
  initialInbox: InboxView;
  initialConversation: ConversationView | null;
  actorSubject: string;
  language: Locale;
}) {
  const auth = useAuth(),
    clerk = useClerk();
  const sameActor =
    clerk.user?.id === actorSubject &&
    !!clerk.session?.id &&
    clerk.session.status === "active" &&
    (!auth.isLoaded ||
      (auth.isSignedIn &&
        auth.userId === actorSubject &&
        auth.sessionId === clerk.session.id));
  const offers = useTranslations("offers");
  const t = useTranslations("messaging"),
    query = initialInbox.query;
  const load = useCallback(() => readInboxAction(query), [query]);
  const { data, status, refresh } = useInboxRefresh(
    initialInbox,
    actorSubject,
    load,
  );
  const changed = useCallback(() => {
    void refresh();
  }, [refresh]);
  const scope = { sellerId: query.sellerId },
    base = inboxHref(scope, language).split("?")[0];
  const filters = {
    ...(query.q ? { q: query.q } : {}),
    ...(query.filter === "unread" ? { filter: "unread" } : {}),
  };
  return (
    <main className={s.root} data-merchant={query.sellerId ? true : undefined}>
      <header className={s.header}>
        <h1>{t(query.sellerId ? "sellerTitle" : "title")}</h1>
        <div className={s.actions}>
          <Link
            className={s.button}
            href={"/messages/reports?lang=" + language}
          >
            {t("reports")}
          </Link>
          {!query.sellerId && (
            <Link className={s.button} href={"/?lang=" + language}>
              {t("browse")}
            </Link>
          )}
        </div>
      </header>
      <div className={s.frame} data-selected={!!initialConversation}>
        <aside className={s.threads} aria-label={t("title")}>
          {sameActor && status !== "denied" && (
            <form className={s.filters} action={base}>
              <input type="hidden" name="lang" value={language} />
              <input
                type="search"
                aria-label={t("search")}
                placeholder={t("search")}
                name="q"
                maxLength={120}
                defaultValue={query.q}
              />
              <div className={s.actions}>
                <select
                  aria-label={t("all")}
                  name="filter"
                  defaultValue={query.filter}
                >
                  <option value="all">{t("all")}</option>
                  <option value="unread">{t("unread")}</option>
                </select>
                <button className={s.button}>{t("apply")}</button>
              </div>
            </form>
          )}
          {status !== "ready" ? (
            <div className={s.notice} role="status">
              <p>
                {t(
                  status === "checking"
                    ? "checking"
                    : status === "denied"
                      ? "denied"
                      : "unavailable",
                )}
              </p>
              {status === "unavailable" && (
                <button className={s.button} onClick={() => void refresh(true)}>
                  {t("retry")}
                </button>
              )}
            </div>
          ) : (
            <>
              {!data.items.length && (
                <div className={s.empty}>
                  <h2>
                    {t(
                      query.q || query.filter !== "all"
                        ? "emptyFilter"
                        : "empty",
                    )}
                  </h2>
                  <p className={s.muted}>
                    {t(query.sellerId ? "emptySeller" : "emptyBuyer")}
                  </p>
                </div>
              )}
              {data.items.map((item) => (
                <Link
                  className={s.thread}
                  key={item.id}
                  href={inboxHref(scope, language, item.id, filters)}
                  aria-current={
                    item.id === initialConversation?.id ? "page" : undefined
                  }
                  prefetch={false}
                >
                  <strong>
                    {item.title === null
                      ? t("removed")
                      : item.title || t("untitled")}
                    {item.unread > 0 && (
                      <span
                        className={s.unread}
                        aria-label={t("unreadCount", { count: item.unread })}
                      >
                        {item.unread}
                      </span>
                    )}
                  </strong>
                  <p>{query.sellerId ? t("buyer") : item.sellerName}</p>
                  <p className={s.preview}>
                    {item.lastOffer
                      ? offers("update")
                      : item.lastBody || t("previewEmpty")}
                  </p>
                  {item.blocked && (
                    <small className={s.muted}>{t("blocked")}</small>
                  )}
                </Link>
              ))}
              <div className={s.pagination}>
                {query.cursor && (
                  <Link
                    className={s.button}
                    href={inboxHref(scope, language, undefined, filters)}
                  >
                    {t("first")}
                  </Link>
                )}
                {data.nextCursor && (
                  <Link
                    className={s.button}
                    href={inboxHref(scope, language, undefined, {
                      ...filters,
                      cursor: data.nextCursor,
                    })}
                  >
                    {t("next")}
                  </Link>
                )}
              </div>
            </>
          )}
        </aside>
        {initialConversation ? (
          <Conversation
            key={
              actorSubject + "/" + query.sellerId + "/" + initialConversation.id
            }
            initial={initialConversation}
            actorSubject={actorSubject}
            scope={scope}
            language={language}
            onChanged={changed}
          />
        ) : (
          <section className={s.conversation}>
            <p className={s.empty}>{t("choose")}</p>
          </section>
        )}
      </div>
    </main>
  );
}
