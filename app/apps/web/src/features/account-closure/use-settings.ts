"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk, useReverification } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
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
  const pathname = usePathname(),
    search = useSearchParams();
  const entry = pathname + (search.size ? "?" + search.toString() : "");
  const context = [
    subject,
    mode,
    entry,
    clerk.user?.id ?? "",
    clerk.session?.id ?? "",
    clerk.session?.status ?? "",
  ].join("\0");
  const [view, setView] = useState<SettingsView | null>(null),
    [pending, setPending] = useState<ClosureCommand | null>(null),
    [error, setError] = useState<ClosureCode | "STORAGE" | null>(null),
    [errorContext, setErrorContext] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [busyContext, setBusyContext] = useState<string | null>(null),
    [authority, setAuthority] = useState<string | null>(null);
  const life = useRef({
      mounted: false,
      visible: false,
      generation: 0,
      sequence: 0,
      busy: null as number | null,
      nextOperation: 0,
    }),
    attempt = useRef<ClosureCommand | null>(null);
  const active = useCallback(
    () =>
      life.current.mounted &&
      life.current.visible &&
      clerk.user?.id === subject &&
      clerk.session?.status === "active" &&
      !!clerk.session.id &&
      document.visibilityState === "visible" &&
      location.pathname +
        (location.search
          ? "?" + new URLSearchParams(location.search).toString()
          : "") ===
        entry,
    [clerk, subject, entry],
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
      // A visible explicit check also recovers after blur without a focus event.
      if (!life.current.mounted || document.visibilityState !== "visible")
        return;
      life.current.visible = true;
      if (!active()) return;
      const sequence = ++life.current.sequence,
        generation = life.current.generation,
        sessionId = clerk.session?.id;
      const requestContext = [
        subject,
        mode,
        entry,
        clerk.user?.id ?? "",
        sessionId ?? "",
        clerk.session?.status ?? "",
      ].join("\0");
      const requestCurrent = () =>
        active() &&
        generation === life.current.generation &&
        sequence === life.current.sequence &&
        clerk.session?.id === sessionId;
      setAuthority(null);
      setErrorContext(requestContext);
      setError(null);
      try {
        const result = await read(mode, prompt);
        if (!requestCurrent()) return;
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
            setAuthority(null);
            setError("STORAGE");
            return;
          }
        }
        setView(current);
        setAuthority(requestContext);
        setError(null);
      } catch {
        if (requestCurrent()) setError("NOT_AVAILABLE");
      }
    },
    [active, clerk, subject, mode, entry, read, clear],
  );
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    current.visible = document.visibilityState === "visible";
    ++current.generation;
    const hidden = () => {
      ++current.sequence;
      ++current.generation;
      current.visible = false;
      current.busy = null;
      setBusy(false);
      setAuthority(null);
      setView(null);
    };
    let previous: string | null = null,
      subscribed = true;
    const unsubscribe = clerk.addListener((resources) => {
      if (!subscribed || !current.mounted) return;
      const identity = [
        resources.user?.id ?? "",
        resources.session?.id ?? "",
        resources.session?.status ?? "",
      ].join(":");
      if (identity === previous) return;
      previous = identity;
      hidden();
      // Replacing/reverifying a session never retires an uncertain command.
      // A different actor cannot see the attempt; its journal stays actor scoped
      // and can be recovered only after a matching current server read.
      if (resources.user?.id !== subject) {
        attempt.current = null;
        setPending(null);
      }
      if (
        resources.user?.id === subject &&
        resources.session?.status === "active" &&
        resources.session.id
      )
        void refresh();
    });
    const visible = () => {
        if (document.visibilityState === "visible") void refresh();
      },
      visibility = () => {
        if (document.visibilityState === "hidden") hidden();
        else visible();
      };
    const restored = () => {
      hidden();
      visible();
    };
    const online = () => {
      if (current.visible) visible();
    };
    window.addEventListener("focus", visible);
    window.addEventListener("blur", hidden);
    window.addEventListener("pageshow", restored);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      subscribed = false;
      current.mounted = false;
      current.visible = false;
      current.busy = null;
      ++current.sequence;
      ++current.generation;
      unsubscribe();
      window.removeEventListener("focus", visible);
      window.removeEventListener("blur", hidden);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [clerk, subject, context, clear, refresh]);
  const ready =
    authority === context &&
    clerk.user?.id === subject &&
    clerk.session?.status === "active" &&
    !!clerk.session.id;
  const run = async (command: ClosureCommand, recovery = false) => {
    if (!active() || life.current.busy !== null || !ready) return;
    const sessionId = clerk.session?.id,
      generation = life.current.generation,
      operation = ++life.current.nextOperation;
    life.current.busy = operation;
    const requestCurrent = () =>
      active() &&
      generation === life.current.generation &&
      clerk.session?.id === sessionId &&
      life.current.busy === operation;
    setBusy(true);
    setBusyContext(context);
    setErrorContext(context);
    setError(null);
    if (!recovery) {
      try {
        sessionStorage.setItem(key(command.actorKey), JSON.stringify(command));
      } catch {
        life.current.busy = null;
        setBusy(false);
        setError("STORAGE");
        return;
      }
      attempt.current = command;
      setPending(command);
    }
    try {
      const result = recovery ? await recover(command) : await change(command);
      if (!requestCurrent()) return;
      if (!result?.ok) {
        const code = result?.code ?? "NOT_AVAILABLE";
        setError(code);
        if (
          ![
            "NOT_AVAILABLE",
            "UNKNOWN_OUTCOME",
            "RECENT_AUTH_REQUIRED",
          ].includes(code)
        )
          clear();
        setAuthority(null);
        return;
      }
      if (result.data.subject !== subject) {
        clear();
        setView(null);
        setAuthority(null);
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
        if (!requestCurrent()) return;
        if (
          !outcome?.ok ||
          outcome.data.subject !== subject ||
          outcome.data.state !== "confirmed"
        )
          setError(
            outcome?.ok
              ? "UNKNOWN_OUTCOME"
              : (outcome?.code ?? "UNKNOWN_OUTCOME"),
          );
      }
      if (requestCurrent()) await refresh();
    } catch {
      if (requestCurrent()) {
        setError("UNKNOWN_OUTCOME");
        setAuthority(null);
      }
    } finally {
      if (life.current.busy === operation) {
        life.current.busy = null;
        if (life.current.mounted && generation === life.current.generation)
          setBusy(false);
      }
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
    if (!ready || !active() || life.current.busy !== null) return;
    const sessionId = clerk.session?.id,
      generation = life.current.generation,
      operation = ++life.current.nextOperation;
    life.current.busy = operation;
    const requestCurrent = () =>
      active() &&
      generation === life.current.generation &&
      clerk.session?.id === sessionId &&
      life.current.busy === operation;
    setBusy(true);
    setBusyContext(context);
    setErrorContext(context);
    setError(null);
    try {
      const result = await revoke(id);
      if (!requestCurrent()) return;
      if (!result?.ok || result.data.subject !== subject) {
        const code = result?.ok
          ? "FORBIDDEN"
          : (result?.code ?? "NOT_AVAILABLE");
        setError(code);
        if (["FORBIDDEN", "UNAUTHENTICATED"].includes(code)) {
          clear();
          setView(null);
          setAuthority(null);
        }
        return;
      }
      if (result.data.state !== "confirmed") setError("UNKNOWN_OUTCOME");
      await refresh();
    } catch {
      if (requestCurrent()) setError("UNKNOWN_OUTCOME");
    } finally {
      if (life.current.busy === operation) {
        life.current.busy = null;
        if (life.current.mounted && generation === life.current.generation)
          setBusy(false);
      }
    }
  };
  return {
    view: ready ? view : null,
    pending: ready ? pending : null,
    error:
      errorContext === context &&
      clerk.user?.id === subject &&
      clerk.session?.status === "active" &&
      !!clerk.session.id
        ? error
        : null,
    busy:
      busyContext === context &&
      clerk.user?.id === subject &&
      clerk.session?.status === "active" &&
      !!clerk.session.id &&
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
