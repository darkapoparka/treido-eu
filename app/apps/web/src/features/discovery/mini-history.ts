"use client";
import { useMemo, useSyncExternalStore } from "react";
import { findMini } from "./mini-model";

const empty: readonly string[] = [];
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function decode(raw: string, fallback: string): string[] {
  try {
    if (raw.length > 2048) return decode(fallback, "[]");
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return decode(fallback, "[]");
    return [...new Set(value)].filter(
      (id): id is string => typeof id === "string" && !!findMini(id),
    );
  } catch {
    return raw === fallback ? [] : decode(fallback, "[]");
  }
}

// Tab-local presentation history, never a Mini/provider request. The frozen
// scenario and seed are separate namespaces, so one source history cannot leak
// into another. The server snapshot stays deterministic during hydration.
export function useMiniHistory(initial: readonly string[] = empty) {
  const fallback = JSON.stringify(initial.filter((id) => !!findMini(id)));
  function key() {
    const scenario =
      document.documentElement.dataset.referenceScenario ?? "default";
    return `treido:reference:mini-visits:v1:${scenario}:${fallback}`;
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
  const visitedMinis = useMemo(() => decode(raw, fallback), [raw, fallback]);
  return {
    visitedMinis,
    visitMini(id: string) {
      if (!findMini(id)) return;
      const current = decode(snapshot(), fallback);
      const next = JSON.stringify([
        id,
        ...current.filter((item) => item !== id),
      ]);
      memory.set(key(), next);
      try {
        sessionStorage.setItem(key(), next);
      } catch {
        // Storage may be disabled. Keep ordinary in-tab navigation functional.
      }
      for (const listener of listeners) listener();
    },
  };
}
