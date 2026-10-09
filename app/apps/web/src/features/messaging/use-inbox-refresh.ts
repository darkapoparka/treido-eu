"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import type { SellerResult } from "../sellers/errors";
import { inboxLimits } from "./inbox-model";
type Status = "ready" | "checking" | "unavailable" | "denied";

/** Qualify the current session before exposing accepted private projections. */
export function useInboxRefresh<T>(
  initial: T,
  actorSubject: string,
  load: () => Promise<SellerResult<T>>,
) {
  const auth = useAuth(),
    clerk = useClerk();
  const sessionId = auth.isLoaded ? auth.sessionId : null;
  const sameActor =
    auth.isLoaded &&
    auth.isSignedIn &&
    auth.userId === actorSubject &&
    clerk.user?.id === actorSubject;
  const entry =
    typeof location === "undefined" ? "" : location.pathname + location.search;
  const context = [actorSubject, sessionId ?? "", entry].join("\0");
  const [snapshot, setSnapshot] = useState({
    data: initial,
    source: initial,
    loader: load,
    user: clerk.user,
    session: clerk.session,
    context: null as string | null,
    status: "checking" as Status,
  });
  const life = useRef({
    mounted: false,
    visible: false,
    generation: 0,
    read: 0,
    busy: false,
    source: initial,
    loader: load,
    context,
  });
  const active = useCallback(
    () =>
      life.current.mounted &&
      life.current.visible &&
      sameActor &&
      !!sessionId &&
      document.visibilityState === "visible" &&
      clerk.user?.id === actorSubject &&
      clerk.session?.id === sessionId &&
      clerk.session.status === "active" &&
      location.pathname + location.search === entry,
    [sameActor, sessionId, clerk, actorSubject, entry],
  );
  const refresh = useCallback(
    async (foreground = false) => {
      const current = life.current;
      if (!current.mounted || document.visibilityState !== "visible") return;
      if (
        current.source !== initial ||
        current.loader !== load ||
        current.context !== context
      )
        return;
      // Explicit visible Retry recovers after blur even without a focus event.
      if (foreground) current.visible = true;
      if (!active() || (current.busy && !foreground)) return;
      const generation = current.generation,
        sequence = ++current.read,
        user = clerk.user,
        session = clerk.session;
      current.busy = true;
      const requestCurrent = () =>
        active() &&
        clerk.user === user &&
        clerk.session === session &&
        current.source === initial &&
        current.loader === load &&
        current.context === context &&
        generation === current.generation &&
        sequence === current.read;
      setSnapshot((previous) => ({
        data:
          previous.source === initial && previous.loader === load
            ? previous.data
            : initial,
        source: initial,
        loader: load,
        user,
        session,
        context,
        status:
          !foreground &&
          previous.context === context &&
          previous.source === initial &&
          previous.loader === load &&
          previous.status === "ready"
            ? "ready"
            : "checking",
      }));
      try {
        const result = await load();
        if (!requestCurrent()) return;
        setSnapshot((previous) => ({
          ...previous,
          data: result.ok ? result.data : previous.data,
          context,
          source: initial,
          loader: load,
          user,
          session,
          status: result.ok
            ? "ready"
            : [
                  "FORBIDDEN",
                  "NOT_FOUND",
                  "UNAUTHENTICATED",
                  "INVALID_INPUT",
                ].includes(result.code)
              ? "denied"
              : "unavailable",
        }));
      } catch {
        if (requestCurrent())
          setSnapshot((previous) => ({ ...previous, status: "unavailable" }));
      } finally {
        if (generation === current.generation && sequence === current.read)
          current.busy = false;
      }
    },
    [active, context, initial, load, clerk.user, clerk.session],
  );
  // A retained child callback can run during a new frame's layout commit,
  // before passive subscriptions restart. Only the committed frame may read.
  useLayoutEffect(() => {
    const current = life.current;
    current.source = initial;
    current.loader = load;
    current.context = context;
  }, [initial, load, context]);
  useEffect(() => {
    const current = life.current;
    let mounted = true;
    current.mounted = true;
    current.visible = false;
    ++current.generation;
    ++current.read;
    current.busy = false;
    const conceal = () => {
      if (!mounted) return;
      ++current.generation;
      ++current.read;
      current.visible = false;
      current.busy = false;
      setSnapshot((previous) => ({
        ...previous,
        context: null,
        status: "checking",
      }));
    };
    const restore = () => {
      if (!mounted || document.visibilityState !== "visible") return;
      current.visible = true;
      void refresh(true);
    };
    const signature = () =>
      [
        clerk.user?.id ?? "",
        clerk.session?.id ?? "",
        clerk.session?.status ?? "",
      ].join("\0");
    let previous = signature(),
      previousUser = clerk.user,
      previousSession = clerk.session;
    const unsubscribe = clerk.addListener(() => {
      if (!mounted) return;
      const next = signature();
      if (
        next !== previous ||
        clerk.user !== previousUser ||
        clerk.session !== previousSession
      ) {
        previous = next;
        previousUser = clerk.user;
        previousSession = clerk.session;
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
    const visible = () =>
      document.visibilityState === "visible" ? restore() : conceal();
    const restored = () => {
      conceal();
      restore();
    };
    const timer = setInterval(() => {
      if (mounted && current.visible && document.hasFocus()) void refresh();
    }, inboxLimits.pollMs);
    window.addEventListener("focus", restore);
    window.addEventListener("blur", conceal);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted = false;
      current.mounted = false;
      current.visible = false;
      ++current.generation;
      ++current.read;
      current.busy = false;
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener("focus", restore);
      window.removeEventListener("blur", conceal);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [clerk, refresh, initial, load, context]);
  const qualified =
    sameActor &&
    !!sessionId &&
    clerk.session?.id === sessionId &&
    clerk.session.status === "active" &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    snapshot.context === context &&
    snapshot.user === clerk.user &&
    snapshot.session === clerk.session &&
    snapshot.source === initial &&
    snapshot.loader === load;
  return {
    data: snapshot.source === initial ? snapshot.data : initial,
    status: !auth.isLoaded
      ? ("checking" as const)
      : !sameActor || !sessionId || clerk.session?.status !== "active"
        ? ("denied" as const)
        : qualified
          ? snapshot.status
          : ("checking" as const),
    refresh,
  };
}
