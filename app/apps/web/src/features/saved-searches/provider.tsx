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
import { readSavedSearchesAction, changeSavedSearchAction } from "./actions";
import {
  parseSearchCommand,
  type SearchCommand,
  type SearchOperation,
  type SearchView,
  type SearchChange,
} from "./model";
import type { SearchCopyKey } from "./copy";
type Controller = {
  subject: string | null;
  status: "checking" | "guest" | "ready" | "unavailable" | "denied";
  view: SearchView | null;
  busy: boolean;
  pending: boolean;
  feedback: SearchCopyKey | null;
  ack: SearchChange | null;
  execute: (op: SearchOperation, expected?: number) => Promise<void>;
  retry: () => Promise<void>;
  reload: () => Promise<void>;
};
const Context = createContext<Controller | null>(null);
export function SavedSearchProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  return (
    <SearchController
      key={isLoaded ? (userId ?? "guest") : "checking"}
      subject={isLoaded ? (userId ?? null) : null}
      loaded={!!isLoaded}
    >
      {children}
    </SearchController>
  );
}
function SearchController({
  children,
  subject,
  loaded,
}: {
  children: ReactNode;
  subject: string | null;
  loaded: boolean;
}) {
  const [status, setStatus] = useState<Controller["status"]>(
      loaded && !subject ? "guest" : "checking",
    ),
    [view, setView] = useState<SearchView | null>(null),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(false),
    [feedback, setFeedback] = useState<SearchCopyKey | null>(null),
    [ack, setAck] = useState<SearchChange | null>(null);
  const life = useRef({
      alive: false,
      busy: false,
      read: 0,
      storageReady: false,
      hasView: false,
    }),
    attempt = useRef<SearchCommand | null>(null);
  const key = "treido-saved-search-recovery-v1:" + (subject ?? "guest");
  const reload = useCallback(async () => {
    if (
      !subject ||
      !life.current.alive ||
      document.visibilityState !== "visible"
    )
      return;
    const ticket = ++life.current.read;
    if (!life.current.hasView) setStatus("checking");
    try {
      const result = await readSavedSearchesAction();
      if (!life.current.alive || ticket !== life.current.read) return;
      if (result.ok && result.data.subject === subject) {
        life.current.hasView = true;
        setView(result.data.view);
        setStatus("ready");
      } else {
        life.current.hasView = false;
        setView(null);
        setStatus(
          !result.ok &&
            (result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED")
            ? "denied"
            : "unavailable",
        );
      }
    } catch {
      if (life.current.alive && ticket === life.current.read) {
        life.current.hasView = false;
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
          if (raw.length > 12000) throw Error();
          attempt.current = parseSearchCommand(JSON.parse(raw), true);
          setPending(true);
        }
        current.storageReady = true;
      } catch {
        current.storageReady = false;
        setFeedback("recoveryInvalid");
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
        current.hasView = false;
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
  const submit = async (command: SearchCommand) => {
    if (!subject || !life.current.alive || life.current.busy) return;
    life.current.busy = true;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await changeSavedSearchAction(command);
      if (!life.current.alive) return;
      if (result.ok && result.data.subject !== subject) {
        life.current.hasView = false;
        setView(null);
        setStatus("denied");
        setFeedback("pending");
        return;
      }
      if (
        !result.ok &&
        ["NOT_AVAILABLE", "UNAUTHENTICATED", "FORBIDDEN"].includes(result.code)
      ) {
        setFeedback("pending");
        life.current.hasView = false;
        setView(null);
        setStatus(result.code === "NOT_AVAILABLE" ? "unavailable" : "denied");
        return;
      }
      if (result.ok) setAck(result.data.change);
      try {
        sessionStorage.removeItem(key);
      } catch {
        setFeedback("recoveryStorage");
        return;
      }
      attempt.current = null;
      setPending(false);
      setFeedback(
        result.ok
          ? "saved"
          : result.code === "CONFLICT"
            ? "conflict"
            : result.code === "QUOTA_EXCEEDED"
              ? "quota"
              : result.code === "NOT_FOUND"
                ? "notFound"
                : "invalid",
      );
      await reload();
    } catch {
      if (life.current.alive) setFeedback("pending");
    } finally {
      life.current.busy = false;
      if (life.current.alive) setBusy(false);
    }
  };
  const execute = async (operation: SearchOperation, expected?: number) => {
    if (
      !subject ||
      status !== "ready" ||
      !view ||
      life.current.busy ||
      attempt.current
    )
      return;
    if (!life.current.storageReady) {
      setFeedback("recoveryStorage");
      return;
    }
    let command: SearchCommand;
    try {
      command = parseSearchCommand({
        actorKey: view.actorKey,
        expectedRevision: expected ?? view.revision,
        requestId: crypto.randomUUID(),
        operation,
      });
    } catch {
      setFeedback("invalid");
      return;
    }
    try {
      const raw = JSON.stringify(command);
      if (raw.length > 12000) throw Error();
      sessionStorage.setItem(key, raw);
    } catch {
      life.current.storageReady = false;
      setFeedback("recoveryStorage");
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
        ack,
        execute,
        retry,
        reload,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSavedSearches() {
  const value = useContext(Context);
  if (!value) throw Error("Saved search session unavailable.");
  return value;
}
