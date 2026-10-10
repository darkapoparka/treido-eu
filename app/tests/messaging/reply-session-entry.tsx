import React, { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { useReplyDraft } from "../../apps/web/src/features/messaging/use-reply-draft";
import { Conversation } from "../../apps/web/src/features/messaging/conversation";
import type { ConversationView } from "../../apps/web/src/features/messaging/inbox-model";
const conversation: ConversationView = {
  id: "00000000-0000-4000-8000-000000000001",
  listingId: "00000000-0000-4000-8000-000000000003",
  sellerId: "00000000-0000-4000-8000-000000000004",
  title: "Synthetic conversation",
  sellerName: "Synthetic seller",
  side: "buyer",
  canReply: true,
  canBlock: true,
  blockedByYou: false,
  blockedByOther: false,
  contactRevision: 1,
  lastSequence: 1,
  readSequence: 0,
  olderBefore: null,
  messages: [
    {
      id: "00000000-0000-4000-8000-000000000005",
      sequence: 1,
      body: "Synthetic reply",
      from: "seller",
      mine: false,
      createdAt: "2026-10-10T00:00:00Z",
      attachments: 0,
    },
  ],
};
function ConversationFixture() {
  const [changed, setChanged] = useState(0);
  const [view, setView] = useState(conversation);
  const [shown, setShown] = useState(true);
  Object.assign(window, {
    __conversation: view,
    __unmountConversation: () => flushSync(() => setShown(false)),
    __replaceConversation: () =>
      flushSync(() =>
        setView((previous) => ({
          ...previous,
          id: "00000000-0000-4000-8000-000000000002",
        })),
      ),
  });
  return (
    <main>
      {shown && (
        <Conversation
          initial={view}
          actorSubject="A"
          scope={{ sellerId: null }}
          language="en"
          onChanged={() => setChanged((value) => value + 1)}
        />
      )}
      <output data-changed={changed} />
    </main>
  );
}
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
createRoot(document.getElementById("root")!).render(
  location.search === "?conversation" ? <ConversationFixture /> : <Fixture />,
);
