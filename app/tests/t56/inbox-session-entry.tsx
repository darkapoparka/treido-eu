import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { IntlProvider } from "use-intl";
import { InboxWorkspace } from "../../apps/web/src/features/messaging/inbox";
import { NotificationPanel } from "../../apps/web/src/features/notifications/panel";
import type { InboxView } from "../../apps/web/src/features/messaging/inbox-model";
import type { NotificationFeed } from "../../apps/web/src/features/notifications/model";
import messaging from "../../apps/web/src/features/messaging/messages.json";
import notifications from "../../apps/web/src/features/notifications/messages.json";
import offers from "../../apps/web/src/features/offers/messages.json";
import { useInboxRefresh } from "../../apps/web/src/features/messaging/use-inbox-refresh";
import type { SellerResult } from "../../apps/web/src/features/sellers/errors";

const itemId = "a0000000-0000-4000-8000-000000000001";
const threadId = "a0000000-0000-4000-8000-000000000002";
const messages = {
  messaging: messaging.en,
  notifications: notifications.en,
  offers: offers.en,
};
let inbox: InboxView = {
  query: { sellerId: null, q: "", filter: "all", cursor: null },
  items: [
    {
      id: threadId,
      listingId: itemId,
      title: "SERVER-INITIAL",
      sellerName: "Synthetic seller",
      sellerKind: "personal",
      lastBody: "Synthetic private preview",
      lastAt: "2026-10-09T00:00:00Z",
      unread: 1,
      blocked: false,
    },
  ],
  nextCursor: null,
};
let feed: NotificationFeed = {
  actorKey: "a".repeat(64),
  sellerId: null,
  query: { sellerId: null, q: "", filter: "all", kind: "all", before: null },
  items: [
    {
      id: itemId,
      threadId,
      title: "SERVER-INITIAL",
      sellerName: "Synthetic seller",
      body: "Synthetic private update",
      at: "2026-10-09T00:00:00Z",
      sequence: 1,
      unread: true,
      offerKind: null,
    },
  ],
  nextBefore: null,
  unreadCount: 1,
};
let replayRetainedInLayout = false;
// This small actual-hook consumer retains a callback from an earlier committed
// server frame. It does not replace the real Inbox/Notification interactions.
function RefreshProbe({ frame }: { frame: InboxView }) {
  const initial = useMemo(
    () => ({ marker: frame.items[0]?.title ?? "EMPTY" }),
    [frame],
  );
  const load = useCallback(
    () =>
      (
        window as typeof window & {
          __request: (
            feature: string,
            kind: string,
            args: unknown[],
          ) => Promise<SellerResult<{ marker: string }>>;
        }
      ).__request("probe", "read", [initial]),
    [initial],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    "synthetic-human-A",
    load,
  );
  useEffect(() => {
    Object.assign(window, {
      __captureRefresh: () =>
        Object.assign(window, { __retainedRefresh: () => refresh(true) }),
    });
  }, [refresh]);
  useLayoutEffect(() => {
    if (!replayRetainedInLayout) return;
    replayRetainedInLayout = false;
    void (
      window as typeof window & {
        __retainedRefresh?: () => Promise<void>;
      }
    ).__retainedRefresh?.();
  }, [initial]);
  return (
    <section id="probe">
      <span className="status">{status}</span>
      <span className="private">{status === "ready" ? data.marker : ""}</span>
    </section>
  );
}
function Fixture() {
  return (
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <section id="inbox">
        <InboxWorkspace
          initialInbox={inbox}
          initialConversation={null}
          actorSubject="synthetic-human-A"
          language="en"
        />
      </section>
      <section id="notifications">
        <NotificationPanel initial={feed} actorSubject="synthetic-human-A" />
      </section>
      <RefreshProbe frame={inbox} />
    </IntlProvider>
  );
}
const root = createRoot(document.getElementById("root")!);
const render = () => root.render(<Fixture />);
Object.assign(window, {
  __replaceInitial: (marker: string, runRetainedInLayout = false) => {
    inbox = {
      ...inbox,
      items: inbox.items.map((item) => ({ ...item, title: marker })),
    };
    feed = {
      ...feed,
      items: feed.items.map((item) => ({ ...item, title: marker })),
    };
    replayRetainedInLayout = runRetainedInLayout;
    flushSync(render);
  },
  __replaceNotificationScope: (actorKey: string, sellerId: string | null) => {
    feed = {
      ...feed,
      actorKey,
      sellerId,
      query: { ...feed.query, sellerId },
    };
    flushSync(render);
  },
  __replaceQuery: (q: string) => {
    inbox = { ...inbox, query: { ...inbox.query, q } };
    feed = { ...feed, query: { ...feed.query, q } };
    flushSync(render);
  },
  __unmount: () => root.unmount(),
});
render();
