import type { NotificationFeed } from "./model";

/** The source empty body means a successful, unfiltered, complete empty read.
 * A missing projection or pending read recovery must remain visible instead. */
export function buyerNotificationsEmpty(
  feed: NotificationFeed,
  recovery: { entries: number; invalid: boolean; storageFailed: boolean },
): boolean {
  return (
    !feed.items.length &&
    feed.unreadCount === 0 &&
    !feed.nextBefore &&
    (!feed.matches ||
      (feed.matches.available &&
        !feed.matches.items.length &&
        feed.matches.unreadCount === 0 &&
        !feed.matches.nextCursor)) &&
    (!feed.support ||
      (feed.support.available &&
        !feed.support.items.length &&
        feed.support.unreadCount === 0 &&
        !feed.support.hasMore)) &&
    feed.query.filter === "all" &&
    feed.query.kind === "all" &&
    !feed.query.q &&
    !feed.query.before &&
    recovery.entries === 0 &&
    !recovery.invalid &&
    !recovery.storageFailed
  );
}

/** A missing or failed secondary source is not an empty conversation feed. */
export function showConversationEmpty(feed: NotificationFeed): boolean {
  if (feed.items.length || ["search", "support"].includes(feed.query.kind))
    return false;
  if (feed.query.kind !== "all") return true;
  return (
    (!feed.matches || (feed.matches.available && !feed.matches.items.length)) &&
    (!feed.support || (feed.support.available && !feed.support.items.length))
  );
}
