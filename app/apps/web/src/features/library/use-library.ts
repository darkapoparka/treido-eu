"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { changeLibraryAction, readLibraryAction } from "./actions";
import type {
  LibraryChange,
  LibraryCommand,
  LibraryOperation,
  LibraryQuery,
  LibraryView,
} from "./model";
import type { SellerErrorCode } from "../sellers/errors";
import { usePrivateScope } from "./session-boundary";
import { acceptsPrivateResult } from "./private-session";

type Loaded = {
  key: string;
  view: LibraryView | null;
  status: "ready" | "guest" | "error";
  code: SellerErrorCode | null;
};
const eventName = "treido-library-changed";
/** Component memory is only a projection. PostgreSQL owns every mutation and retry receipt. */
export function useLibraryController(query: Partial<LibraryQuery>) {
  const scope = usePrivateScope();
  const queryKey = JSON.stringify(query),
    key = scope.key + ":" + queryKey;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [feedback, setFeedback] = useState<{
    key: string;
    busy: boolean;
    error: SellerErrorCode | null;
    notice: boolean;
  }>({ key, busy: false, error: null, notice: false });
  const lifetime = useRef({
    key,
    identityKey: scope.identityKey,
    generation: 0,
    working: 0,
    retry: null as { fingerprint: string; command: LibraryCommand } | null,
  });
  const mounted = useRef(false);
  // Render only matching projections below. Reset command state at commit, not
  // during a render that React may interrupt or discard.
  useLayoutEffect(() => {
    const state = lifetime.current;
    if (state.key !== key) {
      state.key = key;
      ++state.generation;
      state.working = 0;
      if (state.identityKey !== scope.identityKey) state.retry = null;
      state.identityKey = scope.identityKey;
    }
  }, [key, scope.identityKey]);
  const active = loaded?.key === key && scope.isCurrent() ? loaded : null;
  const current = useCallback(
    (ticket: number) =>
      mounted.current &&
      lifetime.current.key === key &&
      lifetime.current.generation === ticket &&
      scope.isCurrent(),
    [key, scope],
  );
  const refresh = useCallback(async () => {
    if (!scope.isCurrent() || !scope.subject) return;
    const ticket = ++lifetime.current.generation;
    let response;
    try {
      response = await readLibraryAction(JSON.parse(queryKey));
    } catch {
      response = {
        ok: false,
        subject: scope.subject,
        code: "NOT_AVAILABLE",
      } as const;
    }
    if (!current(ticket)) return;
    if (!acceptsPrivateResult(scope, response)) {
      const signedOut = !response.ok && response.code === "UNAUTHENTICATED";
      setLoaded({
        key,
        view: null,
        status: signedOut ? "guest" : "error",
        code: signedOut ? "UNAUTHENTICATED" : "NOT_AVAILABLE",
      });
      return;
    }
    if (response.ok)
      setLoaded({ key, view: response.data, status: "ready", code: null });
    else
      setLoaded({
        key,
        view: null,
        status: response.code === "UNAUTHENTICATED" ? "guest" : "error",
        code: response.code,
      });
  }, [key, queryKey, scope, current]);
  useEffect(() => {
    mounted.current = true;
    const state = lifetime.current;
    const update = () => {
      if (!lifetime.current.working && scope.isCurrent()) void refresh();
    };
    const initial = window.setTimeout(update, 0);
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(eventName);
    if (channel) channel.onmessage = update;
    window.addEventListener("online", update);
    window.addEventListener(eventName, update);
    const timer = window.setInterval(update, 30000);
    return () => {
      mounted.current = false;
      ++state.generation;
      clearTimeout(initial);
      channel?.close();
      clearInterval(timer);
      window.removeEventListener("online", update);
      window.removeEventListener(eventName, update);
    };
  }, [refresh, scope]);
  async function execute(
    operation: LibraryOperation,
  ): Promise<LibraryChange | null> {
    if (!scope.isCurrent() || lifetime.current.key !== key) return null;
    if (lifetime.current.working) return null;
    if (!scope.subject || !active?.view) {
      setFeedback({
        key,
        busy: false,
        error:
          scope.key === "unconfigured"
            ? "NOT_AVAILABLE"
            : !scope.subject || active?.status === "guest"
              ? "UNAUTHENTICATED"
              : "NOT_AVAILABLE",
        notice: false,
      });
      return null;
    }
    const ticket = ++lifetime.current.generation;
    lifetime.current.working = ticket;
    setFeedback({ key, busy: true, error: null, notice: false });
    const fingerprint = active.view.actorKey + ":" + JSON.stringify(operation);
    const command =
      lifetime.current.retry?.fingerprint === fingerprint
        ? lifetime.current.retry.command
        : {
            requestId: crypto.randomUUID(),
            actorKey: active.view.actorKey,
            expectedRevision: active.view.revision,
            operation,
          };
    lifetime.current.retry = { fingerprint, command };
    let refreshAfter = false;
    try {
      // A stale closure must never dispatch or recover a command in a later scope.
      if (!current(ticket)) return null;
      const response = await changeLibraryAction(
        command,
        JSON.parse(queryKey),
        scope.subject,
      );
      if (!current(ticket)) return null;
      if (!acceptsPrivateResult(scope, response)) {
        lifetime.current.retry = null;
        setLoaded(null);
        if (!response.ok && response.code === "UNAUTHENTICATED")
          setFeedback({ key, busy: true, error: response.code, notice: false });
        refreshAfter = true;
        return null;
      }
      if (!response.ok) {
        setFeedback({ key, busy: true, error: response.code, notice: false });
        if (response.code !== "NOT_AVAILABLE") lifetime.current.retry = null;
        refreshAfter = [
          "CONFLICT",
          "NOT_FOUND",
          "UNAUTHENTICATED",
          "FORBIDDEN",
        ].includes(response.code);
        return null;
      }
      lifetime.current.retry = null;
      setLoaded({ key, view: response.data.view, status: "ready", code: null });
      setFeedback({ key, busy: true, error: null, notice: true });
      window.dispatchEvent(new Event(eventName));
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(eventName);
        channel.postMessage("changed");
        channel.close();
      }
      return response.data.change;
    } catch {
      if (current(ticket))
        setFeedback({ key, busy: true, error: "NOT_AVAILABLE", notice: false });
      return null;
    } finally {
      if (current(ticket)) {
        lifetime.current.working = 0;
        setFeedback((value) =>
          value.key === key ? { ...value, busy: false } : value,
        );
        if (refreshAfter) await refresh();
      }
    }
  }
  const visibleFeedback =
    feedback.key === key && scope.isCurrent() ? feedback : null;
  return {
    scopeKey: scope.key,
    view: active?.view ?? null,
    status:
      active?.status ??
      (scope.key === "unconfigured"
        ? "error"
        : scope.isCurrent() && !scope.subject
          ? "guest"
          : "loading"),
    loadError:
      active?.code ?? (scope.key === "unconfigured" ? "NOT_AVAILABLE" : null),
    busy: visibleFeedback?.busy ?? false,
    error: visibleFeedback?.error ?? null,
    notice: visibleFeedback?.notice ?? false,
    refresh,
    execute,
    dismiss: () =>
      setFeedback({ key, busy: false, error: null, notice: false }),
  };
}
export type LibraryController = ReturnType<typeof useLibraryController>;
