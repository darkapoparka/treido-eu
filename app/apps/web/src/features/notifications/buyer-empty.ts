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
    feed.query.filter === "all" &&
    feed.query.kind === "all" &&
    !feed.query.q &&
    !feed.query.before &&
    recovery.entries === 0 &&
    !recovery.invalid &&
    !recovery.storageFailed
  );
}
