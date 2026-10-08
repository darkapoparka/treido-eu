import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DecisionUpdates } from "../trust/decision-updates.server";
import type { NotificationFeed } from "./model";
const current = vi.hoisted(() => ({
  status: "ready",
  data: null as DecisionUpdates | null,
}));
vi.mock("server-only", () => ({}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => "date" }),
}));
vi.mock("../messaging/use-inbox-refresh", () => ({
  useInboxRefresh: (initial: DecisionUpdates) => ({
    data: current.data ?? initial,
    status: current.status,
    refresh: () => {},
  }),
}));
vi.mock("../trust/decision-update-actions", () => ({
  readDecisionUpdatesAction: vi.fn(),
}));
vi.mock("./panel", () => ({
  NotificationPanel: ({ shopEmpty }: { shopEmpty: boolean }) =>
    createElement(
      "div",
      { "data-source-empty": shopEmpty },
      shopEmpty ? "NothingToSeeYet" : "Current notification controls",
    ),
}));
import { BuyerNotificationPanels } from "./buyer-panels";
import { DecisionUpdatesPanel } from "../trust/decision-updates-panel";
const initial: DecisionUpdates = {
  actorKey: "actor",
  sellerId: null,
  available: true,
  canReadListings: false,
  items: [],
};
const feed: NotificationFeed = {
  actorKey: "actor",
  sellerId: null,
  query: { sellerId: null, filter: "all", kind: "all", q: "", before: null },
  items: [],
  nextBefore: null,
  unreadCount: 0,
};
const render = () =>
  renderToStaticMarkup(
    <BuyerNotificationPanels
      feed={feed}
      decisions={initial}
      subject="current-actor"
    />,
  );
beforeEach(() => {
  current.status = "ready";
  current.data = null;
});
it("source-empty eligibility follows the current decision read, including refresh failures and lost access", () => {
  expect(render()).toContain("NothingToSeeYet");
  current.data = { ...initial, available: false };
  expect(render()).not.toContain("NothingToSeeYet");
  expect(render()).toContain("storageUnavailable");
  current.data = initial;
  for (const status of ["checking", "unavailable", "denied"]) {
    current.status = status;
    expect(render()).not.toContain("NothingToSeeYet");
    expect(render()).toContain(status);
  }
  current.status = "ready";
  expect(render()).toContain("NothingToSeeYet");
});
it("a newly arrived current decision suppresses source-empty despite the initially empty server feed", () => {
  current.data = {
    ...initial,
    items: [
      {
        id: "real-decision",
        targetId: "real-report",
        kind: "report",
        outcome: "dismissed",
        reason: "Actual decision",
        at: "2026-10-06T18:00:00Z",
      },
    ],
  };
  const html = render();
  expect(html).not.toContain("NothingToSeeYet");
  expect(html).toContain("Actual decision");
  expect(html).toContain("Current notification controls");
});
it("the Studio default retains its existing decision body without a buyer notification slot", () => {
  const html = renderToStaticMarkup(
    <DecisionUpdatesPanel initial={initial} actorSubject="current-actor" />,
  );
  expect(html).toContain("decisionUpdates");
  expect(html).toContain("latestUpdates");
  expect(html).not.toContain("data-source-empty");
});
