"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { refreshSellerAccessAction } from "./setup-actions";
import { clearPrivateBuffers } from "./private-recovery";
import {
  retainsWorkspaceAccess,
  workspaceSnapshotVersion,
  type WorkspaceSellerAccess,
} from "./workspace-access";
import type { SellerCapability } from "./capabilities";

type AccessStatus = "ready" | "checking" | "denied" | "unavailable";
type AccessState = { status: AccessStatus; context: string | null };

/** Current session readiness never carries across seller, route or session changes. */
export function useWorkspaceAccess(
  actorSubject: string,
  sellerId: string | null,
  route: string,
  sellerAccess: readonly WorkspaceSellerAccess[],
  serverFrame: string,
) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const clerk = useClerk(),
    router = useRouter();
  const [access, setAccess] = useState<AccessState>({
    status: "checking",
    context: null,
  });
  const life = useRef({ mounted: false, generation: 0, visible: false });
  const retry = useRef<() => void>(() => {});
  const frameAuthority = useRef<{
    frame: string;
    context: string;
    needsFreshFrame: boolean;
  } | null>(null);
  const snapshotVersion = workspaceSnapshotVersion(sellerAccess);
  const context = [
    actorSubject,
    sellerId ?? "",
    route,
    clerk.session?.id ?? "",
    snapshotVersion,
    serverFrame,
  ].join("\0");
  const changedActor =
    isLoaded &&
    (!isSignedIn ||
      userId !== actorSubject ||
      clerk.user?.id !== actorSubject ||
      clerk.session?.status !== "active" ||
      !clerk.session?.id);

  useEffect(() => {
    const lifecycle = life.current,
      retryEntry = retry;
    const priorFrame = frameAuthority.current;
    if (!priorFrame || priorFrame.frame !== serverFrame)
      frameAuthority.current = {
        frame: serverFrame,
        context,
        needsFreshFrame: false,
      };
    else if (priorFrame.context !== context) {
      priorFrame.context = context;
      priorFrame.needsFreshFrame = true;
    }
    const original = (
      JSON.parse(snapshotVersion) as [string, SellerCapability[]][]
    ).map(([sellerId, capabilities]) => ({ sellerId, capabilities }));
    lifecycle.mounted = true;
    lifecycle.visible = document.visibilityState === "visible";
    let active = true,
      observed = false,
      previous: string | null = null;
    const conceal = () => {
      if (!active || !lifecycle.mounted) return;
      ++lifecycle.generation;
      if (frameAuthority.current?.frame === serverFrame)
        frameAuthority.current.needsFreshFrame = true;
      lifecycle.visible = false;
      setAccess({ status: "checking", context: null });
    };
    const current = () =>
      active &&
      lifecycle.mounted &&
      lifecycle.visible &&
      isLoaded &&
      isSignedIn &&
      userId === actorSubject &&
      document.visibilityState === "visible" &&
      clerk.user?.id === actorSubject &&
      clerk.session?.status === "active" &&
      !!clerk.session.id &&
      location.pathname +
        (location.search
          ? "?" + new URLSearchParams(location.search).toString()
          : "") ===
        route;
    const verify = async (refresh: boolean) => {
      if (!current()) return;
      const ticket = ++lifecycle.generation,
        sessionId = clerk.session?.id;
      const entry = [
        actorSubject,
        sellerId ?? "",
        route,
        sessionId ?? "",
        snapshotVersion,
        serverFrame,
      ].join("\0");
      const frame = frameAuthority.current;
      if (frame?.frame === serverFrame && frame.context !== entry) {
        frame.context = entry;
        frame.needsFreshFrame = true;
      }
      setAccess({ status: "checking", context: entry });
      const requestCurrent = () =>
        current() &&
        ticket === lifecycle.generation &&
        clerk.session?.id === sessionId;
      try {
        const result = await refreshSellerAccessAction(route);
        if (!requestCurrent()) return;
        if (!result.ok) {
          const denied = [
            "FORBIDDEN",
            "UNAUTHENTICATED",
            "NOT_FOUND",
            "INVALID_INPUT",
          ].includes(result.code);
          if (denied) clearPrivateBuffers(actorSubject, sellerId ?? undefined);
          setAccess({
            status: denied ? "denied" : "unavailable",
            context: entry,
          });
          return;
        }
        if (
          result.data.actorSubject !== actorSubject ||
          result.data.route !== route
        ) {
          clearPrivateBuffers(actorSubject, sellerId ?? undefined);
          setAccess({ status: "denied", context: entry });
          return;
        }
        if (
          refresh ||
          frameAuthority.current?.needsFreshFrame ||
          !retainsWorkspaceAccess(original, result.data.sellers)
        ) {
          // refresh() is not awaitable. Only a new serverFrame can release the
          // retained page and shell after their current projections arrive.
          setAccess({ status: "checking", context: entry });
          if (frameAuthority.current?.frame === serverFrame)
            frameAuthority.current.needsFreshFrame = true;
          router.refresh();
          return;
        }
        setAccess({ status: "ready", context: entry });
      } catch {
        if (requestCurrent())
          setAccess({ status: "unavailable", context: entry });
      }
    };
    const restore = () => {
      if (
        !active ||
        !lifecycle.mounted ||
        document.visibilityState !== "visible"
      )
        return;
      lifecycle.visible = true;
      void verify(true);
    };
    const restored = () => {
      conceal();
      restore();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") conceal();
      else restore();
    };
    const online = () => {
      if (lifecycle.visible) restore();
    };
    retryEntry.current = restore;
    const unsubscribe = clerk.addListener((resources) => {
      if (!active || !lifecycle.mounted) return;
      observed = true;
      const identity = [
        resources.user?.id ?? "",
        resources.session?.id ?? "",
        resources.session?.status ?? "",
      ].join("\0");
      if (identity === previous) return;
      const changed = previous !== null;
      previous = identity;
      if (changed) conceal();
      if (
        resources.user?.id !== actorSubject ||
        resources.session?.status !== "active" ||
        !resources.session?.id
      ) {
        ++lifecycle.generation;
        lifecycle.visible = false;
        if (isLoaded) clearPrivateBuffers(actorSubject);
        setAccess({ status: isLoaded ? "denied" : "checking", context: null });
      } else if (document.visibilityState === "visible") {
        lifecycle.visible = true;
        void verify(changed);
      }
    });
    if (!observed) void verify(false);
    window.addEventListener("focus", restore);
    window.addEventListener("blur", conceal);
    window.addEventListener("pageshow", restored);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      lifecycle.mounted = false;
      ++lifecycle.generation;
      retryEntry.current = () => {};
      unsubscribe();
      window.removeEventListener("focus", restore);
      window.removeEventListener("blur", conceal);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [
    actorSubject,
    sellerId,
    route,
    snapshotVersion,
    serverFrame,
    context,
    clerk,
    router,
    isLoaded,
    isSignedIn,
    userId,
  ]);

  const status: AccessStatus = !isLoaded
    ? "checking"
    : changedActor
      ? "denied"
      : access.context === context
        ? access.status
        : "checking";
  return { status, changedActor, isLoaded, retry: () => retry.current() };
}
