"use client";
import { useCallback, useSyncExternalStore } from "react";
const memory = new Map<string, string>();
const eventName = "treido-contact-recovery";
const empty = () => null;
/** Tab-local recoverable input for contact workflows, not server authority.
 * Each consumer validates its own bounded payload and scopes by actor/resource. */
export function useContactRecovery(scope: string) {
  const key = "treido-contact-v1:" + scope;
  const subscribe = useCallback(
    (notify: () => void) => {
      const changed = (event: Event) => {
        if (event instanceof StorageEvent) {
          if (event.key !== key && event.key !== null) return;
          memory.delete(key);
          notify();
        } else if (event instanceof CustomEvent && event.detail === key)
          notify();
      };
      window.addEventListener(eventName, changed);
      window.addEventListener("storage", changed);
      return () => {
        window.removeEventListener(eventName, changed);
        window.removeEventListener("storage", changed);
      };
    },
    [key],
  );
  const snapshot = useCallback(() => {
    // A failed storage write must not make an older stored value hide newer input.
    const local = memory.get(key);
    if (local !== undefined) return local;
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, empty);
  const write = useCallback(
    (value: unknown): boolean => {
      const encoded = JSON.stringify(value);
      if (encoded.length > 24000)
        throw new Error("Contact draft exceeds its local limit.");
      memory.set(key, encoded);
      let persisted = false;
      try {
        sessionStorage.setItem(key, encoded);
        persisted = sessionStorage.getItem(key) === encoded;
      } catch {}
      window.dispatchEvent(new CustomEvent(eventName, { detail: key }));
      return persisted;
    },
    [key],
  );
  const clear = useCallback(() => {
    memory.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {}
    window.dispatchEvent(new CustomEvent(eventName, { detail: key }));
  }, [key]);
  return { raw, write, clear };
}
