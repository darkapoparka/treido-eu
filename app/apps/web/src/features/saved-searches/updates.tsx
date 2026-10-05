"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SourceLink } from "../discovery/return-navigation";
import { CurrentItemActions } from "../shopping-tools/tool-ui";
import { LibraryProvider } from "../library/provider";
import { money } from "../shopping-tools/copy";
import { readSearchUpdatesAction } from "./actions";
import { SavedSearchProvider, useSavedSearches } from "./provider";
import { SearchFeedback, useSearchLocale } from "./controls";
import { savedSearchHref, type MatchFeed, type MatchItem } from "./model";
import { searchCopy } from "./copy";
import s from "../shopping-tools/tools.module.css";
import c from "./searches.module.css";
function MatchCard({
  item,
  reviewActions,
  onRead,
}: {
  item: MatchItem;
  reviewActions: boolean;
  onRead?: () => void;
}) {
  const controller = useSavedSearches(),
    locale = useSearchLocale(),
    t = searchCopy[locale];
  return (
    <li className={c.card}>
      <h3>{item.current?.card.title ?? t.unavailableItem}</h3>
      <p>
        {item.current ? t[item.kind] : t.unavailableItem} ·{" "}
        {item.unread ? t.unread : t.read}
      </p>
      <p>
        <SourceLink
          preserveDiscoveryContext={false}
          href={savedSearchHref(locale, item.searchId)}
        >
          {item.searchName}
        </SourceLink>{" "}
        · {t.version}: {item.version}
        {item.paused && <> · {t.paused}</>}
      </p>
      {item.previousCriteria && <p>{t.previousCriteria}</p>}
      <p className={c.stamp}>
        <time dateTime={item.at}>
          {new Date(item.at).toLocaleString(locale, {
            timeZone: "Europe/Sofia",
          })}
        </time>
      </p>
      {item.current && (
        <>
          {item.kind === "price_changed" && item.previous && item.observed && (
            <>
              <p>
                {t.priorPrice}: {money(item.previous.priceMinor, locale)}
              </p>
              <p>
                {t.observedPrice}: {money(item.observed.priceMinor, locale)}
              </p>
              <p className={s.note}>{t.variantNote}</p>
            </>
          )}
          {item.kind === "stock_changed" && item.previous && item.observed && (
            <p>
              {t.priorStock}: {t[`stock_${item.previous.stock}`]} ·{" "}
              {t.observedStock}: {t[`stock_${item.observed.stock}`]}
            </p>
          )}
          <p className={c.price}>
            {t.current}: {money(item.current.card.price.amount, locale)}
          </p>
          <p className={s.note}>{t.currentNote}</p>
          <nav className={s.nav}>
            <SourceLink
              preserveDiscoveryContext={false}
              href={"/products/" + item.listingId + "?lang=" + locale}
            >
              {t.openProduct}
            </SourceLink>
            <SourceLink
              preserveDiscoveryContext={false}
              href={
                "/stores/" + item.current.card.seller.id + "?lang=" + locale
              }
            >
              {item.current.card.seller.name}
            </SourceLink>
          </nav>
          {reviewActions && <CurrentItemActions listingId={item.listingId} />}
        </>
      )}
      {item.unread && (
        <button
          className={s.button}
          disabled={
            controller.status !== "ready" ||
            controller.busy ||
            controller.pending
          }
          onClick={async () => {
            await controller.execute({
              kind: "read",
              notificationIds: [item.id],
            });
            onRead?.();
          }}
        >
          {t.markRead}
        </button>
      )}
    </li>
  );
}
function Matches({
  feed,
  reviewActions,
  onRead,
}: {
  feed: MatchFeed;
  reviewActions: boolean;
  onRead?: () => void;
}) {
  const locale = useSearchLocale(),
    t = searchCopy[locale];
  return (
    <LibraryProvider
      query={{
        listingIds: [
          ...new Set(
            feed.items
              .filter((item) => item.current)
              .map((item) => item.listingId),
          ),
        ],
        sellerIds: [
          ...new Set(
            feed.items.flatMap((item) =>
              item.current ? [item.current.card.seller.id] : [],
            ),
          ),
        ],
      }}
    >
      <p className={s.note}>{t.updatesNote}</p>
      <p>
        {t.unread}: {feed.unreadCount}
      </p>
      {!feed.available ? (
        <p role="alert">{t.storageUnavailable}</p>
      ) : (
        <>
          {!feed.items.length && <p role="status">{t.updatesEmpty}</p>}
          <ol className={c.list}>
            {feed.items.map((item) => (
              <MatchCard
                key={item.id}
                item={item}
                reviewActions={reviewActions}
                onRead={onRead}
              />
            ))}
          </ol>
        </>
      )}
    </LibraryProvider>
  );
}
/** Additive subsection of the existing buyer notification feed. T49 message and
 * offer read controls keep their own immutable selections and thread cursors. */
