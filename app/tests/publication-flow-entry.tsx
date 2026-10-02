// Test-only component transport; not imported by the application.
import React from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "../apps/web/src/features/locale/provider";
import { DiscoveryProvider } from "../apps/web/src/features/discovery/state";
import { PublicationReviewPanel } from "../apps/web/src/features/selling/publication-review";
import { PublishedProductDetail } from "../apps/web/src/features/discovery/published-detail";
import { StartConversation } from "../apps/web/src/features/messaging/start-conversation";
import { Conversation } from "../apps/web/src/features/messaging/conversation";
import type { PublicationReview } from "../apps/web/src/features/selling/publication-model";
import type { PublishedListing } from "../apps/web/src/features/catalog/published-model";
import type { ConversationView } from "../apps/web/src/features/messaging/inbox-model";
import workspace from "../apps/web/src/features/sellers/workspace.module.css";
type Initial = {
  view: "review" | "product" | "start" | "thread";
  locale: "bg" | "en";
  actor: string;
  role: "owner" | "buyer";
  listingId: string;
  requestId: string;
  review?: PublicationReview;
  listing?: PublishedListing;
  conversation?: ConversationView;
};
declare global {
  interface Window {
    __publication: Initial;
    __renderPublication: (data: Initial) => void;
  }
}
const root = createRoot(document.getElementById("root")!);
window.__renderPublication = (initial) => {
  window.__publication = initial;
  root.render(
    <LocaleProvider
      initial={{ locale: initial.locale, locationSuggestion: null }}
    >
      <DiscoveryProvider
        initial={{
          viewedProducts: [],
          viewedItems: [],
          cart: [],
          saved: [],
          collections: [],
          followed: [],
        }}
      >
        {initial.view === "product" && initial.listing ? (
          <PublishedProductDetail listing={initial.listing} />
        ) : initial.view === "review" && initial.review ? (
          <main className={workspace.page}>
            <PublicationReviewPanel
              key={initial.review.revision}
              review={initial.review}
              requestId={initial.requestId}
              language={initial.locale}
            />
          </main>
        ) : initial.view === "start" ? (
          <main className={workspace.page}>
            <StartConversation listingId={initial.listingId} />
          </main>
        ) : initial.conversation ? (
          <Conversation
            initial={initial.conversation}
            actorSubject={initial.actor}
            scope={{ sellerId: null }}
            language={initial.locale}
            onChanged={() => {}}
          />
        ) : null}
      </DiscoveryProvider>
    </LocaleProvider>,
  );
};
window.__renderPublication(window.__publication);
