"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
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
  const auth = useAuth(),
    clerk = useClerk(),
    recovery = useContactRecovery(
      "notifications:" + scope.actorKey + ":" + (scope.sellerId ?? "buyer"),
    );
  const { draft, invalid } = parseReadDraft(recovery.raw, scope);
  const entry =
    typeof location === "undefined" ? "" : location.pathname + location.search;
  const context = [
    actorSubject,
    scope.actorKey,
    scope.sellerId ?? "",
    entry,
    auth.isLoaded ? (auth.sessionId ?? "") : "",
  ].join("\0");
  const sameActor =
    auth.isLoaded &&
    auth.isSignedIn &&
    auth.userId === actorSubject &&
    clerk.user?.id === actorSubject &&
    !!auth.sessionId &&
    clerk.session?.id === auth.sessionId &&
    clerk.session.status === "active";
  const frame = useMemo(
    () => ({
      context,
      ready: ready && sameActor,
      user: clerk.user,
      session: clerk.session,
    }),
    [context, ready, sameActor, clerk.user, clerk.session],
  );
  const [busyState, setBusyState] = useState<{
      owner: typeof frame;
      value: boolean;
    } | null>(null),
    [confirmingState, setConfirmingState] = useState<{
      owner: typeof frame;
      value: boolean;
    } | null>(null),
    [blockedFrame, setBlockedFrame] = useState<typeof frame | null>(null),
    [storageFailed, setStorageFailed] = useState(false);
  const busy = busyState?.owner === frame && busyState.value,
    confirming = confirmingState?.owner === frame && confirmingState.value;
  function setBusy(value: boolean) {
    setBusyState({ owner: frame, value });
  }
  function setConfirming(value: boolean) {
    setConfirmingState({ owner: frame, value });
  }
  const life = useRef({
    mounted: false,
    visible: false,
    qualified: false,
    busy: false,
    generation: 0,
    operation: 0,
    frame: null as typeof frame | null,
  });
  // Commit ownership before a queued old response can run. Inline onChanged
  // callbacks are deliberately excluded: a render is not a new authority.
  useLayoutEffect(() => {
    const current = life.current;
    current.mounted = true;
    current.frame = frame;
    current.visible = document.visibilityState === "visible";
    current.qualified = frame.ready && current.visible;
    ++current.generation;
    ++current.operation;
    current.busy = false;
    const conceal = () => {
      ++current.generation;
      ++current.operation;
      current.qualified = false;
      current.visible = false;
      current.busy = false;
      setBlockedFrame(frame);
      setBusyState({ owner: frame, value: false });
      setConfirmingState({ owner: frame, value: false });
      // The submitted journal remains uncertain with its original tuples.
      // Current read qualification and an explicit action are required to retry.
    };
    const restored = () => {
      conceal();
      current.visible = document.visibilityState === "visible";
    };
    const signature = () =>
      [
        clerk.user?.id ?? "",
        clerk.session?.id ?? "",
        clerk.session?.status ?? "",
      ].join("\0");
    let previous = signature(),
      previousUser = clerk.user,
      previousSession = clerk.session;
    const unsubscribe = clerk.addListener(() => {
      const next = signature();
      if (
        next !== previous ||
        clerk.user !== previousUser ||
        clerk.session !== previousSession
      ) {
        previous = next;
        previousUser = clerk.user;
        previousSession = clerk.session;
        conceal();
      }
    });
    window.addEventListener("blur", conceal);
    window.addEventListener("focus", restored);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", restored);
    return () => {
      current.mounted = false;
      current.qualified = false;
      current.visible = false;
      ++current.generation;
      ++current.operation;
      current.busy = false;
      unsubscribe();
      window.removeEventListener("blur", conceal);
      window.removeEventListener("focus", restored);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", restored);
    };
  }, [frame, clerk]);
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
  function active() {
    const current = life.current;
    return (
      current.mounted &&
      current.visible &&
      current.qualified &&
      current.frame === frame &&
      frame.ready &&
      sameActor &&
      clerk.user === frame.user &&
      clerk.session === frame.session &&
      clerk.user?.id === actorSubject &&
      clerk.session?.id === auth.sessionId &&
      clerk.session.status === "active" &&
      document.visibilityState === "visible" &&
      location.pathname + location.search === entry
    );
  }
  const enabled =
    frame.ready &&
    blockedFrame !== frame &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    !busy &&
    !invalid;
  function toggle(item: NotificationItem) {
    if (!enabled || !active() || draft.submitted) return;
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
    if (!enabled || !active() || life.current.busy) return;
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
    const generation = life.current.generation,
      operation = ++life.current.operation;
    const requestCurrent = () =>
      active() &&
      life.current.generation === generation &&
      life.current.operation === operation;
    const requalify = () => {
      // Even a current transport failure cannot establish what the command did.
      // Keep its tuples and require a fresh read before deliberate retry.
      life.current.qualified = false;
      life.current.busy = false;
      ++life.current.generation;
      ++life.current.operation;
      setBlockedFrame(frame);
      setBusy(false);
      setConfirming(false);
      onChanged();
    };
    setBusy(true);
    setConfirming(false);
    try {
      const result = await markNotificationsReadAction(command);
      if (!requestCurrent()) return;
      // A whole-request transport/access failure cannot prove what an earlier
      // attempt did. Keep all original tuples; never erase partial success.
      store(mergeReadResults(next, result.ok ? result.data : []));
      requalify();
    } catch {
      if (requestCurrent()) {
        store(mergeReadResults(next, []));
        requalify();
      }
    } finally {
      if (requestCurrent()) {
        life.current.busy = false;
        setBusy(false);
      }
    }
  }
  function acknowledge() {
    if (!enabled || !active()) return;
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
      if (enabled && active() && draft.entries.length) setConfirming(true);
    },
    close: () => {
      if (active() && !life.current.busy) setConfirming(false);
    },
  };
}