export function SearchMatchFeedPanel({
  initial,
  actorSubject,
  onRead,
}: {
  initial: MatchFeed;
  actorSubject: string;
  onRead: () => void;
}) {
  return (
    <SavedSearchProvider>
      <EmbeddedMatches
        initial={initial}
        actorSubject={actorSubject}
        onRead={onRead}
      />
    </SavedSearchProvider>
  );
}
function EmbeddedMatches({
  initial,
  actorSubject,
  onRead,
}: {
  initial: MatchFeed;
  actorSubject: string;
  onRead: () => void;
}) {
  const controller = useSavedSearches(),
    locale = useSearchLocale(),
    t = searchCopy[locale];
  if (controller.subject !== actorSubject || controller.status !== "ready")
    return (
      <section className={c.card}>
        <h2>{t.updates}</h2>
        <SearchFeedback returnTo={"/notifications?lang=" + locale} />
      </section>
    );
  return (
    <section>
      <h2>{t.updates}</h2>
      <Matches feed={initial} reviewActions={false} onRead={onRead} />
      <SearchFeedback returnTo={"/notifications?lang=" + locale} />
      <SourceLink
        preserveDiscoveryContext={false}
        href={savedSearchHref(locale)}
      >
        {t.manage}
      </SourceLink>
    </section>
  );
}
export function SearchUpdates() {
  const controller = useSavedSearches(),
    locale = useSearchLocale(),
    t = searchCopy[locale],
    params = useSearchParams();
  const cursor = params.get("updates"),
    filter = params.get("filter") === "unread" ? "unread" : "all",
    q = params.get("q") ?? "";
  const actorKey = controller.view?.actorKey,
    revision = controller.view?.revision,
    subject = controller.subject;
  const [feed, setFeed] = useState<MatchFeed | null>(null),
    [state, setState] = useState<"checking" | "ready" | "unavailable">(
      "checking",
    ),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (!active || !actorKey || !subject || controller.status !== "ready")
        return;
      setFeed(null);
      setState("checking");
      try {
        const result = await readSearchUpdatesAction(
          { cursor, filter, q },
          actorKey,
        );
        if (!active) return;
        if (result.ok && result.data.subject === subject) {
          setFeed(result.data.feed);
          setState("ready");
        } else setState("unavailable");
      } catch {
        if (active) setState("unavailable");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    actorKey,
    revision,
    subject,
    controller.status,
    cursor,
    filter,
    q,
    reload,
  ]);
  const href = (next: string | null, nextFilter = filter) => {
    const p = new URLSearchParams({ lang: locale, filter: nextFilter });
    if (q) p.set("q", q);
    if (next) p.set("updates", next);
    return "/minis/saved-searches?" + p;
  };
  return (
    <section>
      <h2>{t.updates}</h2>
      <nav className={s.nav}>
        <SourceLink preserveDiscoveryContext={false} href={href(null, "all")}>
          {t.allUpdates}
        </SourceLink>
        <SourceLink
          preserveDiscoveryContext={false}
          href={href(null, "unread")}
        >
          {t.unreadUpdates}
        </SourceLink>
        <button className={s.button} onClick={() => setReload((v) => v + 1)}>
          {t.retry}
        </button>
      </nav>
      {state === "checking" && <p role="status">{t.checking}</p>}
      {state === "unavailable" && <p role="alert">{t.storageUnavailable}</p>}
      {controller.status === "ready" && feed && (
        <Matches
          feed={feed}
          reviewActions
          onRead={() => setReload((v) => v + 1)}
        />
      )}
      {feed?.nextCursor && (
        <SourceLink
          preserveDiscoveryContext={false}
          href={href(feed.nextCursor)}
        >
          {t.older}
        </SourceLink>
      )}
      {cursor && (
        <SourceLink preserveDiscoveryContext={false} href={href(null)}>
          {t.latest}
        </SourceLink>
      )}
    </section>
  );
}
