"use client";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AssistantResult } from "./actions";
import type { SellerErrorCode } from "../sellers/errors";
type Envelope = {
  actorKey: string;
  expectedRevision: number;
  requestId: string;
};
type View = { actorKey: string; revision: number };
export type AssistantFeedback =
  SellerErrorCode | "storage" | "pending" | "saved" | null;
/** The two F22 command flows share only account-scoped original-request recovery.
 * Mount under a subject/seller key; no automatic retry or mutation on reads. */
export function useAssistantCommand<V extends View, C extends Envelope, R>(
  subject: string,
  scope: string,
  read: () => Promise<AssistantResult<V>>,
  change: (command: C) => Promise<AssistantResult<R>>,
  parse: (raw: unknown) => C,
  durablePending?: (view: V) => C | null,
) {
  const [view, setView] = useState<V | null>(null),
    [status, setStatus] = useState<
      "checking" | "ready" | "denied" | "unavailable"
    >("checking"),
    [pending, setPending] = useState<C | null>(null),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<AssistantFeedback>(null),
    [ack, setAck] = useState<R | null>(null);
  const life = useRef({ alive: false, busy: false, read: 0, storage: false }),
    attempt = useRef<C | null>(null);
  const key = "treido-f22-recovery-v1:" + subject + ":" + scope;
  const reload = useCallback(async () => {
    if (!life.current.alive || document.visibilityState !== "visible") return;
    const ticket = ++life.current.read;
    setView(null);
    setStatus("checking");
    try {
      const result = await read();
      if (!life.current.alive || ticket !== life.current.read) return;
      if (result.ok && result.data.subject === subject) {
        const value = result.data.value;
        setView(value);
        setStatus("ready");
        const original = durablePending?.(value);
        if (original && !attempt.current) {
          const recovered = parse(original);
          attempt.current = recovered;
          setPending(recovered);
          setFeedback("pending");
          try {
            sessionStorage.setItem(key, JSON.stringify(recovered));
            life.current.storage = true;
          } catch {
            life.current.storage = false;
          }
        }
      } else {
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
        setView(null);
        setStatus("unavailable");
      }
    }
  }, [read, subject, durablePending, parse, key]);
  useEffect(() => {
    const current = life.current;
    current.alive = true;
    const initialize = async () => {
      await Promise.resolve();
      if (!current.alive) return;
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          if (raw.length > 48000) throw Error();
          const original = parse(JSON.parse(raw));
          attempt.current = original;
          setPending(original);
          setFeedback("pending");
        }
        current.storage = true;
      } catch {
        current.storage = false;
        setFeedback("storage");
      }
      await reload();
    };
    startTransition(() => {
      void initialize();
    });
    const refresh = () => {
      if (!current.busy && document.visibilityState === "visible")
        startTransition(() => {
          void reload();
        });
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
    return () => {
      current.alive = false;
      ++current.read;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [key, parse, reload]);
  function forget() {
    attempt.current = null;
    setPending(null);
    try {
      sessionStorage.removeItem(key);
    } catch {
      life.current.storage = false;
      setFeedback("storage");
    }
  }
  async function submit(command: C) {
    if (!life.current.alive || life.current.busy) return;
    life.current.busy = true;
    ++life.current.read;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await change(command);
      if (!life.current.alive) return;
      if (result.ok && result.data.subject === subject) {
        setAck(result.data.value);
        forget();
        setFeedback(life.current.storage ? "saved" : "storage");
        await reload();
      } else if (
        !result.ok &&
        ["INVALID_INPUT", "CONFLICT", "QUOTA_EXCEEDED", "NOT_FOUND"].includes(
          result.code,
        )
      ) {
        forget();
        setFeedback(result.code);
        await reload();
      } else {
        setFeedback("pending");
        setView(null);
        setStatus(
          !result.ok && result.code === "NOT_AVAILABLE"
            ? "unavailable"
            : "denied",
        );
      }
    } catch {
      if (life.current.alive) {
        setFeedback("pending");
        setView(null);
        setStatus("unavailable");
      }
    } finally {
      life.current.busy = false;
      if (life.current.alive) setBusy(false);
    }
  }
  function execute(raw: C) {
    if (!view || status !== "ready" || life.current.busy || attempt.current)
      return;
    let command: C;
    try {
      command = parse(JSON.parse(JSON.stringify(raw)));
    } catch {
      setFeedback("INVALID_INPUT");
      return;
    }
    if (
      command.actorKey !== view.actorKey ||
      command.expectedRevision !== view.revision
    ) {
      setFeedback("CONFLICT");
      return;
    }
    try {
      if (!life.current.storage) throw Error();
      sessionStorage.setItem(key, JSON.stringify(command));
    } catch {
      setFeedback("storage");
      return;
    }
    attempt.current = command;
    setPending(command);
    startTransition(() => {
      void submit(command);
    });
  }
  function retry() {
    const original = attempt.current;
    if (original)
      startTransition(() => {
        void submit(original);
      });
  }
  return {
    view,
    status,
    pending,
    busy,
    feedback,
    ack,
    execute,
    retry,
    reload: () =>
      startTransition(() => {
        void reload();
      }),
  };
}
