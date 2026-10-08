import { expect, it } from "vitest";
import type { NotificationFeed } from "./model";
import { buyerNotificationsEmpty } from "./buyer-empty";
const empty: NotificationFeed = {
  actorKey: "actor",
  sellerId: null,
  query: { sellerId: null, filter: "all", kind: "all", q: "", before: null },
  items: [],
  unreadCount: 0,
  nextBefore: null,
  matches: { available: true, items: [], unreadCount: 0, nextCursor: null },
};
const clear = { entries: 0, invalid: false, storageFailed: false };
it("only renders the original empty body for a successful unfiltered empty projection", () => {
  expect(buyerNotificationsEmpty(empty, clear)).toBe(true);
  expect(
    buyerNotificationsEmpty(
      { ...empty, query: { ...empty.query, filter: "unread" } },
      clear,
    ),
  ).toBe(false);
  expect(buyerNotificationsEmpty({ ...empty, unreadCount: 1 }, clear)).toBe(
    false,
  );
  expect(
    buyerNotificationsEmpty(
      { ...empty, matches: { ...empty.matches!, nextCursor: "actual-cursor" } },
      clear,
    ),
  ).toBe(false);
});
it("an unavailable match projection or unresolved read recovery remains visible and never becomes NothingToSeeYet", () => {
  expect(
    buyerNotificationsEmpty(
      { ...empty, matches: { ...empty.matches!, available: false } },
      clear,
    ),
  ).toBe(false);
  for (const recovery of [
    { ...clear, entries: 1 },
    { ...clear, invalid: true },
    { ...clear, storageFailed: true },
  ])
    expect(buyerNotificationsEmpty(empty, recovery)).toBe(false);
});
