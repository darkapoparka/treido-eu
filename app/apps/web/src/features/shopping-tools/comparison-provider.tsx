"use client";
import { useAuth } from "@clerk/nextjs";
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
/** A keyed controller is destroyed synchronously on account changes. Old async
 * responses and frozen writes cannot become the next account's workspace. */
export function ComparisonProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  return (
    <Controller
      key={isLoaded ? (userId ?? "guest") : "checking"}
      subject={isLoaded ? (userId ?? null) : null}
      loaded={!!isLoaded}
    >
      {children}
    </Controller>
  );
}
function Controller({
  subject,
  loaded,
  children,
}: {
  subject: string | null;
  loaded: boolean;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<ComparisonController["status"]>(
      loaded && !subject ? "guest" : "checking",
    ),
    [view, setView] = useState<ComparisonView | null>(null),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(false),
    [feedback, setFeedback] = useState<string | null>(null),
    [acknowledgment, setAcknowledgment] =
      useState<ComparisonAcknowledgment | null>(null);
  const life = useRef({
      alive: false,
      busy: false,
      read: 0,
      storageReady: false,
    }),
    attempt = useRef<ComparisonCommand | null>(null);
  const key = "treido-comparison-recovery-v1:" + (subject ?? "guest");
  const reload = useCallback(async () => {
    if (
      !subject ||
      !life.current.alive ||
      document.visibilityState !== "visible"
    )
      return;
    const ticket = ++life.current.read;
    setView(null);
    setStatus("checking");
    try {
      const result = await readComparisonAction();
      if (!life.current.alive || ticket !== life.current.read) return;
      if (result.ok && result.data.subject === subject) {
        setView(result.data.view);
        setStatus("ready");
      } else {
        setView(null);
        setStatus(
          !result.ok &&
            (result.code === "UNAUTHENTICATED" || result.code === "FORBIDDEN")
            ? "denied"
            : "unavailable",
        );
      }
    } catch {
      if (life.current.alive && ticket === life.current.read) {
        setView(null);
        setStatus("unavailable");
      }
    }
  }, [subject]);
  useEffect(() => {
    const current = life.current;
    current.alive = true;
    const initialize = async () => {
      await Promise.resolve();
      if (!current.alive || !subject) return;
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          if (raw.length > 8192) throw Error();
          attempt.current = parseComparisonCommand(JSON.parse(raw));
          setPending(true);
        }
        current.storageReady = true;
      } catch {
        current.storageReady = false;
        setFeedback("localStorage");
      }
      await reload();
    };
    void initialize();
    const refresh = () => {
      if (!current.busy && document.visibilityState === "visible")
        void reload();
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") {
        ++current.read;
        setView(null);
        setStatus("checking");
      } else refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(refresh, 30000);
    return () => {
      current.alive = false;
      ++current.read;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [subject, key, reload]);
  const submit = async (command: ComparisonCommand) => {
    if (!subject || !life.current.alive || life.current.busy) return;
    life.current.busy = true;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await changeComparisonAction(command);
      if (!life.current.alive) return;
      if (result.ok && result.data.subject !== subject) {
        setView(null);
        setStatus("denied");
        return;
      }
      if (
        !result.ok &&
        (result.code === "NOT_AVAILABLE" ||
          result.code === "UNAUTHENTICATED" ||
          result.code === "FORBIDDEN")
      ) {
        // A failed current authorization does not prove that an earlier attempt
        // failed to commit. Retain the original request until it can be read.
        setFeedback("pending");
        setView(null);
        setStatus(result.code === "NOT_AVAILABLE" ? "unavailable" : "denied");
        return;
      }
      if (result.ok)
        setAcknowledgment({
          requestId: command.requestId,
          operation: command.operation.kind,
          change: result.data.change,
        });
      try {
        sessionStorage.removeItem(key);
      } catch {
        setFeedback("localStorage");
        return;
      }
      attempt.current = null;
      setPending(false);
      setView(null);
      if (result.ok) setFeedback("confirmed");
      else
        setFeedback(
          result.code === "CONFLICT"
            ? "conflict"
            : result.code === "QUOTA_EXCEEDED"
              ? "quota"
              : result.code === "NOT_FOUND"
                ? "notFound"
                : result.code === "FORBIDDEN" ||
                    result.code === "UNAUTHENTICATED"
                  ? "denied"
                  : "invalidCommand",
        );
      await reload();
    } catch {
      if (life.current.alive) setFeedback("pending");
    } finally {
      life.current.busy = false;
      if (life.current.alive) setBusy(false);
    }
  };
  const execute = async (
    operation: ComparisonOperation,
    expectedRevision?: number,
  ) => {
    if (
      !subject ||
      status !== "ready" ||
      !view ||
      life.current.busy ||
      attempt.current
    )
      return;
    if (!life.current.storageReady) {
      setFeedback("localStorage");
      return;
    }
    const command = parseComparisonCommand({
      actorKey: view.actorKey,
      expectedRevision: expectedRevision ?? view.revision,
      requestId: crypto.randomUUID(),
      operation,
    });
    try {
      const raw = JSON.stringify(command);
      if (raw.length > 8192) throw Error();
      sessionStorage.setItem(key, raw);
    } catch {
      setFeedback("localStorage");
      return;
    }
    attempt.current = command;
    setPending(true);
    await submit(command);
  };
  const retry = async () => {
    if (attempt.current) await submit(attempt.current);
    else await reload();
  };
  return (
    <Context.Provider
      value={{
        subject,
        status,
        view,
        busy,
        pending,
        feedback,
        acknowledgment,
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
