"use client";
import { useMemo, useSyncExternalStore } from "react";
import {
  decodeSavedCollections,
  savedCollectionsReducer,
  type SavedCollectionsAction,
  type SavedCollectionsState,
} from "./saved-model";

const memory = new Map<string, string>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Tab-local reference state only, never account or provider persistence. Seeded
// source histories stay isolated; the server snapshot is hydration-safe.
export function useSavedCollections(initial: SavedCollectionsState) {
  const fallback = JSON.stringify(initial);
  function key() {
    const scenario =
      document.documentElement.dataset.referenceScenario ?? "default";
    return `treido:reference:saved:v1:${scenario}:${fallback}`;
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
    () =>
      decodeSavedCollections(
        raw,
        JSON.parse(fallback) as SavedCollectionsState,
      ),
    [raw, fallback],
  );
  function dispatch(action: SavedCollectionsAction) {
    const current = decodeSavedCollections(snapshot(), initial);
    const next = JSON.stringify(savedCollectionsReducer(current, action));
    memory.set(key(), next);
    try {
      sessionStorage.setItem(key(), next);
    } catch {
      /* Disabled/full storage must not break ordinary in-tab actions. */
    }
    for (const listener of listeners) listener();
  }
  return [state, dispatch] as const;
}
