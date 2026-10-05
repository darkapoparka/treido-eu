"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk, useReverification } from "@clerk/nextjs";
import {
  changeAccountSettingsAction,
  executeOwnSessionRevocationAction,
  readAccountSettingsAction,
  recoverAccountSettingsAction,
  type SettingsMode,
} from "./actions";
import {
  CLOSURE_LIMITS,
  parseCommand,
  type ClosureCode,
  type ClosureCommand,
  type ClosureOperation,
} from "./model";
type SettingsView = Extract<
  Awaited<ReturnType<typeof readAccountSettingsAction>>,
  { ok: true }
>["data"]["view"];
const key = (actor: string) => "treido-account-lifecycle-v1:" + actor;
export function useAccountSettings(subject: string, mode: SettingsMode) {
  const clerk = useClerk(),
    read = useReverification(readAccountSettingsAction),
    change = useReverification(changeAccountSettingsAction),
    recover = useReverification(recoverAccountSettingsAction),
    revoke = useReverification(executeOwnSessionRevocationAction);
  const [view, setView] = useState<SettingsView | null>(null),
    [pending, setPending] = useState<ClosureCommand | null>(null),
    [error, setError] = useState<ClosureCode | "STORAGE" | null>(null),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const life = useRef({ mounted: false, sequence: 0, busy: false }),
    attempt = useRef<ClosureCommand | null>(null);
  const active = useCallback(
    () =>
      life.current.mounted &&
      clerk.user?.id === subject &&
      clerk.session?.status === "active",
    [clerk, subject],
  );
  const clear = useCallback(() => {
    if (attempt.current) {
      try {
        sessionStorage.removeItem(key(attempt.current.actorKey));
      } catch {}
    }
    attempt.current = null;
    setPending(null);
  }, []);
  const refresh = useCallback(
    async (prompt = false) => {
      if (!active() || document.visibilityState !== "visible") return;
      const sequence = ++life.current.sequence,
        sessionId = clerk.session?.id;
      setReady(false);
      try {
        const result = await read(mode, prompt);
        if (
          !active() ||
          sequence !== life.current.sequence ||
          clerk.session?.id !== sessionId
        )
          return;
        if (!result?.ok) {
          setError(result?.code ?? "NOT_AVAILABLE");
          if (
            result &&
            ["FORBIDDEN", "UNAUTHENTICATED"].includes(result.code)
          ) {
            clear();
            setView(null);
          }
          return;
        }
        if (result.data.subject !== subject || result.data.view.mode !== mode) {
          clear();
          setView(null);
          setError("FORBIDDEN");
          return;
        }
        const current = result.data.view,
          actor =
            "preferences" in current
              ? current.preferences.actorKey
              : current.closure.actorKey;
        if (attempt.current && attempt.current.actorKey !== actor) clear();
        if (!attempt.current) {
          try {
            const raw = sessionStorage.getItem(key(actor));
            if (raw) {
              if (raw.length > CLOSURE_LIMITS.recoveryBytes)
                throw new Error("Recovery size");
              const stored = parseCommand(JSON.parse(raw));
              if (stored.actorKey !== actor) throw new Error("Recovery actor");
              attempt.current = stored;
              setPending(stored);
            }
          } catch {
            setView(current);
            setReady(false);
            setError("STORAGE");
            return;
          }
        }
        setView(current);
        setReady(true);
        setError(null);
      } catch {
        if (active() && sequence === life.current.sequence)
          setError("NOT_AVAILABLE");
      }
    },
    [active, clerk, subject, mode, read, clear],
  );
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    let previous: string | null = null;
    const unsubscribe = clerk.addListener((resources) => {
      const identity = [
        resources.user?.id ?? "",
        resources.session?.id ?? "",
        resources.session?.status ?? "",
      ].join(":");
      if (identity === previous) return;
      const changed = previous !== null;
      previous = identity;
      ++current.sequence;
      if (
        changed ||
        resources.user?.id !== subject ||
        resources.session?.status !== "active"
      ) {
        clear();
        setView(null);
        setReady(false);
      }
      if (
        resources.user?.id === subject &&
        resources.session?.status === "active"
      )
        void refresh();
    });
    const hidden = () => {
        ++current.sequence;
        setReady(false);
      },
      visible = () => {
        if (document.visibilityState === "visible") void refresh();
      },
      visibility = () => {
        if (document.visibilityState === "hidden") hidden();
        else visible();
      };
    window.addEventListener("focus", visible);
    window.addEventListener("blur", hidden);
    window.addEventListener("pageshow", visible);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      current.mounted = false;
      ++current.sequence;
      unsubscribe();
      window.removeEventListener("focus", visible);
      window.removeEventListener("blur", hidden);
      window.removeEventListener("pageshow", visible);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [clerk, subject, clear, refresh]);
  const run = async (command: ClosureCommand, recovery = false) => {
    if (!active() || life.current.busy || !ready) return;
    const sessionId = clerk.session?.id;
    life.current.busy = true;
    setBusy(true);
    setError(null);
    if (!recovery) {
      try {
        sessionStorage.setItem(key(command.actorKey), JSON.stringify(command));
      } catch {
        life.current.busy = false;
        setBusy(false);
        setError("STORAGE");
        return;
      }
      attempt.current = command;
      setPending(command);
    }
    try {
      const result = recovery ? await recover(command) : await change(command);
      if (!active() || clerk.session?.id !== sessionId) return;
      if (!result?.ok) {
        const code = result?.code ?? "NOT_AVAILABLE";
        setError(code);
        if (code !== "NOT_AVAILABLE" && code !== "UNKNOWN_OUTCOME") clear();
        setReady(false);
        return;
      }
      if (result.data.subject !== subject) {
        clear();
        setView(null);
        setReady(false);
        setError("FORBIDDEN");
        return;
      }
      if (!result.data.change) {
        setError("UNKNOWN_OUTCOME");
        return;
      }
      const acknowledgment = result.data.change.acknowledgment;
      clear();
      if (command.operation.kind === "revokeSession" && !recovery) {
        const outcome = await revoke(acknowledgment.resourceId);
        if (
          active() &&
          clerk.session?.id === sessionId &&
          (!outcome?.ok || outcome.data.state !== "confirmed")
        )
          setError(
            outcome?.ok
              ? "UNKNOWN_OUTCOME"
              : (outcome?.code ?? "UNKNOWN_OUTCOME"),
          );
      }
      await refresh();
    } catch {
      if (active() && clerk.session?.id === sessionId) {
        setError("UNKNOWN_OUTCOME");
        setReady(false);
      }
    } finally {
      life.current.busy = false;
      if (life.current.mounted) setBusy(false);
    }
  };
  const execute = (operation: ClosureOperation) => {
    if (!view || !ready || pending || busy) return;
    const current = "preferences" in view ? view.preferences : view.closure;
    void run({
      version: 1,
      actorKey: current.actorKey,
      requestId: crypto.randomUUID(),
      expectedRevision: current.revision,
      operation,
    });
  };
  const checkSession = async (id: string) => {
    if (!ready || !active() || life.current.busy) return;
    const sessionId = clerk.session?.id;
    life.current.busy = true;
    setBusy(true);
    try {
      const result = await revoke(id);
      if (!active() || clerk.session?.id !== sessionId) return;
      if (!result?.ok || result.data.subject !== subject) {
        setError(result?.ok ? "FORBIDDEN" : (result?.code ?? "NOT_AVAILABLE"));
        return;
      }
      if (result.data.state !== "confirmed") setError("UNKNOWN_OUTCOME");
      await refresh();
    } catch {
      if (active() && clerk.session?.id === sessionId)
        setError("UNKNOWN_OUTCOME");
    } finally {
      life.current.busy = false;
      if (life.current.mounted) setBusy(false);
    }
  };
  return {
    view,
    pending,
    error,
    busy,
    ready,
    refresh,
    execute,
    checkSession,
    retry: () => {
      if (pending) void run(pending);
    },
    recover: () => {
      if (pending) void run(pending, true);
    },
  };
}
