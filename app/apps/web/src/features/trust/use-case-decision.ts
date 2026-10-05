"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useContactRecovery } from "../purchase-reviews/contact-recovery";
import {
  readTrustCaseContextAction,
  decideTrustCaseAction,
} from "./case-actions";
import {
  emptyCaseDraft,
  parseCaseDraft,
  parseCaseCommand,
  parseCaseReceipt,
  type CaseContext,
  type CaseCommand,
  type CaseDraft,
} from "./case-model";

export function useCaseDecision(initial: CaseContext, actorSubject: string) {
  const clerk = useClerk(),
    { isLoaded, user } = useUser(),
    router = useRouter();
  const { actorKey, kind, caseId } = initial;
  const recovery = useContactRecovery(
    "trust-case:" + actorKey + ":" + kind + ":" + caseId,
  );
  const [current, setCurrent] = useState(initial);
  const [access, setAccess] = useState<
    "checking" | "ready" | "denied" | "unavailable"
  >("checking");
  const [busy, setBusy] = useState(false),
    [storageFailed, setStorageFailed] = useState(false);
  const [preview, setPreview] = useState<CaseCommand | null>(null);
  const life = useRef({ mounted: true, busy: false, generation: 0 });
  const { draft, invalid } = parseCaseDraft(recovery.raw, current);
  const sameActor = isLoaded && user?.id === actorSubject;
  const fetchCurrent = useCallback(async () => {
    const generation = ++life.current.generation;
    if (clerk.user?.id !== actorSubject) return;
    try {
      const result = await readTrustCaseContextAction({
        actorKey,
        kind,
        caseId,
      });
      if (
        !life.current.mounted ||
        generation !== life.current.generation ||
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
    } catch {
      if (
        life.current.mounted &&
        generation === life.current.generation &&
        clerk.user?.id === actorSubject
      )
        setAccess("unavailable");
    }
  }, [actorKey, kind, caseId, actorSubject, clerk]);
  useEffect(() => {
    const scope = life.current;
    scope.mounted = true;
    const refresh = () => {
      scope.generation += 1;
      setAccess("checking");
      if (document.visibilityState === "visible") void fetchCurrent();
    };
    const startup = window.setTimeout(() => {
      void fetchCurrent();
    }, 0);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      scope.mounted = false;
      scope.generation += 1;
      window.clearTimeout(startup);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [
    fetchCurrent,
    isLoaded,
    user?.id,
    initial.revision,
    initial.resourceRevision,
    initial.canDecide,
    initial.available,
  ]);
  useEffect(() => {
    if (!storageFailed && !draft.reason && !draft.attempt) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed, draft.reason, draft.attempt]);
  const store = (next: CaseDraft) => {
    const persisted = recovery.write(next);
    setStorageFailed(!persisted);
    return persisted;
  };
  const conflict =
    draft.revision !== current.revision ||
    draft.resourceRevision !== current.resourceRevision ||
    draft.rejected;
  const canPrepare =
    sameActor &&
    access === "ready" &&
    current.canDecide &&
    !busy &&
    !invalid &&
    !draft.attempt &&
    !conflict &&
    !(draft.outcome === "message_hidden" && current.state !== "visible") &&
    !(draft.outcome === "revised" && draft.nextState === current.state);
  function edit(
    patch: Partial<Pick<CaseDraft, "reason" | "outcome" | "nextState">>,
  ) {
    if (
      !sameActor ||
      busy ||
      invalid ||
      draft.attempt ||
      !current.canDecide ||
      access !== "ready"
    )
      return;
    store({ ...draft, ...patch, code: null, receipt: null });
    setPreview(null);
  }
  function prepare() {
    if (!canPrepare) return;
    const command = parseCaseCommand({
      kind,
      caseId,
      resourceId: current.resourceId,
      originalActionId: current.originalActionId,
      requestId: crypto.randomUUID(),
      expectedRevision: draft.revision,
      expectedResourceRevision: draft.resourceRevision,
      outcome: draft.outcome,
      nextState: draft.outcome === "revised" ? draft.nextState : null,
      reason: draft.reason,
    });
    if (!command) {
      store({ ...draft, code: "INVALID_INPUT" });
      return;
    }
    setPreview(command);
  }
  async function submit(command: CaseCommand) {
    if (
      life.current.busy ||
      !sameActor ||
      clerk.user?.id !== actorSubject ||
      access !== "ready" ||
      invalid
    )
      return;
    // A pending command may recover a historical receipt after write authority
    // or the case's open status is gone. The server distinguishes replay/new.
    if (!draft.attempt && !canPrepare) return;
    const next: CaseDraft = {
      ...draft,
      reason: command.reason,
      attempt: command,
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
      const result = await decideTrustCaseAction({ actorKey, input: command });
      if (clerk.user?.id !== actorSubject) return;
      if (result.ok) {
        const receipt = parseCaseReceipt(result.data, command);
        if (receipt)
          recovery.write({
            ...next,
            attempt: null,
            reason: "",
            revision: receipt.decision.revision,
            resourceRevision: receipt.decision.resourceRevision,
            receipt,
          });
        else recovery.write({ ...next, code: "NOT_AVAILABLE" });
      } else
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
      !sameActor ||
      busy ||
      invalid ||
      access !== "ready" ||
      (draft.attempt && !draft.rejected)
    )
      return;
    store({
      ...emptyCaseDraft(current),
      ...(keep
        ? {
            reason: draft.reason,
            outcome: draft.outcome,
            nextState: draft.nextState,
          }
        : {}),
    });
    setPreview(null);
  }
  return {
    current,
    draft,
    invalid,
    access,
    sameActor,
    busy,
    storageFailed,
    preview,
    conflict,
    canPrepare,
    edit,
    prepare,
    submit,
    resolve,
    closePreview: () => {
      if (!life.current.busy) setPreview(null);
    },
    reload: () => {
      setAccess("checking");
      void fetchCurrent();
      router.refresh();
    },
  };
}
