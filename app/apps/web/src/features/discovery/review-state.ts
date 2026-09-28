"use client";
import { useSyncExternalStore } from "react";

type ReviewFeedback = {
  helpful: readonly string[];
  expanded: readonly string[];
  reported: Readonly<Record<string, string>>;
};
const empty: ReviewFeedback = { helpful: [], expanded: [], reported: {} };
const records = new Map<string, ReviewFeedback>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Presentation-only feedback for this browser runtime. No provider request,
// durable moderation record or shared server mutation. Product and store scopes
// cannot overwrite each other when their captured record IDs happen to match.
export function useReviewFeedback(scope: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => records.get(scope) ?? empty,
    () => empty,
  );
  function update(change: (current: ReviewFeedback) => ReviewFeedback) {
    if (typeof window === "undefined") return;
    const current = records.get(scope) ?? empty;
    const next = change(current);
    if (next === current) return;
    records.set(scope, next);
    for (const listener of listeners) listener();
  }
  return {
    ...value,
    toggleHelpful(id: string) {
      update((current) =>
        current.reported[id]
          ? current
          : {
              ...current,
              helpful: current.helpful.includes(id)
                ? current.helpful.filter((item) => item !== id)
                : [...current.helpful, id],
            },
      );
    },
    toggleExpanded(id: string) {
      update((current) => ({
        ...current,
        expanded: current.expanded.includes(id)
          ? current.expanded.filter((item) => item !== id)
          : [...current.expanded, id],
      }));
    },
    markReported(id: string, reason: string) {
      if (!reason.trim()) return;
      update((current) => ({
        ...current,
        reported: { ...current.reported, [id]: reason },
      }));
    },
  };
}
