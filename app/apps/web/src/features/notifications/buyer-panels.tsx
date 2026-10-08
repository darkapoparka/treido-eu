"use client";
import type { NotificationFeed } from "./model";
import type { DecisionUpdates } from "../trust/decision-updates.server";
import { NotificationPanel } from "./panel";
import { DecisionUpdatesPanel } from "../trust/decision-updates-panel";

/** Both existing refresh/identity owners stay mounted. Source-empty eligibility
 * follows the current decision projection in the same React commit. */
export function BuyerNotificationPanels({
  feed,
  decisions,
  subject,
}: {
  feed: NotificationFeed;
  decisions: DecisionUpdates;
  subject: string;
}) {
  return (
    <DecisionUpdatesPanel
      initial={decisions}
      actorSubject={subject}
      shop
      leading={(successfullyEmpty) => (
        <NotificationPanel
          key={feed.actorKey + ":" + JSON.stringify(feed.query)}
          initial={feed}
          actorSubject={subject}
          shop
          shopEmpty={successfullyEmpty}
        />
      )}
    />
  );
}
