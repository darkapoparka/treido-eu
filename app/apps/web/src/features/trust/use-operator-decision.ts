"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useContactRecovery } from "../purchase-reviews/contact-recovery";
import {
  readModerationContextAction,
  changeModerationOperationAction,
} from "./operations-actions";
import { parseModerationInput } from "./moderation-model";
import type { ModerationContext } from "./operations-model";
import {
  emptyOperatorDraft,
  parseOperatorDraft,
  type OperatorAttempt,
  type OperatorDraft,
} from "./operator-recovery";
export function useOperatorDecision(
  initial: ModerationContext,
  actorSubject: string,
) {
  const clerk = useClerk(),
    { isLoaded, user } = useUser(),
    router = useRouter();
  const { actorKey, listingId, reportId } = initial;
  const recovery = useContactRecovery(
    "moderation:" + actorKey + ":" + listingId + ":" + (reportId ?? "listing"),
  );
  const [current, setCurrent] = useState(initial);
  const [access, setAccess] = useState<
    "checking" | "ready" | "denied" | "unavailable"
  >("checking");
  const [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<OperatorAttempt | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const life = useRef({ mounted: true, busy: false, read: 0 });
  const { draft, invalid } = parseOperatorDraft(recovery.raw, current);
  const sameActor = isLoaded && user?.id === actorSubject;
  const fetchCurrent = useCallback(() => {
    const ticket = ++life.current.read;
    if (clerk.user?.id !== actorSubject) return Promise.resolve();
    // State changes belong to the I/O completion, not the mounting effect.
    return readModerationContextAction({ actorKey, listingId, reportId })
      .then((result) => {
        if (
          !life.current.mounted ||
          ticket !== life.current.read ||
          clerk.user?.id !== actorSubject
        )
          return;
        if (!result.ok) {
          setAccess(
            ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(result.code)
              ? "denied"
              : "unavailable",
          );
          return;
        }
        setCurrent(result.data);
        setAccess("ready");
      })
      .catch(() => {
        if (life.current.mounted && ticket === life.current.read)
          setAccess("unavailable");
      });
  }, [actorKey, listingId, reportId, actorSubject, clerk]);
  useEffect(() => {
    const scope = life.current;
    scope.mounted = true;
    const reload = () => {
      if (document.visibilityState === "visible") {
        setAccess("checking");
        void fetchCurrent();
      }
    };
    const visibility = () => {
      scope.read += 1;
      setAccess("checking");
      if (document.visibilityState === "visible") void fetchCurrent();
    };
    void fetchCurrent();
    window.addEventListener("focus", reload);
    window.addEventListener("online", reload);
    window.addEventListener("pageshow", reload);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      scope.mounted = false;
      scope.read += 1;
      window.removeEventListener("focus", reload);
      window.removeEventListener("online", reload);
      window.removeEventListener("pageshow", reload);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [
    fetchCurrent,
    isLoaded,
    user?.id,
    initial.revision,
    initial.canModerate,
    initial.reportState,
  ]);
  // Restored memory-only input must retain its unload warning after a grant refresh remount.
  useEffect(() => {
    if (!storageFailed && !draft.reason.length && !draft.attempt) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed, draft.reason.length, draft.attempt]);
  function store(next: OperatorDraft) {
    const persisted = recovery.write(next);
    setStorageFailed(!persisted);
    return persisted;
  }
  const conflict = draft.revision !== current.revision || draft.rejected;
  const canPrepare =
    sameActor &&
    access === "ready" &&
    current.canModerate &&
    current.reportState !== "reviewed" &&
    !busy &&
    !draft.attempt &&
    !invalid &&
    !conflict;
  function edit(patch: Partial<Pick<OperatorDraft, "reason" | "state">>) {
    if (
      !sameActor ||
      access !== "ready" ||
      busy ||
      draft.attempt ||
      invalid ||
      !current.canModerate
    )
      return;
    store({ ...draft, ...patch, receipt: null, code: null });
  }
  function prepare() {
    if (!canPrepare) return;
    const input = parseModerationInput({
      listingId,
      reportId,
      requestId: crypto.randomUUID(),
      expectedRevision: draft.revision,
      state: draft.state,
      reason: draft.reason,
    });
    if (!input) {
      store({ ...draft, code: "INVALID_INPUT" });
      return;
    }
    setPreview({ actorKey, input });
  }
  async function submit(attempt: OperatorAttempt) {
    if (
      life.current.busy ||
      !sameActor ||
      clerk.user?.id !== actorSubject ||
      access !== "ready" ||
      !current.canModerate ||
      invalid
    )
      return;
    const next: OperatorDraft = {
      ...draft,
      attempt,
      rejected: false,
      code: null,
      receipt: null,
    };
    if (!store(next)) {
      recovery.write(draft);
      return;
    }
    life.current.busy = true;
    setBusy(true);
    setPreview(null);
    try {
      const result = await changeModerationOperationAction(attempt);
      if (clerk.user?.id !== actorSubject) return;
      if (result.ok)
        recovery.write({
          ...next,
          attempt: null,
          reason: "",
          revision: result.data.revision,
          receipt: result.data,
        });
      else
        recovery.write({
          ...next,
          rejected: result.outcome === "rejected",
          code: result.code,
        });
      if (!life.current.mounted) return;
      setAccess("checking");
      await fetchCurrent();
      router.refresh();
    } catch {
      if (clerk.user?.id === actorSubject)
        recovery.write({ ...next, code: "NOT_AVAILABLE" });
    } finally {
      life.current.busy = false;
      if (life.current.mounted) setBusy(false);
    }
  }
  function resolve(keep: boolean) {
    if (
      busy ||
      !sameActor ||
      access !== "ready" ||
      !current.canModerate ||
      invalid ||
      (draft.attempt && !draft.rejected)
    )
      return;
    store({
      ...emptyOperatorDraft(current),
      ...(keep ? { reason: draft.reason, state: draft.state } : {}),
    });
  }
  return {
    current,
    access,
    sameActor,
    draft,
    invalid,
    busy,
    preview,
    storageFailed,
    conflict,
    canPrepare,
    edit,
    prepare,
    submit,
    resolve,
    reload: () => {
      setAccess("checking");
      void fetchCurrent();
      router.refresh();
    },
    closePreview: () => {
      if (!life.current.busy) setPreview(null);
    },
  };
}
