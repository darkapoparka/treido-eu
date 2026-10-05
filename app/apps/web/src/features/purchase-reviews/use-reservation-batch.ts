"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useContactRecovery } from "./contact-recovery";
import {
  cancelReservationBatchAction,
  readCancellationAccessAction,
} from "./bulk-actions";
import { CANCELLATION_BATCH_LIMIT, parseCancellationBatch } from "./bulk-model";
import {
  emptyCancellationDraft,
  parseCancellationDraft,
  retryableCancellation,
  mergeCancellationResults,
  unresolvedCancellation,
  type CancellationDraft,
} from "./bulk-recovery";
import type { ReservationItem, ReservationQueue } from "./reservation-model";
export function useReservationBatch(
  data: ReservationQueue,
  actorSubject: string,
) {
  const clerk = useClerk(),
    { isLoaded, user } = useUser(),
    router = useRouter();
  const { actorKey, sellerId } = data;
  const recovery = useContactRecovery(
    "cancellations:" + actorKey + ":" + (sellerId ?? "buyer"),
  );
  const { draft, invalid } = parseCancellationDraft(
    recovery.raw,
    actorKey,
    sellerId,
  );
  const [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [access, setAccess] = useState<
    "checking" | "ready" | "denied" | "unavailable"
  >("checking");
  const [canManage, setCanManage] = useState(false);
  const [retiredQueue, setRetiredQueue] = useState<ReservationQueue | null>(
    null,
  );
  const life = useRef({ mounted: true, busy: false, read: 0 });
  const sameActor = isLoaded && user?.id === actorSubject;
  const readCurrent = useCallback(() => {
    const ticket = ++life.current.read;
    const isCurrent = () =>
      life.current.mounted &&
      ticket === life.current.read &&
      clerk.user?.id === actorSubject;
    // Both synchronous transport throws and eventual responses are delivered as
    // asynchronous I/O callbacks. Initial mounting never publishes local state.
    return Promise.resolve()
      .then(() =>
        isCurrent()
          ? readCancellationAccessAction({ actorKey, sellerId })
          : null,
      )
      .then((result) => {
        if (!isCurrent() || !result) return;
        if (!result.ok) {
          setAccess(
            ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(result.code)
              ? "denied"
              : "unavailable",
          );
          return;
        }
        setCanManage(result.data.canManage);
        setAccess("ready");
      })
      .catch(() => {
        if (isCurrent()) setAccess("unavailable");
      });
  }, [actorKey, sellerId, actorSubject, clerk]);
  // Initial state is already checking. Only user/visibility events mark a
  // subsequent refresh synchronously; mount reads publish state after the I/O.
  const reloadAccess = useCallback(() => {
    setAccess("checking");
    return readCurrent();
  }, [readCurrent]);
  useEffect(() => {
    const scope = life.current;
    scope.mounted = true;
    const visible = () => {
      if (document.visibilityState === "visible") void reloadAccess();
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") {
        scope.read += 1;
        setAccess("checking");
      } else void reloadAccess();
    };
    void readCurrent();
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    window.addEventListener("pageshow", visible);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      scope.mounted = false;
      scope.read += 1;
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      window.removeEventListener("pageshow", visible);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [readCurrent, reloadAccess]);
  useEffect(() => {
    if (!storageFailed) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed]);
  const needsFreshQueue = retiredQueue === data;
  const canSelect =
    sameActor &&
    access === "ready" &&
    canManage &&
    !busy &&
    !invalid &&
    !draft.submitted &&
    !needsFreshQueue;
  function store(next: CancellationDraft) {
    const persisted = recovery.write(next);
    setStorageFailed(!persisted);
    return persisted;
  }
  function toggle(item: ReservationItem) {
    if (!canSelect || clerk.user?.id !== actorSubject) return;
    const selected = draft.entries.some(
      (entry) => entry.row.allocationId === item.id,
    );
    if (selected) {
      store({
        ...draft,
        entries: draft.entries.filter(
          (entry) => entry.row.allocationId !== item.id,
        ),
      });
      return;
    }
    if (
      !item.canCancel ||
      item.threadId === null ||
      item.offerId === null ||
      item.offerRevision === null ||
      draft.entries.length >= CANCELLATION_BATCH_LIMIT
    )
      return;
    const next: CancellationDraft = {
      ...draft,
      entries: [
        ...draft.entries,
        {
          label: (item.sellerName + ": " + (item.lines[0]?.title ?? "")).slice(
            0,
            180,
          ),
          row: {
            allocationId: item.id,
            threadId: item.threadId,
            offerId: item.offerId,
            expectedRevision: item.offerRevision,
            requestId: crypto.randomUUID(),
          },
          result: null,
        },
      ],
    };
    // The shared validator also rejects duplicate thread/offer/request selections.
    try {
      parseCancellationBatch({
        actorKey,
        sellerId,
        rows: next.entries.map((entry) => entry.row),
      });
    } catch {
      return;
    }
    store(next);
  }
  async function submit() {
    if (
      life.current.busy ||
      !sameActor ||
      clerk.user?.id !== actorSubject ||
      access !== "ready" ||
      !canManage ||
      invalid
    )
      return;
    const rows = draft.entries
      .filter(retryableCancellation)
      .map((entry) => entry.row);
    if (!rows.length) return;
    const command = parseCancellationBatch({ actorKey, sellerId, rows });
    const next: CancellationDraft = {
      ...draft,
      submitted: true,
      entries: draft.entries.map((entry) =>
        retryableCancellation(entry)
          ? {
              ...entry,
              result: unresolvedCancellation(entry.row, "AWAITING_RECEIPT"),
            }
          : entry,
      ),
    };
    if (!store(next)) {
      // No request was sent. Keep a new selection editable, or retain the exact
      // already-submitted attempt when this was an explicit retry.
      recovery.write(draft);
      return;
    }
    life.current.busy = true;
    setBusy(true);
    setPreview(false);
    try {
      const result = await cancelReservationBatchAction(command);
      if (clerk.user?.id !== actorSubject) return;
      // A top-level failure proves nothing about a prior unacknowledged row.
      const merged = result.ok
        ? mergeCancellationResults(next, result.data)
        : {
            ...next,
            entries: next.entries.map((entry) =>
              retryableCancellation(entry)
                ? {
                    ...entry,
                    result: unresolvedCancellation(entry.row, result.code),
                  }
                : entry,
            ),
          };
      recovery.write(merged);
      if (!life.current.mounted) return;
      await reloadAccess();
      router.refresh();
    } catch {
      if (clerk.user?.id === actorSubject)
        recovery.write(mergeCancellationResults(next, []));
    } finally {
      life.current.busy = false;
      if (life.current.mounted) setBusy(false);
    }
  }
  function clearTerminal() {
    if (busy || !sameActor || access !== "ready" || invalid) return;
    const entries = draft.submitted
      ? draft.entries.filter(retryableCancellation)
      : [];
    store(entries.length ? { ...draft, entries } : emptyCancellationDraft());
    if (draft.submitted) {
      setRetiredQueue(data);
      router.refresh();
    }
  }
  return {
    draft,
    invalid,
    busy,
    preview,
    setPreview,
    storageFailed,
    access,
    sameActor,
    canManage,
    canSelect,
    needsFreshQueue,
    toggle,
    submit,
    clearTerminal,
    reloadAccess,
  };
}

export type ReservationBatchController = ReturnType<typeof useReservationBatch>;
