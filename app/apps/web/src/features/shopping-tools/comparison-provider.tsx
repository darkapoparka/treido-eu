"use client";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { readComparisonAction, changeComparisonAction } from "./actions";
import {
  parseComparisonCommand,
  type ComparisonAcknowledgment,
  type ComparisonCommand,
  type ComparisonOperation,
  type ComparisonView,
} from "./model";
export type ComparisonController = {
  subject: string | null;
  status: "checking" | "guest" | "ready" | "unavailable" | "denied";
  view: ComparisonView | null;
  busy: boolean;
  pending: boolean;
  feedback: string | null;
  acknowledgment: ComparisonAcknowledgment | null;
  execute: (
    operation: ComparisonOperation,
    expectedRevision?: number,
  ) => Promise<void>;
  retry: () => Promise<void>;
  reload: () => Promise<void>;
};
const Context = createContext<ComparisonController | null>(null);
/** Keep public Finder children mounted while qualifying private account state. */
export function ComparisonProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId, sessionId } = useAuth();
  return (
    <Controller
      subject={isLoaded ? (userId ?? null) : null}
      sessionId={isLoaded ? (sessionId ?? null) : null}
      loaded={!!isLoaded}
    >
      {children}
    </Controller>
  );
}
function Controller({
  subject,
  sessionId,
  loaded,
  children,
}: {
  subject: string | null;
  sessionId: string | null;
  loaded: boolean;
  children: ReactNode;
}) {
  const clerk = useClerk();
  const [state, setState] = useState({
    owner: "",
    status: "checking" as ComparisonController["status"],
    view: null as ComparisonView | null,
    busy: false,
    pending: false,
    feedback: null as string | null,
    acknowledgment: null as ComparisonAcknowledgment | null,
  });
  const life = useRef({
      alive: false,
      visible: false,
      generation: 0,
      operation: null as number | null,
      nextOperation: 0,
      read: 0,
      storageReady: false,
      subject: null as string | null,
    }),
    attempt = useRef<ComparisonCommand | null>(null),
    attemptBytes = useRef<string | null>(null);
  const key = "treido-comparison-recovery-v1:" + (subject ?? "guest");
  const owner = useCallback(
    () => [subject ?? "", sessionId ?? "", life.current.generation].join("\0"),
    [subject, sessionId],
  );
  const active = useCallback(
    () =>
      !!subject &&
      !!sessionId &&
      loaded &&
      life.current.alive &&
      life.current.visible &&
      document.visibilityState === "visible" &&
      clerk.user?.id === subject &&
      clerk.session?.id === sessionId &&
      clerk.session.status === "active",
    [clerk, subject, sessionId, loaded],
  );
  const reload = useCallback(async () => {
    const current = life.current;
    if (!current.alive || document.visibilityState !== "visible") return;
    // A visible explicit refresh also restores after blur without a focus event.
    current.visible = true;
    if (!active()) return;
    const ticket = ++current.read,
      generation = current.generation,
      requestOwner = owner();
    const requestCurrent = () =>
      active() && generation === current.generation && ticket === current.read;
    let recoveryError: string | null = null;
    try {
      const raw = sessionStorage.getItem(key);
      if (attempt.current) {
        if (raw !== attemptBytes.current) throw Error("Recovery changed");
      } else if (raw) {
        if (raw.length > 8192) throw Error("Recovery size");
        attempt.current = parseComparisonCommand(JSON.parse(raw));
        attemptBytes.current = raw;
      }
      current.storageReady = true;
    } catch {
      current.storageReady = false;
      recoveryError = "localStorage";
    }
    setState((previous) => ({
      ...previous,
      owner: requestOwner,
      status: "checking",
      view: null,
      pending: !!attempt.current,
      feedback: recoveryError ?? previous.feedback,
    }));
    const unavailable = (status: "denied" | "unavailable") => {
      ++current.generation;
      current.operation = null;
      setState((previous) => ({
        ...previous,
        owner: owner(),
        status,
        view: null,
        busy: false,
        acknowledgment: null,
      }));
    };
    try {
      const result = await readComparisonAction();
      if (!requestCurrent()) return;
      if (result.ok && result.data.subject === subject) {
        const mismatched =
          attempt.current &&
          attempt.current.actorKey !== result.data.view.actorKey;
        setState((previous) => ({
          ...previous,
          owner: requestOwner,
          status: "ready",
          view: result.data.view,
          pending: !!attempt.current,
          feedback: mismatched ? "localStorage" : previous.feedback,
        }));
      } else {
        unavailable(
          result.ok ||
            result.code === "UNAUTHENTICATED" ||
            result.code === "FORBIDDEN"
            ? "denied"
            : "unavailable",
        );
      }
    } catch {
      if (requestCurrent()) unavailable("unavailable");
    }
  }, [active, key, owner, subject]);
  useEffect(() => {
    const current = life.current;
    let mounted = true;
    current.alive = true;
    current.visible = document.visibilityState === "visible";
    ++current.generation;
    ++current.read;
    current.operation = null;
    current.storageReady = false;
    if (current.subject !== subject) {
      // Retain the former human's durable journal without exposing their buffer.
      attempt.current = null;
      attemptBytes.current = null;
      current.subject = subject;
    }
    const conceal = () => {
      ++current.generation;
      ++current.read;
      current.operation = null;
      current.visible = false;
      setState({
        owner: owner(),
        status: "checking",
        view: null,
        busy: false,
        pending: false,
        feedback: null,
        acknowledgment: null,
      });
    };
    const restore = () => {
      if (!mounted || document.visibilityState !== "visible") return;
      current.visible = true;
      if (active() && current.operation === null) void reload();
    };
    const signature = () =>
      [
        clerk.user?.id ?? "",
        clerk.session?.id ?? "",
        clerk.session?.status ?? "",
      ].join("\0");
    let previous = signature();
    const unsubscribe = clerk.addListener(() => {
      if (!mounted) return;
      const next = signature();
      if (next !== previous) {
        previous = next;
        conceal();
        restore();
      }
    });
    void Promise.resolve().then(() => {
      if (mounted) {
        conceal();
        restore();
      }
    });
    const refresh = () => {
      if (mounted && current.visible && active() && current.operation === null)
        void reload();
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") conceal();
      else restore();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) conceal();
      restore();
    };
    window.addEventListener("blur", conceal);
    window.addEventListener("focus", restore);
    window.addEventListener("pageshow", pageshow);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(refresh, 30000);
    return () => {
      mounted = false;
      current.alive = false;
      current.visible = false;
      ++current.generation;
      ++current.read;
      current.operation = null;
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener("blur", conceal);
      window.removeEventListener("focus", restore);
      window.removeEventListener("pageshow", pageshow);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active, clerk, owner, reload, subject]);
  const submit = async (command: ComparisonCommand) => {
    const current = life.current;
    if (
      !active() ||
      state.owner !== owner() ||
      state.status !== "ready" ||
      !state.view ||
      state.view.actorKey !== command.actorKey ||
      current.operation !== null ||
      !current.storageReady
    )
      return;
    try {
      if (attempt.current) {
        if (
          attempt.current !== command ||
          sessionStorage.getItem(key) !== attemptBytes.current
        )
          throw Error("Recovery changed");
      } else {
        const raw = JSON.stringify(command);
        if (raw.length > 8192 || sessionStorage.getItem(key) !== null)
          throw Error("Recovery occupied");
        sessionStorage.setItem(key, raw);
        if (sessionStorage.getItem(key) !== raw)
          throw Error("Recovery unavailable");
        attempt.current = command;
        attemptBytes.current = raw;
      }
    } catch {
      current.storageReady = false;
      setState((previous) => ({ ...previous, feedback: "localStorage" }));
      return;
    }
    const operation = ++current.nextOperation,
      generation = current.generation;
    current.operation = operation;
    ++current.read;
    const requestCurrent = () =>
      active() &&
      generation === current.generation &&
      current.operation === operation &&
      attempt.current === command;
    setState((previous) => ({
      ...previous,
      busy: true,
      pending: true,
      feedback: null,
    }));
    try {
      const result = await changeComparisonAction(command);
      if (!requestCurrent()) return;
      if (
        (result.ok && result.data.subject !== subject) ||
        (!result.ok &&
          (result.code === "NOT_AVAILABLE" ||
            result.code === "UNAUTHENTICATED" ||
            result.code === "FORBIDDEN"))
      ) {
        ++current.generation;
        current.operation = null;
        setState((previous) => ({
          ...previous,
          owner: owner(),
          feedback: "pending",
          view: null,
          status:
            !result.ok && result.code === "NOT_AVAILABLE"
              ? "unavailable"
              : "denied",
          busy: false,
          acknowledgment: null,
        }));
        return;
      }
      try {
        if (sessionStorage.getItem(key) !== attemptBytes.current)
          throw Error("Recovery changed");
        sessionStorage.removeItem(key);
      } catch {
        current.storageReady = false;
        setState((previous) => ({ ...previous, feedback: "localStorage" }));
        return;
      }
      attempt.current = null;
      attemptBytes.current = null;
      setState((previous) => ({
        ...previous,
        pending: false,
        acknowledgment: result.ok
          ? {
              requestId: command.requestId,
              operation: command.operation.kind,
              change: result.data.change,
            }
          : null,
        feedback: result.ok
          ? "confirmed"
          : result.code === "CONFLICT"
            ? "conflict"
            : result.code === "QUOTA_EXCEEDED"
              ? "quota"
              : result.code === "NOT_FOUND"
                ? "notFound"
                : "invalidCommand",
      }));
      await reload();
    } catch {
      if (requestCurrent())
        setState((previous) => ({ ...previous, feedback: "pending" }));
    } finally {
      if (
        active() &&
        generation === current.generation &&
        current.operation === operation
      ) {
        current.operation = null;
        setState((previous) => ({ ...previous, busy: false }));
      }
    }
  };
  const execute = async (
    operation: ComparisonOperation,
    expectedRevision?: number,
  ) => {
    if (
      !active() ||
      state.owner !== owner() ||
      state.status !== "ready" ||
      !state.view ||
      life.current.operation !== null ||
      attempt.current
    )
      return;
    if (!life.current.storageReady) {
      setState((previous) => ({ ...previous, feedback: "localStorage" }));
      return;
    }
    let command: ComparisonCommand;
    try {
      command = parseComparisonCommand({
        actorKey: state.view.actorKey,
        expectedRevision: expectedRevision ?? state.view.revision,
        requestId: crypto.randomUUID(),
        operation,
      });
    } catch {
      setState((previous) => ({ ...previous, feedback: "invalidCommand" }));
      return;
    }
    await submit(command);
  };
  const retry = async () => {
    if (attempt.current) await submit(attempt.current);
    else await reload();
  };
  const qualified =
      loaded &&
      !!subject &&
      !!sessionId &&
      clerk.user?.id === subject &&
      clerk.session?.id === sessionId &&
      clerk.session.status === "active" &&
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      state.owner.startsWith([subject, sessionId, ""].join("\0")),
    ready = qualified && state.status === "ready";
  return (
    <Context.Provider
      value={{
        subject,
        status:
          loaded && !subject
            ? "guest"
            : loaded &&
                subject &&
                (!sessionId || clerk.session?.status !== "active")
              ? "denied"
              : qualified
                ? state.status
                : "checking",
        view: ready ? state.view : null,
        busy: ready && state.busy,
        pending: ready && state.pending,
        feedback: qualified ? state.feedback : null,
        acknowledgment: ready ? state.acknowledgment : null,
        execute,
        retry,
        reload,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useComparison() {
  const value = useContext(Context);
  if (!value) throw Error("Comparison provider required.");
  return value;
}
