"use client";
import { useMemo, useSyncExternalStore } from "react";
import {
  cartReducer,
  decodeCart,
  type CartAction,
  type CartState,
} from "./cart-model";

const memory = new Map<string, string>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Use the same tab/scenario/seed boundary as Saved. Server rendering always
// starts from its deterministic seed; client hydration restores local edits.
export function useCartHistory(initial: CartState) {
  const fallback = JSON.stringify(initial);
  function key() {
    const scenario =
      document.documentElement.dataset.referenceScenario ?? "default";
    return `treido:reference:cart:v1:${scenario}:${fallback}`;
  }
  function snapshot() {
    const name = key();
    const cached = memory.get(name);
    if (cached !== undefined) return cached;
    try {
      return sessionStorage.getItem(name) ?? fallback;
    } catch {
      return fallback;
    }
  }
  const raw = useSyncExternalStore(subscribe, snapshot, () => fallback);
  const state = useMemo(
    () => decodeCart(raw, JSON.parse(fallback) as CartState),
    [raw, fallback],
  );
  function dispatch(action: CartAction) {
    const next = JSON.stringify(
      cartReducer(decodeCart(snapshot(), initial), action),
    );
    memory.set(key(), next);
    try {
      sessionStorage.setItem(key(), next);
    } catch {
      /* Storage denial must not break ordinary in-tab actions. */
    }
    for (const listener of listeners) listener();
  }
  return [state, dispatch] as const;
}
