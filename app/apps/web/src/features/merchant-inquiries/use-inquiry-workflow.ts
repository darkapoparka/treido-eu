"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useContactRecovery } from "../purchase-reviews/contact-recovery";
import { changeInquiryAction, readInquiryWorkflowAction } from "./actions";
import { parseInquiryCommand, type InquiryCommand } from "./model";
import {
  parseWorkflowDraft,
  emptyWorkflowDraft,
  type InquiryWorkflowView,
  type WorkflowDraft,
} from "./workflow-model";

export function useInquiryWorkflow(
  initial: InquiryWorkflowView,
  actorSubject: string,
) {
  const clerk = useClerk(),
    { isLoaded, user } = useUser(),
    router = useRouter();
  const { actorKey, sellerId, reviewId } = initial;
  const recovery = useContactRecovery(
    "inquiry:" + actorKey + ":" + sellerId + ":" + reviewId,
  );
  const [current, setCurrent] = useState(initial);
  const [access, setAccess] = useState<
    "checking" | "ready" | "denied" | "unavailable"
  >("checking");
  const [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<InquiryCommand | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const life = useRef({ mounted: true, busy: false, read: 0 });
  const { draft, invalid } = parseWorkflowDraft(recovery.raw, current);
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
          ? readInquiryWorkflowAction({ actorKey, sellerId, reviewId })
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
        setCurrent(result.data);
        setAccess("ready");
      })
      .catch(() => {
        if (isCurrent()) setAccess("unavailable");
      });
  }, [actorKey, sellerId, reviewId, actorSubject, clerk]);
  // Initial state is already checking. Only user/visibility events mark a
  // subsequent refresh synchronously; mount reads publish state after the I/O.
  const refresh = useCallback(() => {
    setAccess("checking");
    return readCurrent();
  }, [readCurrent]);
  useEffect(() => {
    const scope = life.current;
    scope.mounted = true;
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") {
        scope.read += 1;
        setAccess("checking");
      } else void refresh();
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
  }, [readCurrent, refresh]);
  useEffect(() => {
    if (!storageFailed) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed]);
  function store(next: WorkflowDraft) {
    const persisted = recovery.write(next);
    setStorageFailed(!persisted);
    return persisted;
  }
  function edit(patch: Partial<WorkflowDraft>) {
    if (busy || draft.attempt || !sameActor || access !== "ready" || invalid)
      return;
    store({ ...draft, ...patch, receipt: null });
  }
  function prepare(kind: "status" | "reply") {
    if (
      !current.canManage ||
      busy ||
      draft.attempt ||
      invalid ||
      access !== "ready" ||
      !sameActor
    )
      return;
    try {
      setPreview(
        parseInquiryCommand({
          actorKey,
          sellerId,
          reviewId,
          requestId: crypto.randomUUID(),
          expectedRevision: draft.revision,
          operation:
            kind === "reply"
              ? { kind, body: draft.body }
              : { kind, status: draft.status },
        }),
      );
    } catch {
      store({ ...draft, code: "INVALID_INPUT" });
    }
  }
  async function submit(command: InquiryCommand) {
    if (
      life.current.busy ||
      !sameActor ||
      clerk.user?.id !== actorSubject ||
      access !== "ready" ||
      invalid
    )
      return;
    const next: WorkflowDraft = {
      ...draft,
      attempt: command,
      rejected: false,
      code: null,
      receipt: null,
    };
    // Persist the exact request before sending, not after an ambiguous response.
    if (!store(next)) {
      // No call was made. New unsent input remains editable; an earlier unknown
      // attempt still retains its original immutable command and retry identity.
      recovery.write(draft);
      return;
    }
    life.current.busy = true;
    setBusy(true);
    setPreview(null);
    try {
      const result = await changeInquiryAction(command);
      if (clerk.user?.id !== actorSubject) return;
      if (result.ok) {
        recovery.write({
          ...next,
          attempt: null,
          rejected: false,
          code: null,
          body: command.operation.kind === "reply" ? "" : next.body,
          status: result.data.status,
          revision: result.data.revision,
          receipt: result.data,
        });
      } else
        recovery.write({
          ...next,
          rejected: result.outcome === "rejected",
          code: result.code,
        });
      if (!life.current.mounted) return;
      await refresh();
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
      access !== "ready" ||
      !sameActor ||
      !current.canManage ||
      (draft.attempt && !draft.rejected)
    )
      return;
    store({
      ...emptyWorkflowDraft(current),
      ...(keep ? { body: draft.body, status: draft.status } : {}),
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
    recovered: recovery.raw !== null,
    conflict: draft.revision !== current.revision || draft.rejected,
    locked: busy || !!draft.attempt || !current.canManage || invalid,
    edit,
    prepare,
    submit,
    resolve,
    refresh,
    closePreview: () => {
      if (!life.current.busy) setPreview(null);
    },
  };
}
