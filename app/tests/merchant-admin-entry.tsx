// Isolated component review transport. Never imported by the application.
import React from "react";
import { NextIntlClientProvider } from "next-intl";
import { messages } from "../apps/web/src/features/locale/messages";
import { createRoot } from "react-dom/client";
import { AdminShell } from "../apps/web/src/features/sellers/admin-shell";
import { AdminHome } from "../apps/web/src/features/sellers/admin-home";
import { AdminProductList } from "../apps/web/src/features/sellers/admin-products";
import { Workspace } from "../apps/web/src/features/sellers/workspace";
import { DraftEditor } from "../apps/web/src/features/selling/draft-editor";

declare global {
  interface Window {
    __refreshAdmin?: () => Promise<void>;
    __initial: {
      sellers: Parameters<typeof AdminShell>[0]["sellers"];
      seller: Parameters<typeof AdminHome>[0]["seller"];
      data: Parameters<typeof AdminProductList>[0]["data"];
      draft: Parameters<typeof DraftEditor>[0]["initial"];
      actor: string;
      requestId: string;
      view: "home" | "products" | "editor";
      unavailable: boolean;
      language: "bg" | "en";
    };
  }
}
let initial = window.__initial;
const root = createRoot(document.getElementById("root")!);
function render() {
  root.render(
    <NextIntlClientProvider
      locale={initial.language}
      messages={messages[initial.language]}
      timeZone="Europe/Sofia"
    >
      <AdminShell sellers={initial.sellers} unavailable={initial.unavailable}>
        {initial.view === "home" ? (
          <AdminHome
            seller={initial.seller}
            language={initial.language}
            unavailable={initial.unavailable}
          />
        ) : initial.view === "products" ? (
          <AdminProductList
            seller={initial.seller}
            data={initial.data}
            language={initial.language}
            unavailable={initial.unavailable}
          />
        ) : (
          <Workspace
            title={initial.language === "bg" ? "Добави продукт" : "Add product"}
            back={`/app/sellers/${initial.seller!.sellerId}/listings?lang=${initial.language}`}
            language={initial.language}
          >
            <DraftEditor
              admin
              initial={initial.draft}
              sellerId={initial.seller!.sellerId}
              requestId={initial.requestId}
              actorSubject={initial.actor}
              language={initial.language}
              bufferKey={`admin-acceptance:${initial.seller!.sellerId}:${"id" in initial.draft ? initial.draft.id : "new"}`}
            />
          </Workspace>
        )}
      </AdminShell>
    </NextIntlClientProvider>,
  );
}
window.__refreshAdmin = async () => {
  const response = await fetch(location.href, {
    headers: { "x-admin-review-data": "1" },
  });
  if (!response.ok) throw new Error("Admin test refresh failed");
  initial = await response.json();
  window.__initial = initial;
  render();
};
render();
