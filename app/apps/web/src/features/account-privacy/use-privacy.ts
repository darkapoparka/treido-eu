"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk, useReverification } from "@clerk/nextjs";
import {
  changePrivacyAction,
  downloadPrivacyAction,
  readPrivacyAction,
} from "./actions";
import {
  decodePending,
  parsePrivacyCommand,
  type Acknowledgment,
  type PrivacyCode,
  type PrivacyCommand,
  type PrivacyOperation,
  type PrivacyView,
  PRIVACY_LIMITS,
} from "./model";
const recoveryKey = (actor: string) => "treido-privacy-request-v1:" + actor;
export function usePrivacy(subject: string) {
  const clerk = useClerk(),
    readVerified = useReverification(readPrivacyAction),
    changeVerified = useReverification(changePrivacyAction),
    downloadVerified = useReverification(downloadPrivacyAction);
  const [view, setView] = useState<PrivacyView | null>(null),
    [code, setCode] = useState<PrivacyCode | "STORAGE" | null>(null),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<PrivacyCommand | null>(null),
    [acknowledgment, setAcknowledgment] = useState<Acknowledgment | null>(null);
  const live = useRef(false),
    working = useRef<number | null>(null),
    pendingRef = useRef<PrivacyCommand | null>(null),
    generation = useRef(0),
    visible = useRef(true),
    restoreRequested = useRef(false),
    refreshRef = useRef<(prompt: boolean) => Promise<void>>(async () => {});
  const current = useCallback(
    () =>
      live.current &&
      visible.current &&
      document.visibilityState === "visible" &&
      clerk.user?.id === subject &&
      clerk.session?.status === "active",
    [clerk, subject],
  );
  const requestCurrent = useCallback(
    (ticket: number, sessionId: string | undefined) =>
      current() &&
      ticket === generation.current &&
      clerk.session?.id === sessionId,
    [current, clerk],
  );
  const finish = useCallback(
    (ticket: number) => {
      if (working.current !== ticket) return;
      working.current = null;
      if (!live.current) return;
      setBusy(false);
      if (restoreRequested.current && current()) {
        restoreRequested.current = false;
        void refreshRef.current(false);
      }
    },
    [current],
  );
  const acceptView = useCallback(
    (next: PrivacyView) => {
      if (!current()) return;
      if (pendingRef.current && pendingRef.current.actorKey !== next.actorKey) {
        pendingRef.current = null;
        setPending(null);
      }
      setView(next);
      try {
        const recovered = decodePending(
          sessionStorage.getItem(recoveryKey(next.actorKey)),
        );
        if (recovered && recovered.actorKey === next.actorKey) {
          pendingRef.current = recovered;
          setPending(recovered);
        }
      } catch {
        setCode("STORAGE");
      }
    },
    [current],
  );
  const refresh = useCallback(
    async (prompt = true) => {
      if (
        prompt &&
        live.current &&
        document.visibilityState === "visible" &&
        clerk.user?.id === subject &&
        clerk.session?.status === "active"
      )
        visible.current = true;
      if (!current()) return;
      if (working.current) {
        restoreRequested.current = true;
        return;
      }
      restoreRequested.current = false;
      const ticket = ++generation.current,
        sessionId = clerk.session?.id;
      working.current = ticket;
      setBusy(true);
      setCode(null);
      setView(null);
      try {
        const result = prompt
          ? await readVerified(true)
          : await readPrivacyAction(false);
        if (!requestCurrent(ticket, sessionId)) return;
        if (result && "ok" in result) {
          if (result.ok && result.data.subject === subject)
            acceptView(result.data.view);
          else if (!result.ok) setCode(result.code);
          else setCode("UNAUTHENTICATED");
        } else setCode("RECENT_AUTH_REQUIRED");
      } catch {
        if (requestCurrent(ticket, sessionId)) setCode("NOT_AVAILABLE");
      } finally {
        finish(ticket);
      }
    },
    [current, readVerified, subject, acceptView, clerk, requestCurrent, finish],
  );
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const lifecycleGeneration = generation;
    live.current = true;
    visible.current = document.visibilityState === "visible";
    let previous: string | null = null,
      observed = false;
    const conceal = () => {
      ++generation.current;
      working.current = null;
      visible.current = false;
      restoreRequested.current = true;
      setView(null);
      setAcknowledgment(null);
      setCode(null);
      setBusy(false);
    };
    const restore = () => {
      if (document.visibilityState !== "visible") return;
      visible.current = true;
      void refresh(false);
    };
    const unsubscribe = clerk.addListener((resources) => {
      observed = true;
      const identity = [
        resources.user?.id ?? "",
        resources.session?.id ?? "",
        resources.session?.status ?? "",
      ].join(":");
      if (identity === previous) return;
      const changed = previous !== null;
      previous = identity;
      if (
        changed ||
        resources.user?.id !== subject ||
        resources.session?.status !== "active"
      )
        conceal();
      if (
        resources.user?.id === subject &&
        resources.session?.status === "active"
      )
        restore();
    });
    const visibility = () => {
      if (document.visibilityState === "hidden") conceal();
      else restore();
    };
    const restored = () => {
      conceal();
      restore();
    };
    const online = () => {
      if (visible.current) restore();
    };
    if (!observed) void refresh(false);
    window.addEventListener("focus", restore);
    window.addEventListener("blur", conceal);
    window.addEventListener("pageshow", restored);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      live.current = false;
      ++lifecycleGeneration.current;
      unsubscribe();
      window.removeEventListener("focus", restore);
      window.removeEventListener("blur", conceal);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [clerk, subject, refresh]);
  const execute = async (operation?: PrivacyOperation) => {
    if (
      working.current ||
      !current() ||
      !view ||
      (!operation && !pendingRef.current)
    )
      return;
    if (operation && pendingRef.current) return;
    let command: PrivacyCommand;
    try {
      command =
        pendingRef.current ??
        parsePrivacyCommand({
          version: 1,
          actorKey: view.actorKey,
          requestId: crypto.randomUUID(),
          expectedRevision: view.revision,
          operation,
        });
      if (command.actorKey !== view.actorKey) return;
      sessionStorage.setItem(
        recoveryKey(command.actorKey),
        JSON.stringify(command),
      );
      // Verify storage before the first server mutation; never send an unrecoverable new request.
      if (
        JSON.stringify(
          decodePending(sessionStorage.getItem(recoveryKey(command.actorKey))),
        ) !== JSON.stringify(command)
      )
        throw new Error("Recovery unavailable");
    } catch {
      setCode("STORAGE");
      return;
    }
    pendingRef.current = command;
    setPending(command);
    setBusy(true);
    setCode(null);
    setAcknowledgment(null);
    const ticket = ++generation.current,
      sessionId = clerk.session?.id;
    working.current = ticket;
    try {
      const result = await changeVerified(command);
      if (!requestCurrent(ticket, sessionId)) return;
      if (!result) {
        setView(null);
        setCode("RECENT_AUTH_REQUIRED");
        return;
      }
      if (result.ok && result.data.subject === subject) {
        setAcknowledgment(result.data.change.acknowledgment);
        sessionStorage.removeItem(recoveryKey(command.actorKey));
        pendingRef.current = null;
        setPending(null);
        // An acknowledgment is immutable; separately fetch current state instead of substituting it.
        setView(null);
        const read = await readPrivacyAction(false);
        if (requestCurrent(ticket, sessionId) && "ok" in read) {
          if (read.ok && read.data.subject === subject)
            acceptView(read.data.view);
          else if (!read.ok) setCode(read.code);
        }
      } else if (!result.ok) {
        setCode(result.code);
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes(result.code))
          setView(null);
        if (
          [
            "INVALID_INPUT",
            "CONFLICT",
            "NOT_FOUND",
            "EXPIRED",
            "QUOTA_EXCEEDED",
          ].includes(result.code)
        ) {
          sessionStorage.removeItem(recoveryKey(command.actorKey));
          pendingRef.current = null;
          setPending(null);
          setView(null);
        }
      } else {
        setView(null);
        setCode("UNAUTHENTICATED");
      }
    } catch {
      if (requestCurrent(ticket, sessionId)) setCode("NOT_AVAILABLE");
    } finally {
      finish(ticket);
    }
  };
  const download = async (id: string) => {
    if (working.current || pendingRef.current || !current() || !view) return;
    setBusy(true);
    setCode(null);
    const ticket = ++generation.current,
      sessionId = clerk.session?.id;
    working.current = ticket;
    try {
      const result = await downloadVerified({ id, actorKey: view.actorKey });
      if (!requestCurrent(ticket, sessionId)) return;
      if (!result) {
        setView(null);
        setCode("RECENT_AUTH_REQUIRED");
        return;
      }
      if (!result.ok) {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes(result.code))
          setView(null);
        setCode(result.code);
        return;
      }
      if (
        result.data.subject !== subject ||
        new TextEncoder().encode(result.data.body).byteLength >
          PRIVACY_LIMITS.bytes
      ) {
        setView(null);
        setCode("UNAUTHENTICATED");
        return;
      }
      const url = URL.createObjectURL(
        new Blob([result.data.body], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "treido-personal-data.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (requestCurrent(ticket, sessionId)) setCode("NOT_AVAILABLE");
    } finally {
      finish(ticket);
    }
  };
  return {
    view,
    code,
    busy,
    pending,
    acknowledgment,
    refresh,
    execute,
    download,
  };
}
