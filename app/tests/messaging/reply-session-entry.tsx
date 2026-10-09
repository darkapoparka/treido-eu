import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useReplyDraft } from "../../apps/web/src/features/messaging/use-reply-draft";
function Fixture() {
  const [threadId, setThreadId] = useState(
    "00000000-0000-4000-8000-000000000001",
  );
  const [sent, setSent] = useState(0);
  const [canReply, setCanReply] = useState(true);
  const reply = useReplyDraft(
    { actorSubject: "A", sellerId: null, threadId },
    canReply,
    () => setSent((value) => value + 1),
    { ids: ["00000000-0000-4000-8000-000000000009"], ready: true },
  );
  Object.assign(window, { __reply: reply });
  return (
    <main>
      <textarea
        aria-label="Reply"
        value={reply.sameActor ? reply.draft.body : ""}
        onChange={(e) => reply.edit(e.target.value)}
      />
      <button disabled={reply.disabled} onClick={() => void reply.send()}>
        Send
      </button>
      <button
        onClick={() => setThreadId("00000000-0000-4000-8000-000000000002")}
      >
        Other conversation
      </button>
      <button onClick={() => setCanReply(false)}>Block fixture contact</button>
      <output
        data-sent={sent}
        data-busy={reply.busy}
        data-request={reply.draft.attempt?.requestId ?? ""}
        data-code={reply.draft.code ?? ""}
        data-actor={reply.sameActor}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
