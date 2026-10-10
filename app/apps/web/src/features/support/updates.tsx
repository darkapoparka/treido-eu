"use client";
import Link from "next/link";
import { useFormatter } from "next-intl";
import type { SupportUpdateFeed } from "./updates-model";
import { supportCopy } from "./copy";
import s from "../purchase-reviews/reviews.module.css";

/** The parent owns current account qualification and refresh. No parallel
 * subscription or cached initial projection can resurrect an old account. */
export function SupportUpdatesPanel({
  feed,
  language,
  shop,
  showEmpty,
  onRefresh,
}: {
  feed: SupportUpdateFeed;
  language: "bg" | "en";
  shop: boolean;
  showEmpty: boolean;
  onRefresh: () => void;
}) {
  const t = supportCopy[language];
  const format = useFormatter();
  const base = "/support/requests";
  if (feed.available && !feed.items.length && !showEmpty) return null;
  return (
    <section aria-label={t.updates}>
      <h2>{t.updates}</h2>
      {!feed.available ? (
        <div role="status" className={s.notice}>
          <p>{t.updatesUnavailable}</p>
          <button className={s.secondary} onClick={onRefresh}>
            {t.refresh}
          </button>
        </div>
      ) : (
        <>
          {!feed.items.length && <p>{t.noMatchingUpdates}</p>}
          {!!feed.items.length && (
            <ul
              className={shop ? "account-panel buyer-notification-list" : s.list}
            >
              {feed.items.map((item) => (
                <li
                  key={item.ticketId + ":" + item.sequence}
                  className={shop ? "buyer-notification-row" : s.card}
                  data-support-update={item.ticketId}
                >
                  <div className={s.row}>
                    <h3>{item.title}</h3>
                    <span className={s.badge}>
                      {item.unread ? t.unread : t.read}
                    </span>
                  </div>
                  <p>
                    {t[item.state]} ·{" "}
                    <time dateTime={item.at}>
                      {format.dateTime(new Date(item.at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </p>
                  <Link
                    className={s.secondary}
                    href={base + "/" + item.ticketId + "?lang=" + language}
                  >
                    {t.openRequest}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className={s.secondary} href={base + "?lang=" + language}>
            {feed.hasMore ? t.moreUpdates : t.back}
          </Link>
        </>
      )}
    </section>
  );
}
