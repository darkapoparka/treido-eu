"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useClerk, useReverification } from "@clerk/nextjs";
import {
  changePromotionAction,
  readPromotionsAction,
  recoverPromotionAction,
} from "./actions";
import {
  parseCommand,
  type PromotionCommand,
  type PromotionView,
} from "./model";

/** Only unresolved exact commands are retained, scoped to this actor and seller; no mutable receipt replay. */
export function usePromotions(initial: PromotionView, subject: string) {
  const { isLoaded, isSignedIn, userId } = useAuth(),
    clerk = useClerk();
  const send = useReverification(changePromotionAction);
  const [view, setView] = useState(initial),
    [status, setStatus] = useState<"checking" | "ready" | "denied" | "failed">(
      "checking",
    ),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<PromotionCommand | null>(null);
  const life = useRef({ mounted: false, sequence: 0, busy: false }),
    attempt = useRef<PromotionCommand | null>(null);
  const key = "treido-promotion-pending-v1:" + initial.actorKey;
  const active = useCallback(
    () =>
      life.current.mounted &&
      clerk.user?.id === subject &&
      clerk.session?.status === "active",
    [clerk, subject],
  );
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* convenience only */
    }
    attempt.current = null;
    setPending(null);
  }, [key]);
  const refresh = useCallback(async () => {
    if (!active() || document.visibilityState !== "visible") return;
    const sessionId = clerk.session?.id,
      sequence = ++life.current.sequence;
    setStatus("checking");
    try {
      const result = await readPromotionsAction(initial.sellerId);
      if (
        !active() ||
        sessionId !== clerk.session?.id ||
        sequence !== life.current.sequence
      )
        return;
      if (!result.ok) {
        const denied = ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(
          result.code,
        );
        setStatus(denied ? "denied" : "failed");
        if (denied) clear();
        return;
      }
      if (
        result.data.subject !== subject ||
        result.data.view.actorKey !== initial.actorKey
      ) {
        clear();
        setStatus("denied");
        return;
      }
      // Restore only after current server authority is checked. In-memory unknown work wins over stored input.
      if (!attempt.current) {
        try {
          const text = sessionStorage.getItem(key);
          if (text && text.length <= 4096) {
            const restored = parseCommand(JSON.parse(text));
            if (
              restored.actorKey !== initial.actorKey ||
              restored.sellerId !== initial.sellerId
            )
              throw Error();
            attempt.current = restored;
            setPending(restored);
          }
        } catch {
          try {
            sessionStorage.removeItem(key);
          } catch {}
        }
      }
      setView(result.data.view);
      setStatus("ready");
    } catch {
      if (
        active() &&
        sessionId === clerk.session?.id &&
        sequence === life.current.sequence
      )
        setStatus("failed");
    }
  }, [active, clerk, initial.sellerId, initial.actorKey, key, subject, clear]);
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    let identity: string | null = null;
    const unsubscribe = clerk.addListener((resources) => {
      const next = [
        resources.user?.id ?? "",
        resources.session?.id ?? "",
        resources.session?.status ?? "",
      ].join(":");
      if (next === identity) return;
      identity = next;
      ++current.sequence;
      if (
        resources.user?.id !== subject ||
        resources.session?.status !== "active"
      ) {
        clear();
        setStatus("denied");
        setError(null);
      } else {
        void refresh();
      }
    });
    const hidden = () => {
      ++current.sequence;
      setStatus("checking");
    };
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") hidden();
      else visible();
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) visible();
    };
    window.addEventListener("focus", visible);
    window.addEventListener("blur", hidden);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      current.mounted = false;
      ++current.sequence;
      unsubscribe();
      window.removeEventListener("focus", visible);
      window.removeEventListener("blur", hidden);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [clerk, subject, clear, refresh]);
  const run = async (command: PromotionCommand, recover = false) => {
    if (life.current.busy || !active()) return;
    const sessionId = clerk.session?.id;
    life.current.busy = true;
    setBusy(true);
    setError(null);
    if (!recover) {
      attempt.current = command;
      setPending(command);
      try {
        sessionStorage.setItem(key, JSON.stringify(command));
      } catch {
        /* mounted exact command remains available */
      }
    }
    try {
      const result = recover
        ? await recoverPromotionAction(command)
        : await send(command);
      if (!active() || sessionId !== clerk.session?.id) return;
      if (!result.ok) {
        setError(result.code);
        if (
          ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(result.code)
        ) {
          clear();
          setStatus("denied");
        } else if (result.code !== "NOT_AVAILABLE") clear();
        return;
      }
      if (result.data.subject !== subject) {
        clear();
        setStatus("denied");
        return;
      }
      if (recover && result.data.ack === null) {
        setError("UNKNOWN");
        return;
      }
      clear();
      setError("ACCEPTED");
      await refresh();
    } catch {
      if (active() && sessionId === clerk.session?.id) setError("UNKNOWN");
    } finally {
      life.current.busy = false;
      if (life.current.mounted) setBusy(false);
    }
  };
  const sameActor = isLoaded && isSignedIn && userId === subject;
  return {
    view,
    status: sameActor
      ? status
      : isLoaded
        ? ("denied" as const)
        : ("checking" as const),
    error: sameActor ? error : null,
    busy,
    pending: sameActor ? pending : null,
    refresh,
    run,
    recover: () => (pending ? run(pending, true) : Promise.resolve()),
    retry: () => (pending ? run(pending) : Promise.resolve()),
  };
}
