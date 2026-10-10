"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { changeOfferAction, recoverOfferAction } from "./actions";
import type { OfferOperation, OfferView } from "./model";
import {
  parseOfferMutation,
  restoreOfferMutation,
  type OfferMutation,
} from "./recovery-model";

const eventName = "treido-offer-request-v1";
function subscribe(listener: () => void) {
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", listener);
  };
}
type Status = "ready" | "checking" | "unavailable" | "denied";
type Notice = "applied" | "recorded" | "not_applied" | "unrecorded" | null;
export function useOfferRequest({
  actorSubject,
  sellerId,
  threadId,
  data,
  status,
  onSettled,
}: {
  actorSubject: string;
  sellerId: string | null;
  threadId: string;
  data: OfferView | null;
  status: Status;
  onSettled: (state: "applied" | "recorded" | "not_applied") => void;
}) {
  const auth = useAuth(),
    clerk = useClerk();
  const actorKey = data?.actorKey ?? null;
  const sessionId = auth.isLoaded ? auth.sessionId : null;
  const entry =
    typeof location === "undefined" ? "" : location.pathname + location.search;
  const key = actorKey
    ? `treido-offer:v1:${actorKey}:${sellerId ?? "buyer"}:${threadId}`
    : null;
  // Object identity is intentional: a ready -> denied -> ready round trip or a
  // replacement Clerk resource must never revive a callback from the old frame.
  const frame = useMemo(
    () => ({
      actorSubject,
      sellerId,
      threadId,
      actorKey,
      sessionId,
      entry,
      data,
      status,
      user: clerk.user,
      session: clerk.session,
    }),
    [
      actorSubject,
      sellerId,
      threadId,
      actorKey,
      sessionId,
      entry,
      data,
      status,
      clerk.user,
      clerk.session,
    ],
  );
  const life = useRef<{
    frame: typeof frame | null;
    generation: number;
    qualified: boolean;
    busy: symbol | null;
  }>({ frame: null, generation: 0, qualified: false, busy: null });
  const memory = useRef(
    new Map<string, { raw: string | null; persisted: boolean }>(),
  );
  const [result, setResult] = useState<{
    frame: typeof frame;
    pending: boolean;
    notice: Notice;
    error: string | null;
  } | null>(null);
  const read = useCallback(() => {
    if (!key) return null;
    const remembered = memory.current.get(key);
    if (remembered && !remembered.persisted) return remembered.raw;
    try {
      return sessionStorage.getItem(key);
    } catch {
      return remembered?.raw ?? null;
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const original = actorKey
    ? restoreOfferMutation(raw, { actorKey, sellerId, threadId })
    : null;
  useLayoutEffect(() => {
    const current = life.current;
    current.frame = frame;
    current.generation++;
    current.busy = null;
    current.qualified = status === "ready" && data?.threadId === threadId;
    return () => {
      current.frame = null;
      current.qualified = false;
      current.generation++;
      current.busy = null;
    };
  }, [frame, status, data, threadId]);
  useEffect(() => {
    const retire = () => {
      life.current.generation++;
      life.current.qualified = false;
      life.current.busy = null;
    };
    let previousUser = clerk.user,
      previousSession = clerk.session;
    let previousSignature = `${clerk.user?.id}:${clerk.session?.id}:${clerk.session?.status}`;
    const unsubscribe = clerk.addListener(() => {
      const signature = `${clerk.user?.id}:${clerk.session?.id}:${clerk.session?.status}`;
      if (
        signature !== previousSignature ||
        previousUser !== clerk.user ||
        previousSession !== clerk.session
      ) {
        previousSignature = signature;
        previousUser = clerk.user;
        previousSession = clerk.session;
        retire();
      }
    });
    const visibility = () => {
      if (document.visibilityState !== "visible") retire();
    };
    window.addEventListener("blur", retire);
    window.addEventListener("pagehide", retire);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      unsubscribe();
      window.removeEventListener("blur", retire);
      window.removeEventListener("pagehide", retire);
      document.removeEventListener("visibilitychange", visibility);
      retire();
    };
  }, [clerk]);
  function current() {
    return (
      life.current.frame === frame &&
      life.current.qualified &&
      status === "ready" &&
      !!key &&
      !!actorKey &&
      auth.isLoaded &&
      auth.isSignedIn &&
      auth.userId === actorSubject &&
      !!sessionId &&
      clerk.user === frame.user &&
      clerk.user?.id === actorSubject &&
      clerk.session === frame.session &&
      clerk.session?.id === sessionId &&
      clerk.session.status === "active" &&
      document.visibilityState === "visible" &&
      location.pathname + location.search === entry &&
      data?.threadId === threadId &&
      data.side === (sellerId ? "seller" : "buyer")
    );
  }
  function remember(value: OfferMutation | null) {
    if (!key) return;
    const record = {
      raw: value ? JSON.stringify(value) : null,
      persisted: false,
    };
    memory.current.set(key, record);
    try {
      if (record.raw) sessionStorage.setItem(key, record.raw);
      else sessionStorage.removeItem(key);
      record.persisted = true;
    } catch {
      /* In-memory exact replay remains available. */
    }
    window.dispatchEvent(new Event(eventName));
  }
  function clearOriginal(request: OfferMutation) {
    if (!actorKey) return;
    const stored = restoreOfferMutation(read(), {
      actorKey,
      sellerId,
      threadId,
    });
    if (stored?.command.requestId === request.command.requestId) remember(null);
  }
  function execute(request: OfferMutation, mode: "apply" | "recover") {
    if (!current() || life.current.busy) return;
    const token = Symbol("offer request"),
      generation = life.current.generation;
    life.current.busy = token;
    setResult({ frame, pending: true, notice: null, error: null });
    const owns = () =>
      current() &&
      life.current.generation === generation &&
      life.current.busy === token;
    void (async () => {
      try {
        if (mode === "apply") {
          const response = await changeOfferAction(request);
          if (!owns()) return;
          if (!response.ok) {
            setResult({
              frame,
              pending: false,
              notice: null,
              error: response.code,
            });
            return;
          }
          if (
            response.data.actorKey !== request.actorKey ||
            response.data.threadId !== threadId
          ) {
            setResult({
              frame,
              pending: false,
              notice: null,
              error: "NOT_AVAILABLE",
            });
            return;
          }
          clearOriginal(request);
          setResult({ frame, pending: false, notice: "applied", error: null });
          onSettled("applied");
        } else {
          const response = await recoverOfferAction(request);
          if (!owns()) return;
          if (!response.ok) {
            setResult({
              frame,
              pending: false,
              notice: null,
              error: response.code,
            });
            return;
          }
          const receipt = response.data;
          if (
            receipt.actorKey !== request.actorKey ||
            receipt.threadId !== threadId ||
            receipt.sellerId !== sellerId ||
            receipt.requestId !== request.command.requestId
          ) {
            setResult({
              frame,
              pending: false,
              notice: null,
              error: "NOT_AVAILABLE",
            });
            return;
          }
          if (receipt.state !== "unrecorded") clearOriginal(request);
          setResult({
            frame,
            pending: false,
            notice: receipt.state,
            error: null,
          });
          if (receipt.state !== "unrecorded") onSettled(receipt.state);
        }
      } catch {
        if (owns())
          setResult({
            frame,
            pending: false,
            notice: null,
            error: "NOT_AVAILABLE",
          });
      } finally {
        if (life.current.busy === token) life.current.busy = null;
      }
    })();
  }
  function submit(operation: OfferOperation, expectedRevision: number) {
    if (
      !current() ||
      !actorKey ||
      life.current.busy ||
      restoreOfferMutation(read(), { actorKey, sellerId, threadId })
    )
      return;
    const request = parseOfferMutation({
      actorKey,
      command: {
        sellerId,
        threadId,
        requestId: crypto.randomUUID(),
        expectedRevision,
        operation,
      },
    });
    remember(request);
    execute(request, "apply");
  }
  function recover(mode: "apply" | "recover") {
    if (!current() || !actorKey) return;
    const request = restoreOfferMutation(read(), {
      actorKey,
      sellerId,
      threadId,
    });
    if (request) execute(request, mode);
  }
  const visible = result?.frame === frame && status === "ready" ? result : null;
  return {
    original: status === "ready" ? original : null,
    pending: visible?.pending ?? false,
    notice: visible?.notice ?? null,
    error: visible?.error ?? null,
    blocked: !!original || (visible?.pending ?? false),
    submit,
    checkOriginal: () => recover("recover"),
    retryOriginal: () => recover("apply"),
    clearNotice: () => {
      if (current())
        setResult({ frame, pending: false, notice: null, error: null });
    },
  };
}
