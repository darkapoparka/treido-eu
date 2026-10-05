"use client";
import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useContactRecovery } from "../purchase-reviews/contact-recovery";
import { markNotificationsReadAction } from "./actions";
import {
  NOTIFICATION_LIMIT,
  parseNotificationRead,
  type NotificationScope,
  type NotificationItem,
} from "./model";
import {
  emptyReadDraft,
  mergeReadResults,
  parseReadDraft,
  retryableRead,
  unresolvedRead,
  type ReadDraft,
} from "./recovery";
export function useReadSelection(
  scope: NotificationScope,
  actorSubject: string,
  ready: boolean,
  onChanged: () => void,
) {
  const clerk = useClerk(),
    recovery = useContactRecovery(
      "notifications:" + scope.actorKey + ":" + (scope.sellerId ?? "buyer"),
    );
  const { draft, invalid } = parseReadDraft(recovery.raw, scope);
  const [busy, setBusy] = useState(false),
    [confirming, setConfirming] = useState(false),
    [storageFailed, setStorageFailed] = useState(false);
  const life = useRef({ mounted: true, busy: false });
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!storageFailed && !draft.submitted) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed, draft.submitted]);
  function store(next: ReadDraft) {
    const saved = recovery.write(next);
    setStorageFailed(!saved);
    return saved;
  }
  const enabled = ready && clerk.user?.id === actorSubject && !busy && !invalid;
  function toggle(item: NotificationItem) {
    if (!enabled || draft.submitted) return;
    const exists = draft.entries.some(
      (entry) => entry.row.messageId === item.id,
    );
    if (exists) {
      store({
        ...draft,
        entries: draft.entries.filter(
          (entry) => entry.row.messageId !== item.id,
        ),
      });
      return;
    }
    if (!item.unread || draft.entries.length >= NOTIFICATION_LIMIT) return;
    store({
      ...draft,
      entries: [
        ...draft.entries,
        {
          row: {
            messageId: item.id,
            threadId: item.threadId,
            sequence: item.sequence,
            requestId: crypto.randomUUID(),
          },
          label: (item.sellerName + ": " + (item.title ?? "")).slice(0, 180),
          result: null,
        },
      ],
    });
  }
  async function submit() {
    if (!enabled || life.current.busy) return;
    const rows = draft.entries.filter(retryableRead).map((entry) => entry.row);
    if (!rows.length) return;
    const command = parseNotificationRead({ ...scope, rows });
    const next: ReadDraft = {
      ...draft,
      submitted: true,
      entries: draft.entries.map((entry) =>
        retryableRead(entry)
          ? { ...entry, result: unresolvedRead(entry.row) }
          : entry,
      ),
    };
    if (!store(next)) {
      recovery.write(draft);
      return;
    }
    life.current.busy = true;
    setBusy(true);
    setConfirming(false);
    try {
      const result = await markNotificationsReadAction(command);
      if (!life.current.mounted || clerk.user?.id !== actorSubject) return;
      // A whole-request transport/access failure cannot prove what an earlier
      // attempt did. Keep all original tuples; never erase partial success.
      store(mergeReadResults(next, result.ok ? result.data : []));
      onChanged();
    } catch {
      if (life.current.mounted && clerk.user?.id === actorSubject)
        store(mergeReadResults(next, []));
    } finally {
      life.current.busy = false;
      if (life.current.mounted) setBusy(false);
    }
  }
  function acknowledge() {
    if (!enabled) return;
    const entries = draft.submitted ? draft.entries.filter(retryableRead) : [];
    store(entries.length ? { ...draft, entries } : emptyReadDraft());
  }
  return {
    draft,
    invalid,
    busy,
    storageFailed,
    confirming,
    enabled,
    toggle,
    submit,
    acknowledge,
    confirm: () => {
      if (enabled && draft.entries.length) setConfirming(true);
    },
    close: () => {
      if (!life.current.busy) setConfirming(false);
    },
  };
}
