"use client";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useCallback } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
import { inboxHref } from "../messaging/inbox-model";
import { ConversationDialog } from "../messaging/dialog";
import { readNotificationsAction } from "./actions";
import {
  notificationsHref,
  NOTIFICATION_LIMIT,
  type NotificationFeed,
} from "./model";
import { retryableRead } from "./recovery";
import { useReadSelection } from "./use-read-selection";
import s from "../purchase-reviews/reviews.module.css";
import n from "./notifications.module.css";
import { SearchMatchFeedPanel } from "../saved-searches/updates";
import { NotificationsEmpty } from "../discovery/notifications";
import { buyerNotificationsEmpty, showConversationEmpty } from "./buyer-empty";
import { SupportUpdatesPanel } from "../support/updates";
export function NotificationPanel({
  initial,
  actorSubject,
  shop = false,
  shopEmpty = true,
}: {
  initial: NotificationFeed;
  actorSubject: string;
  shop?: boolean;
  shopEmpty?: boolean;
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
  const t = useTranslations("notifications"),
    format = useFormatter(),
    locale = useLocale(),
    language = locale === "bg" ? "bg" : "en";
  const { actorKey, sellerId, query } = initial;
  const load = useCallback(
    () => readNotificationsAction(query, actorKey),
    [query, actorKey],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const selection = useReadSelection(
    { actorKey, sellerId },
    actorSubject,
    status === "ready",
    () => {
      void refresh(true);
    },
  );
  const base = sellerId
    ? "/app/sellers/" + sellerId + "/notifications"
    : "/notifications";
  const href = (change: Parameters<typeof notificationsHref>[2]) =>
    notificationsHref(sellerId, language, {
      ...query,
      before: null,
      ...change,
    });
  const selected = new Set(
    selection.draft.entries.map((entry) => entry.row.messageId),
  );
  const outstanding = selection.draft.entries.filter(retryableRead).length;
  if (
    shop &&
    shopEmpty &&
    status === "ready" &&
    buyerNotificationsEmpty(data, {
      entries: selection.draft.entries.length,
      invalid: selection.invalid,
      storageFailed: selection.storageFailed,
    })
  )
    return <NotificationsEmpty />;
  const accessStatus =
    status !== "ready" ? (
      <section className={s.card}>
        <p role="status">
          {t(
            status === "checking"
              ? "checking"
              : status === "denied"
                ? "denied"
                : "unavailable",
          )}
        </p>
        <button className={s.secondary} onClick={() => void refresh(true)}>
          {t("reload")}
        </button>
        {status === "denied" && (
          <Link
            className={s.secondary}
            href={
              "/sign-in?returnTo=" +
              encodeURIComponent(notificationsHref(sellerId, language))
            }
          >
            {t("signIn")}
          </Link>
        )}
      </section>
    ) : null;
  return (
    <div
      className={shop ? "buyer-notification-feed" : s.stack}
      data-notification-feed={status === "ready" ? true : undefined}
    >
      {accessStatus}
      <p className={s.muted}>{t("inAppOnly")}</p>
      {sameActor && status !== "denied" && (
        <>
          <nav className={s.actions} aria-label={t("filter")}>
            <Link
              className={s.secondary}
              href={href({ filter: "all" })}
              aria-current={query.filter === "all" ? "page" : undefined}
            >
              {t("all")}
            </Link>
            <Link
              className={s.secondary}
              href={href({ filter: "unread" })}
              aria-current={query.filter === "unread" ? "page" : undefined}
            >
              {t("unread")}
            </Link>
            {status === "ready" &&
              (!data.matches || data.matches.available) &&
              (!data.support || data.support.available) && (
                <span className={s.badge}>
                  {t("unreadCount", { count: data.unreadCount })}
                </span>
              )}
            <button
              className={s.secondary}
              disabled={selection.busy}
              onClick={() => void refresh(true)}
            >
              {t("reload")}
            </button>
            <Link
              className={s.secondary}
              href={inboxHref({ sellerId }, language)}
            >
              {t("inbox")}
            </Link>
          </nav>
          <form action={base} className={s.actions}>
            <input
              type="search"
              name="q"
              maxLength={80}
              defaultValue={query.q}
              aria-label={t("search")}
              placeholder={t("search")}
            />
            <label className={s.field}>
              {t("kind")}
              <select name="kind" defaultValue={query.kind}>
                <option value="all">{t("allKinds")}</option>
                <option value="message">{t("message")}</option>
                <option value="offer">{t("offer")}</option>
                {!sellerId && (
                  <>
                    <option value="search">{t("savedSearch")}</option>
                    <option value="support">{t("support")}</option>
                  </>
                )}
              </select>
            </label>
            <input type="hidden" name="lang" value={language} />
            <input type="hidden" name="filter" value={query.filter} />
            <button className={s.secondary}>{t("searchSubmit")}</button>
          </form>
        </>
      )}
      {status === "ready" && (
        <>
          {!sellerId && data.matches && (
            <SearchMatchFeedPanel
              initial={data.matches}
              actorSubject={actorSubject}
              onRead={() => void refresh(true)}
            />
          )}
          {!sellerId && data.support && (
            <SupportUpdatesPanel
              feed={data.support}
              language={language}
              shop={shop}
              showEmpty={query.kind === "support"}
              onRefresh={() => void refresh(true)}
            />
          )}
          {selection.invalid && (
            <p className={s.notice} role="alert">
              {t("invalidRecovery")}
            </p>
          )}
          {selection.storageFailed && (
            <p className={s.notice} role="alert">
              {t("storageFailed")}
            </p>
          )}
          {!!selection.draft.entries.length && (
            <section className={s.card}>
              <h2>
                {t("selection", { count: selection.draft.entries.length })}
              </h2>
              <p>{t("readNote")}</p>
              <ol className={s.lines}>
                {selection.draft.entries.map((entry) => (
                  <li key={entry.row.requestId}>
                    <strong>{entry.label || t("conversation")}</strong>
                    <p className={s.muted}>
                      {t("through", { sequence: entry.row.sequence })}
                    </p>
                    {entry.result && (
                      <p role="status">
                        {t(
                          entry.result.state === "read"
                            ? "acknowledged"
                            : entry.result.state,
                        )}
                      </p>
                    )}
                    {entry.result?.state === "read" && (
                      <small>
                        {t("through", {
                          sequence: entry.result.acknowledgedThrough,
                        })}
                      </small>
                    )}
                  </li>
                ))}
              </ol>
              <div className={s.actions}>
                <button
                  className={s.secondary}
                  disabled={!selection.enabled}
                  onClick={selection.acknowledge}
                >
                  {t(
                    selection.draft.submitted
                      ? "acknowledge"
                      : "clearSelection",
                  )}
                </button>
                {outstanding > 0 && (
                  <button
                    className={s.primary}
                    disabled={!selection.enabled}
                    onClick={selection.confirm}
                  >
                    {t(
                      selection.busy
                        ? "saving"
                        : selection.draft.submitted
                          ? "retry"
                          : "markSelected",
                    )}
                  </button>
                )}
              </div>
            </section>
          )}
          {showConversationEmpty(data) && (
            <section className={n.empty}>
              <h2>{t("empty")}</h2>
              <p>{t("emptyNote")}</p>
              <Link
                className={s.secondary}
                href={href({ filter: "all", kind: "all", q: "" })}
              >
                {t("reset")}
              </Link>
            </section>
          )}
          {!!data.items.length && (
            <ol
              className={
                shop ? "account-panel buyer-notification-list" : s.list
              }
            >
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className={shop ? "buyer-notification-row" : s.card}
                  data-notification-id={item.id}
                >
                  <div className={s.row}>
                    <div>
                      <h2>
                        {item.title === null
                          ? t("restrictedItem")
                          : item.title || t("untitled")}
                      </h2>
                      <p className={s.muted}>{item.sellerName}</p>
                    </div>
                    <span className={s.badge}>
                      {t(item.unread ? "unread" : "read")}
                    </span>
                  </div>
                  <p>
                    <strong>{t(item.offerKind ? "offer" : "message")}</strong> ·{" "}
                    <time dateTime={item.at}>
                      {format.dateTime(new Date(item.at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </p>
                  {!!item.body && <p className={n.excerpt}>{item.body}</p>}
                  <div className={s.actions}>
                    <Link
                      className={s.secondary}
                      href={inboxHref({ sellerId }, language, item.threadId)}
                    >
                      {t("openConversation")}
                    </Link>
                    <label className={n.select}>
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        disabled={
                          !selection.enabled ||
                          selection.draft.submitted ||
                          (!selected.has(item.id) &&
                            (!item.unread ||
                              selected.size >= NOTIFICATION_LIMIT))
                        }
                        onChange={() => selection.toggle(item)}
                      />
                      <span>{t("selectRead")}</span>
                    </label>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {data.nextBefore && (
            <Link
              className={s.secondary}
              href={href({ before: data.nextBefore })}
            >
              {t("older")}
            </Link>
          )}
          {query.before && (
            <Link className={s.secondary} href={href({})}>
              {t("latest")}
            </Link>
          )}
          {selection.confirming && (
            <ConversationDialog
              title={t("markSelected")}
              onClose={selection.close}
            >
              <p>{t("confirmRead", { count: outstanding })}</p>
              <p>{t("readNote")}</p>
              <div className={s.actions}>
                <button
                  className={s.secondary}
                  disabled={selection.busy}
                  onClick={selection.close}
                >
                  {t("cancel")}
                </button>
                <button
                  className={s.primary}
                  disabled={!selection.enabled}
                  onClick={() => void selection.submit()}
                >
                  {t("confirm")}
                </button>
              </div>
            </ConversationDialog>
          )}
        </>
      )}
    </div>
  );
}
