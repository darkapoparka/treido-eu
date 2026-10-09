"use client";
import { useMemo, useSyncExternalStore } from "react";
import { readProductMiniVisits, type ProductMiniId } from "./tool-catalog";

const key = "treido:buyer:mini-visits:v1";
const listeners = new Set<() => void>();
let memory: string | null = null;
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function snapshot() {
  if (memory !== null) return memory;
  try {
    return sessionStorage.getItem(key) ?? "[]";
  } catch {
    return "[]";
  }
}
const serverSnapshot = () => "[]";

export function useProductMiniVisits() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const visits = useMemo(() => readProductMiniVisits(raw), [raw]);
  return {
    visits,
    visit(id: ProductMiniId) {
      const previous = readProductMiniVisits(snapshot());
      memory = JSON.stringify([id, ...previous.filter((item) => item !== id)]);
      try {
        sessionStorage.setItem(key, memory);
      } catch {
        /* Disabled storage keeps ordinary in-tab navigation usable. */
      }
      for (const listener of listeners) listener();
    },
  };
}
