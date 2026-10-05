"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { changeLibraryAction, readLibraryAction } from "./actions";
import type {
  LibraryChange,
  LibraryCommand,
  LibraryOperation,
  LibraryQuery,
  LibraryView,
} from "./model";
import type { SellerErrorCode } from "../sellers/errors";

type Loaded = {
  key: string;
  view: LibraryView | null;
  status: "ready" | "guest" | "error";
  code: SellerErrorCode | null;
};
const eventName = "treido-library-changed";
/** Component memory is only a projection. PostgreSQL owns every mutation and retry receipt. */
export function useLibraryController(query: Partial<LibraryQuery>) {
  const key = JSON.stringify(query);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SellerErrorCode | null>(null);
  const [notice, setNotice] = useState(false);
  const generation = useRef({ value: 0 }),
    mounted = useRef(false),
    working = useRef(false);
  const refreshCurrent = useRef<() => Promise<void>>(async () => {});
  const retry = useRef<{ fingerprint: string; command: LibraryCommand } | null>(
    null,
  );
  const active = loaded?.key === key ? loaded : null;
  const refresh = useCallback(async () => {
    const ticket = ++generation.current.value;
    let response;
    try {
      response = await readLibraryAction(JSON.parse(key));
    } catch {
      response = { ok: false, code: "NOT_AVAILABLE" } as const;
    }
    if (!mounted.current || ticket !== generation.current.value) return;
    if (response.ok)
      setLoaded({ key, view: response.data, status: "ready", code: null });
    else
      setLoaded({
        key,
        view: null,
        status: response.code === "UNAUTHENTICATED" ? "guest" : "error",
        code: response.code,
      });
  }, [key]);
  useEffect(() => {
    mounted.current = true;
    refreshCurrent.current = refresh;
    const lifetime = generation.current;
    const update = () => {
      if (!working.current && document.visibilityState === "visible")
        void refresh();
    };
    const initial = window.setTimeout(update, 0);
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        ++generation.current.value;
        setLoaded(null);
      } else update();
    };
    // Only invalidation crosses tabs. No inventory or account data is stored in the browser.
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(eventName);
    if (channel) channel.onmessage = update;
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    window.addEventListener(eventName, update);
    document.addEventListener("visibilitychange", visibility);
    const timer = window.setInterval(update, 30000);
    return () => {
      mounted.current = false;
      ++lifetime.value;
      clearTimeout(initial);
      channel?.close();
      clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
      window.removeEventListener(eventName, update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh]);
  async function execute(
    operation: LibraryOperation,
  ): Promise<LibraryChange | null> {
    if (working.current) return null;
    if (!active?.view) {
      setError(
        active?.status === "guest" ? "UNAUTHENTICATED" : "NOT_AVAILABLE",
      );
      return null;
    }
    working.current = true;
    setBusy(true);
    setError(null);
    setNotice(false);
    const ticket = ++generation.current.value;
    const fingerprint = active.view.actorKey + ":" + JSON.stringify(operation);
    const command =
      retry.current?.fingerprint === fingerprint
        ? retry.current.command
        : {
            requestId: crypto.randomUUID(),
            actorKey: active.view.actorKey,
            expectedRevision: active.view.revision,
            operation,
          };
    retry.current = { fingerprint, command };
    let refreshAfter = false;
    try {
      const response = await changeLibraryAction(command, JSON.parse(key));
      if (!mounted.current || ticket !== generation.current.value) return null;
      if (!response.ok) {
        setError(response.code);
        if (response.code !== "NOT_AVAILABLE") retry.current = null;
        refreshAfter =
          response.code === "CONFLICT" ||
          response.code === "NOT_FOUND" ||
          response.code === "UNAUTHENTICATED" ||
          response.code === "FORBIDDEN";
        return null;
      }
      retry.current = null;
      setLoaded({ key, view: response.data.view, status: "ready", code: null });
      setNotice(true);
      window.dispatchEvent(new Event(eventName));
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(eventName);
        channel.postMessage("changed");
        channel.close();
      }
      return response.data.change;
    } catch {
      if (mounted.current && ticket === generation.current.value)
        setError("NOT_AVAILABLE");
      return null;
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
      if (
        mounted.current &&
        document.visibilityState === "visible" &&
        (refreshAfter || ticket !== generation.current.value)
      )
        await refreshCurrent.current();
    }
  }
  return {
    view: active?.view ?? null,
    status: active?.status ?? "loading",
    loadError: active?.code ?? null,
    busy,
    error,
    notice,
    refresh,
    execute,
    dismiss: () => {
      setError(null);
      setNotice(false);
    },
  };
}
export type LibraryController = ReturnType<typeof useLibraryController>;
