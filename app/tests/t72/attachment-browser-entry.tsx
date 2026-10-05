import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useAuth } from "@clerk/nextjs";
import { useAttachments } from "../../apps/web/src/features/message-attachments/use-attachments";
import { AttachmentPicker } from "../../apps/web/src/features/message-attachments/controls";
function Fixture() {
  const auth = useAuth();
  const [threadId, setThreadId] = useState(
    "00000000-0000-4000-8000-000000000001",
  );
  const scope = { sellerId: null, threadId };
  const controller = useAttachments(scope, auth.userId ?? "signed-out");
  const language =
    new URLSearchParams(window.location.search).get("lang") === "bg"
      ? "bg"
      : "en";
  return (
    <main>
      <AttachmentPicker
        controller={controller}
        scope={scope}
        language={language}
        disabled={!auth.isSignedIn}
      />
      <button
        type="button"
        disabled={!controller.ready || !controller.ids.length}
        onClick={() => {
          document.documentElement.dataset.sent = controller.ids.join(",");
          controller.clear();
        }}
      >
        Send fixture message
      </button>
      <button
        type="button"
        onClick={() => setThreadId("00000000-0000-4000-8000-000000000002")}
      >
        Other conversation
      </button>
      <output data-ready={controller.ready}>{controller.ids.join(",")}</output>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  React.createElement(Fixture),
);
