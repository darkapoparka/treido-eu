"use client";
import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
import { readDecisionUpdatesAction } from "./decision-update-actions";
import type {
  DecisionUpdate,
  DecisionUpdates,
} from "./decision-updates.server";
import { inboxHref } from "../messaging/inbox-model";
import s from "./operations.module.css";
import m from "../messaging/messaging.module.css";
export function DecisionUpdatesPanel({
  initial,
  actorSubject,
  shop = false,
  leading,
}: {
  initial: DecisionUpdates;
  actorSubject: string;
  shop?: boolean;
  leading?: (successfullyEmpty: boolean) => ReactNode;
}) {
  const { actorKey, sellerId } = initial,
    t = useTranslations("trustCases"),
    language = useLocale() === "bg" ? "bg" : "en",
    format = useFormatter();
  const load = useCallback(
    () => readDecisionUpdatesAction({ actorKey, sellerId }),
    [actorKey, sellerId],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  function href(item: DecisionUpdate) {
    if (item.kind === "message")
      return inboxHref({ sellerId }, language, item.targetId);
    if (item.kind === "appeal")
      return "/messages/appeals/" + item.targetId + "?lang=" + language;
    if (item.kind === "report" || !sellerId)
      return "/messages/reports/" + item.targetId + "?lang=" + language;
    return (
      "/app/sellers/" +
      sellerId +
      "/listings/" +
      item.targetId +
      "/moderation?lang=" +
      language
    );
  }
  // Keep the authority/refresh owner mounted, while the original buyer empty
  // screen owns a successfully empty feed. Studio's default remains unchanged.
  const successfullyEmpty =
    shop && status === "ready" && data.available && !data.items.length;
  const panel = successfullyEmpty ? null : (
    <section
      className={shop ? "account-panel buyer-decision-updates" : s.card}
      aria-label={t("decisionUpdates")}
    >
      <h2>{t("decisionUpdates")}</h2>
      <p>{t("updatesNote")}</p>
      {status !== "ready" ? (
        <p role="status">
          {t(
            status === "checking"
              ? "checking"
              : status === "denied"
                ? "denied"
                : "unavailable",
          )}
        </p>
      ) : (
        <>
          <p className={s.muted}>{t("latestUpdates")}</p>
          {!data.available && (
            <p role="status" className={s.notice}>
              {t("storageUnavailable")}
            </p>
          )}
          {!data.items.length && <p>{t("empty")}</p>}
          <ol className={s.timeline}>
            {data.items.map((item) => (
              <li key={item.kind + ":" + item.id}>
                <h3>{t(item.outcome)}</h3>
                <p className={s.text}>{item.reason}</p>
                <p className={s.muted}>
                  {format.dateTime(new Date(item.at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <Link className={m.button} href={href(item)}>
                  {t(
                    item.kind === "message"
                      ? "openConversation"
                      : item.kind === "appeal"
                        ? "openAppeal"
                        : sellerId && item.kind === "listing"
                          ? "sellerHistory"
                          : "ownReports",
                  )}
                </Link>
              </li>
            ))}
          </ol>
          <div className={s.actions}>
            <Link
              className={m.button}
              href={"/messages/reports?lang=" + language}
            >
              {t("ownReports")}
            </Link>
            <Link
              className={m.button}
              href={"/messages/appeals?lang=" + language}
            >
              {t("yourAppeals")}
            </Link>
            {sellerId && data.canReadListings && (
              <Link
                className={m.button}
                href={
                  "/app/sellers/" + sellerId + "/moderation?lang=" + language
                }
              >
                {t("sellerHistory")}
              </Link>
            )}
          </div>
        </>
      )}
      {status !== "denied" && (
        <button className={m.button} onClick={() => void refresh(true)}>
          {t("reload")}
        </button>
      )}
    </section>
  );
  // The buyer source-empty body observes this current read in the same render,
  // rather than remembering initial data or waiting for an effect callback.
  return leading ? (
    <>
      {leading(successfullyEmpty)}
      {panel}
    </>
  ) : (
    panel
  );
}
