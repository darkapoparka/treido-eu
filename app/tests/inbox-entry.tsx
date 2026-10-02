// Actual web components under a test-only transport. Not imported by the app.
import React from "react";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { messages } from "../apps/web/src/features/locale/messages";
import { AdminShell } from "../apps/web/src/features/sellers/admin-shell";
import { InboxWorkspace } from "../apps/web/src/features/messaging/inbox";
import { DecisionCard } from "../apps/web/src/features/trust/decision-card";
import type {
  DecisionView,
  ReportSummary,
} from "../apps/web/src/features/trust/report-views.server";
import type {
  InboxView,
  ConversationView,
} from "../apps/web/src/features/messaging/inbox-model";
type Initial = {
  actor: string;
  role: string;
  language: "bg" | "en";
  sellerId: string | null;
  name: string;
  view: "inbox" | "report";
  inbox: InboxView;
  conversation: ConversationView | null;
  report?: ReportSummary & { details: string };
  decisions: DecisionView[];
};
declare global {
  interface Window {
    __inbox: Initial;
    __renderInbox: (value: Initial) => void;
  }
}
const root = createRoot(document.getElementById("root")!);
window.__renderInbox = (initial) => {
  window.__inbox = initial;
  const body =
    initial.view === "inbox" ? (
      <InboxWorkspace
        key={
          initial.actor + initial.sellerId + (initial.conversation?.id ?? "")
        }
        initialInbox={initial.inbox}
        initialConversation={initial.conversation}
        actorSubject={initial.actor}
        language={initial.language}
      />
    ) : (
      <main style={{ padding: 24 }}>
        <h1>{initial.language === "bg" ? "Сигнал" : "Report"}</h1>
        <p>{initial.report?.details}</p>
        <p>{initial.report?.state}</p>
        {initial.decisions.map((decision) => (
          <DecisionCard key={decision.id} decision={decision} />
        ))}
      </main>
    );
  root.render(
    <NextIntlClientProvider
      locale={initial.language}
      messages={messages[initial.language]}
      timeZone="UTC"
    >
      {initial.sellerId ? (
        <AdminShell
          sellers={[
            {
              sellerId: initial.sellerId,
              kind: "business",
              name: initial.name,
              capabilities: [
                "seller.read",
                "listing.read",
                "inbox.read",
                "inbox.reply",
              ],
            },
          ]}
        >
          {body}
        </AdminShell>
      ) : (
        body
      )}
    </NextIntlClientProvider>,
  );
};
window.__renderInbox(window.__inbox);
