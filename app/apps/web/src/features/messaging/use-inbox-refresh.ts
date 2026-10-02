"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { SellerResult } from "../sellers/errors";
import { inboxLimits } from "./inbox-model";
/** Poll only the visible workspace; late replies cannot repopulate a departed scope. */
export function useInboxRefresh<T>(
  initial: T,
  actorSubject: string,
  load: () => Promise<SellerResult<T>>,
) {
  const auth = useAuth();
  const sameActor =
    auth.isLoaded && auth.isSignedIn && auth.userId === actorSubject;
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState<
    "ready" | "checking" | "unavailable" | "denied"
  >("ready");
  const epoch = useRef({ value: 0 }),
    live = useRef(false),
    busy = useRef(false);
  const refresh = useCallback(
    async (foreground = false) => {
      if (!live.current || !sameActor || document.visibilityState !== "visible")
        return;
      if (busy.current && !foreground) return;
      const version = ++epoch.current.value;
      busy.current = true;
      if (foreground) setStatus("checking");
      try {
        const result = await load();
        if (!live.current || version !== epoch.current.value) return;
        if (result.ok) {
          setData(result.data);
          setStatus("ready");
        } else
          setStatus(
            [
              "FORBIDDEN",
              "NOT_FOUND",
              "UNAUTHENTICATED",
              "INVALID_INPUT",
            ].includes(result.code)
              ? "denied"
              : "unavailable",
          );
      } catch {
        if (live.current && version === epoch.current.value)
          setStatus("unavailable");
      } finally {
        if (version === epoch.current.value) busy.current = false;
      }
    },
    [load, sameActor],
  );
  useEffect(() => {
    const generation = epoch.current;
    live.current = true;
    const visible = () => {
      if (document.visibilityState === "visible") void refresh(true);
      else {
        ++epoch.current.value;
        busy.current = false;
        setStatus("checking");
      }
    };
    const blur = () => {
      ++epoch.current.value;
      busy.current = false;
      setStatus("checking");
    };
    const timer = setInterval(() => {
      if (document.hasFocus()) void refresh();
    }, inboxLimits.pollMs);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    window.addEventListener("blur", blur);
    const initialRequest = setTimeout(() => void refresh(), 0);
    return () => {
      clearTimeout(initialRequest);
      live.current = false;
      ++generation.value;
      busy.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
      window.removeEventListener("blur", blur);
    };
  }, [refresh]);
  return {
    data,
    status:
      auth.isLoaded && !sameActor
        ? ("denied" as const)
        : !auth.isLoaded
          ? ("checking" as const)
          : status,
    refresh,
  };
}
