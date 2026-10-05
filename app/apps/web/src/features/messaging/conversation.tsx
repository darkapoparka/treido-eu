"use client";
import { ReplyComposer } from "./reply-composer";
import { notificationsHref } from "../notifications/model";
import { OfferPanel, OfferMessageCard } from "../offers/panel";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Locale } from "../locale/locale";
import { ReportForm } from "../trust/report-form";
import {
  readConversationAction,
  markReadAction,
  blockContactAction,
} from "./actions";
import {
  inboxHref,
  type ConversationView,
  type InboxScope,
} from "./inbox-model";
import { useInboxRefresh } from "./use-inbox-refresh";
import { ConversationDialog } from "./dialog";
import s from "./messaging.module.css";
import { PrivateAttachmentImage } from "../message-attachments/controls";
export function Conversation({
  initial,
  actorSubject,
  scope,
  language,
  onChanged,
}: {
  initial: ConversationView;
  actorSubject: string;
  scope: InboxScope;
  language: Locale;
  onChanged: () => void;
}) {
  const cases = useTranslations("trustCases");
  const t = useTranslations("messaging"),
    format = useFormatter(),
    sellerId = scope.sellerId,
    threadId = initial.id;
  const [before, setBefore] = useState<number | null>(null);
  const load = useCallback(
    () => readConversationAction({ sellerId, threadId, before }),
    [sellerId, threadId, before],
  );
  const {
    data: view,
    status,
    refresh,
  } = useInboxRefresh(initial, actorSubject, load);
  const [report, setReport] = useState<string | null>(null);
  const [block, setBlock] = useState<{
    blocked: boolean;
    requestId: string;
    expectedRevision: number;
  } | null>(null);
  const [blockPending, startBlock] = useTransition(),
    [blockError, setBlockError] = useState(false),
    [contactChanged, setContactChanged] = useState(false);
  const alive = useRef(true),
    read = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [previousStatus, setPreviousStatus] = useState(status);
  if (previousStatus !== status) {
    setPreviousStatus(status);
    if (status === "denied") {
      setReport(null);
      setBlock(null);
    }
  }
  useEffect(() => {
    const sequence = view.messages.at(-1)?.sequence ?? 0;
    if (
      status !== "ready" ||
      document.visibilityState !== "visible" ||
      !document.hasFocus() ||
      sequence <= Math.max(view.readSequence, read.current)
    )
      return;
    read.current = sequence;
    void markReadAction({ sellerId, threadId, sequence })
      .then((result) => {
        if (!alive.current) return;
        if (result.ok) onChanged();
        else read.current = 0;
      })
      .catch(() => {
        read.current = 0;
      });
  }, [view, status, sellerId, threadId, onChanged]);
  if (status !== "ready")
    return (
      <section className={s.conversation} role="status">
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
        {status === "denied" && (
          <Link
            className={s.button}
            href={
              "/sign-in?returnTo=" +
              encodeURIComponent(inboxHref(scope, language, threadId))
            }
          >
            {t("signIn")}
          </Link>
        )}
      </section>
    );
  return (
    <section className={s.conversation} aria-label={view.title || t("removed")}>
      <div className={s.conversationHeader}>
        <div>
          <Link
            className={s.button + " " + s.mobileBack}
            href={inboxHref(scope, language)}
          >
            {t("backInbox")}
          </Link>
          <Link
            className={s.button}
            href={notificationsHref(sellerId, language)}
          >
            {t("notificationUpdates")}
          </Link>
          <h2>
            {view.title === null ? t("removed") : view.title || t("untitled")}
          </h2>
          <p className={s.muted}>
            {view.side === "buyer" ? view.sellerName : t("buyer")}
          </p>
        </div>
        {view.canBlock && (
          <button
            className={s.button}
            onClick={() => {
              setBlockError(false);
              setBlock({
                blocked: !view.blockedByYou,
                expectedRevision: view.contactRevision,
                requestId: crypto.randomUUID(),
              });
            }}
          >
            {t(view.blockedByYou ? "unblock" : "block")}
          </button>
        )}
      </div>
      {contactChanged && (
        <p className={s.notice} role="status">
          {t("contactConflict")}
        </p>
      )}
      {(view.blockedByYou || view.blockedByOther) && (
        <p className={s.notice} role="status">
          {t(view.blockedByYou ? "blockedByYou" : "blockedByOther")}
        </p>
      )}
      <div className={s.pagination}>
        {view.olderBefore && (
          <button
            className={s.button}
            onClick={() => {
              setBefore(view.olderBefore);
            }}
          >
            {t("older")}
          </button>
        )}
        {before && (
          <button className={s.button} onClick={() => setBefore(null)}>
            {t("latest")}
          </button>
        )}
      </div>
      {!view.messages.length && <p className={s.empty}>{t("noMessages")}</p>}
      <ol className={s.messages} aria-label={t("title")}>
        {view.messages.map((message) => (
          <li className={s.bubble} data-self={message.mine} key={message.id}>
            <header>
              <small className={s.muted}>
                {message.mine ? t("you") : t(message.from)} ·{" "}
                <time dateTime={message.createdAt}>
                  {format.dateTime(new Date(message.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </small>
              {!message.mine && (
                <button
                  type="button"
                  className={s.report}
                  aria-label={t("report")}
                  onClick={() => setReport(message.id)}
                >
                  ···
                </button>
              )}
            </header>
            {message.moderationHidden && (
              <div className={s.notice}>
                <p>{cases("messageHidden")}</p>
                <p>{message.moderationReason}</p>
                {message.offer && <small>{cases("retainedOffer")}</small>}
              </div>
            )}
            {message.offer ? (
              <OfferMessageCard value={message.offer} />
            ) : !message.moderationHidden ? (
              <p>{message.body}</p>
            ) : null}
            {message.attachmentIds?.map((id) => (
              <PrivateAttachmentImage
                key={id}
                id={id}
                scope={{ sellerId, threadId }}
                language={language}
              />
            ))}
            {message.attachments > (message.attachmentIds?.length ?? 0) && (
              <p className={s.muted}>
                {t("attachments", { count: message.attachments })} ·{" "}
                {t("attachmentUnavailable")}
              </p>
            )}
          </li>
        ))}
      </ol>
      <OfferPanel
        threadId={threadId}
        scope={scope}
        actorSubject={actorSubject}
        onChanged={() => {
          void refresh();
          onChanged();
        }}
      />
      <ReplyComposer
        key={actorSubject + ":" + sellerId + ":" + threadId}
        actorSubject={actorSubject}
        sellerId={sellerId}
        threadId={threadId}
        canReply={view.canReply}
        language={language}
        onSent={() => {
          setBefore(null);
          void refresh();
          onChanged();
        }}
      />
      {block && (
        <ConversationDialog
          title={t(block.blocked ? "blockTitle" : "unblockTitle")}
          onClose={() => setBlock(null)}
        >
          <p>{t(block.blocked ? "blockNote" : "unblockNote")}</p>
          {blockError && (
            <p role="alert" className={s.error}>
              {t("contactFailed")}
            </p>
          )}
          <footer>
            <button className={s.button} onClick={() => setBlock(null)}>
              {t("cancel")}
            </button>
            <button
              disabled={blockPending}
              className={s.button + " " + s.primary}
              onClick={() => {
                const command = { ...block, sellerId, threadId };
                startBlock(async () => {
                  try {
                    const result = await blockContactAction(command);
                    if (!alive.current) return;
                    if (result.ok) {
                      setBlock(null);
                      await refresh();
                      onChanged();
                    } else {
                      setBlockError(true);
                      if (result.code === "CONFLICT") {
                        setContactChanged(true);
                        setBlock(null);
                        void refresh(true);
                      }
                    }
                  } catch {
                    if (alive.current) setBlockError(true);
                  }
                });
              }}
            >
              {t(blockPending ? "saving" : "confirm")}
            </button>
          </footer>
        </ConversationDialog>
      )}
      {report && (
        <ConversationDialog
          title={t("reportTitle")}
          onClose={() => setReport(null)}
        >
          <ReportForm
            key={report}
            resourceKind="message"
            resourceId={report}
            onClose={() => setReport(null)}
          />
        </ConversationDialog>
      )}
    </section>
  );
}
