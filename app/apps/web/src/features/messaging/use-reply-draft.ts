"use client";
import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useContactRecovery } from "../purchase-reviews/contact-recovery";
import { sendRecoverableReplyAction } from "./reply-actions";
import {
  emptyReplyDraft,
  parseReplyCommand,
  parseReplyDraft,
  type ReplyCommand,
  type ReplyDraft,
} from "./reply-model";
export function useReplyDraft(
  scope: Pick<ReplyCommand, "actorSubject" | "sellerId" | "threadId">,
  canReply: boolean,
  onSent: () => void,
  attachments: { ids: string[]; ready: boolean } = { ids: [], ready: true },
) {
  const clerk = useClerk(),
    { isLoaded, user } = useUser();
  const recovery = useContactRecovery(
    "reply:" +
      scope.actorSubject +
      ":" +
      (scope.sellerId ?? "buyer") +
      ":" +
      scope.threadId,
  );
  const { draft, invalid } = parseReplyDraft(recovery.raw, scope);
  const [busy, setBusy] = useState(false),
    [storageFailed, setStorageFailed] = useState(false);
  const [acknowledgment, setAcknowledgment] = useState(0);
  const life = useRef({ mounted: true, busy: false });
  const sameActor = isLoaded && user?.id === scope.actorSubject;
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
    };
  }, []);
  function store(next: ReplyDraft) {
    const saved = recovery.write(next);
    setStorageFailed(!saved);
    return saved;
  }
  function edit(body: string) {
    if (!sameActor || busy || invalid || draft.attempt || body.length > 4000)
      return;
    store({ ...draft, body, code: null, receipt: null });
  }
  async function send() {
    if (
      !sameActor ||
      clerk.user?.id !== scope.actorSubject ||
      life.current.busy ||
      invalid ||
      draft.rejected ||
      (!canReply && !draft.attempt) ||
      (!draft.attempt && !attachments.ready)
    )
      return;
    let command: ReplyCommand;
    try {
      command =
        draft.attempt ??
        parseReplyCommand({
          ...scope,
          body: draft.body,
          attachmentIds: attachments.ids,
          requestId: crypto.randomUUID(),
        });
    } catch {
      store({ ...draft, code: "INVALID_INPUT" });
      return;
    }
    const next: ReplyDraft = {
      ...draft,
      attempt: command,
      rejected: false,
      code: null,
      receipt: null,
    };
    // Save the immutable request before transport, including its original body.
    if (!store(next)) {
      recovery.write(draft);
      return;
    }
    life.current.busy = true;
    setBusy(true);
    try {
      const result = await sendRecoverableReplyAction(command);
      if (!life.current.mounted || clerk.user?.id !== scope.actorSubject)
        return;
      if (result.ok) {
        store({ ...emptyReplyDraft(), receipt: result.data });
        setAcknowledgment((value) => value + 1);
        onSent();
      } else
        store({
          ...next,
          rejected: result.outcome === "rejected",
          code: result.code,
        });
    } catch {
      if (life.current.mounted && clerk.user?.id === scope.actorSubject)
        store({ ...next, code: "NOT_AVAILABLE" });
    } finally {
      life.current.busy = false;
      if (life.current.mounted) setBusy(false);
    }
  }
  function editRejected() {
    if (!sameActor || busy || invalid || !draft.rejected) return;
    store({ ...emptyReplyDraft(), body: draft.body });
  }
  return {
    draft,
    invalid,
    busy,
    storageFailed,
    sameActor,
    edit,
    send,
    editRejected,
    acknowledgment,
    recovered: recovery.raw !== null,
    disabled:
      !sameActor ||
      busy ||
      invalid ||
      draft.rejected ||
      (!canReply && !draft.attempt) ||
      (!draft.body.trim() &&
        !attachments.ids.length &&
        !draft.attempt?.attachmentIds?.length) ||
      (!draft.attempt && !attachments.ready),
  };
}
