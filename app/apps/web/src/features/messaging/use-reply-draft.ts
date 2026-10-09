"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
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
    auth = useAuth({ treatPendingAsSignedOut: true });
  const sessionId = auth.isLoaded && auth.isSignedIn ? auth.sessionId : null;
  const context = JSON.stringify([
    scope.actorSubject,
    scope.sellerId,
    scope.threadId,
    sessionId,
  ]);
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
  const life = useRef({ mounted: true, busy: false, generation: 0, context });
  const sameActor =
    auth.isLoaded &&
    auth.isSignedIn &&
    auth.userId === scope.actorSubject &&
    !!sessionId &&
    clerk.user?.id === scope.actorSubject &&
    clerk.session?.id === sessionId &&
    clerk.session?.status === "active";
  useLayoutEffect(() => {
    const current = life.current;
    if (current.context !== context) {
      current.context = context;
      ++current.generation;
      current.busy = false;
      setBusy(false);
    }
  }, [context]);
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    const signature = () =>
      JSON.stringify([
        clerk.user?.id ?? null,
        clerk.session?.id ?? null,
        clerk.session?.status ?? null,
      ]);
    let previous = signature();
    // Observe every transition, including a session round trip batched into
    // one React render. Same-human draft storage keeps its original command.
    const unsubscribe = clerk.addListener(() => {
      const next = signature();
      if (current.mounted && next !== previous) {
        previous = next;
        ++current.generation;
        current.busy = false;
        setBusy(false);
      }
    });
    return () => {
      current.mounted = false;
      ++current.generation;
      unsubscribe();
    };
  }, [clerk]);
  function current() {
    return (
      life.current.mounted &&
      life.current.context === context &&
      sameActor &&
      clerk.user?.id === scope.actorSubject &&
      clerk.session?.id === sessionId &&
      clerk.session?.status === "active"
    );
  }
  function store(next: ReplyDraft) {
    const saved = recovery.write(next);
    setStorageFailed(!saved);
    return saved;
  }
  function edit(body: string) {
    if (!current() || busy || invalid || draft.attempt || body.length > 4000)
      return;
    store({ ...draft, body, code: null, receipt: null });
  }
  async function send() {
    if (
      !current() ||
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
    const generation = life.current.generation;
    const operationCurrent = () =>
      current() && generation === life.current.generation;
    try {
      const result = await sendRecoverableReplyAction(command);
      if (!operationCurrent()) return;
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
      if (operationCurrent()) store({ ...next, code: "NOT_AVAILABLE" });
    } finally {
      if (
        life.current.mounted &&
        life.current.context === context &&
        generation === life.current.generation
      ) {
        life.current.busy = false;
        setBusy(false);
      }
    }
  }
  function editRejected() {
    if (!current() || busy || invalid || !draft.rejected) return;
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
