"use client";
import { ClerkProvider, useAuth, useClerk } from "@clerk/nextjs";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import type { PrivateScope } from "./private-session";

let epoch = 0;
const listeners = new Set<() => void>();
function invalidate() {
  ++epoch;
  // Conceal private DOM in the visibility/focus event, before the next paint.
  flushSync(() => listeners.forEach((listener) => listener()));
}
function subscribe(listener: () => void) {
  if (!listeners.size) {
    document.addEventListener("visibilitychange", invalidate);
    window.addEventListener("focus", invalidate);
    window.addEventListener("pageshow", invalidate);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      document.removeEventListener("visibilitychange", invalidate);
      window.removeEventListener("focus", invalidate);
      window.removeEventListener("pageshow", invalidate);
    }
  };
}
function snapshot() {
  return epoch;
}
function serverSnapshot() {
  return 0;
}
const guest: PrivateScope = {
  key: "unconfigured",
  identityKey: "unconfigured",
  subject: null,
  isCurrent: () => true,
};
const Context = createContext<PrivateScope>(guest);
export function usePrivateScope() {
  return useContext(Context);
}
function SessionBridge({ children }: { children: ReactNode }) {
  const auth = useAuth({ treatPendingAsSignedOut: true });
  const clerk = useClerk();
  useEffect(() => {
    const signature = () =>
      JSON.stringify([
        clerk.user?.id,
        clerk.session?.id,
        clerk.session?.status,
      ]);
    let previous = signature();
    // Clerk's resource listener runs when the actual active session changes.
    // Conceal even if the context's useAuth update has not committed yet.
    return clerk.addListener(() => {
      const next = signature();
      if (next !== previous) {
        previous = next;
        invalidate();
      }
    });
  }, [clerk]);
  const revision = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const visible =
    typeof document === "undefined" || document.visibilityState === "visible";
  const subject = auth.isLoaded && auth.isSignedIn ? auth.userId : null;
  const sessionId = auth.isLoaded && auth.isSignedIn ? auth.sessionId : null;
  const scope = useMemo<PrivateScope>(
    () => ({
      key: JSON.stringify([
        auth.isLoaded,
        subject,
        sessionId,
        revision,
        visible,
      ]),
      identityKey: JSON.stringify([auth.isLoaded, subject, sessionId]),
      subject,
      isCurrent: () =>
        typeof document !== "undefined" &&
        auth.isLoaded &&
        visible &&
        revision === epoch &&
        document.visibilityState === "visible" &&
        (subject === null
          ? !clerk.session || clerk.session.status !== "active"
          : clerk.user?.id === subject &&
            clerk.session?.id === sessionId &&
            clerk.session.status === "active"),
    }),
    [auth.isLoaded, subject, sessionId, revision, visible, clerk],
  );
  return <Context.Provider value={scope}>{children}</Context.Provider>;
}
export function BuyerSessionBoundary({ children }: { children: ReactNode }) {
  const existing = useContext(Context);
  if (existing !== guest) return children;
  // Match the existing guarded session layouts. No keyless provider in reference/unconfigured mode.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return children;
  // The Next SDK explicitly reuses an ancestor Next provider without initialState.
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <SessionBridge>{children}</SessionBridge>
    </ClerkProvider>
  );
}
