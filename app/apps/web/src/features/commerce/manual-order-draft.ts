"use client";

import { useMemo, useSyncExternalStore } from "react";

type ManualOrderDraft = { tracking: string; name: string; carrier: string };
const empty: ManualOrderDraft = { tracking: "", name: "", carrier: "" };
const emptySnapshot = JSON.stringify(empty);
const eventName = "shop-manual-order-draft";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(eventName, listener);
  };
}

function decode(raw: string): ManualOrderDraft {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "tracking" in value &&
      typeof value.tracking === "string" &&
      "name" in value &&
      typeof value.name === "string" &&
      "carrier" in value &&
      typeof value.carrier === "string"
    )
      return {
        tracking: value.tracking,
        name: value.name,
        carrier: value.carrier,
      };
  } catch {
    // A fresh or unrelated history entry starts with the blank form.
  }
  return empty;
}

// Only the new-order page owns this entry draft. Editing an existing package
// stays local to its sheet, so cancelling it cannot alter committed details.
export function useManualOrderDraft(enabled: boolean) {
  const raw = useSyncExternalStore(
    subscribe,
    () =>
      enabled && typeof window.history.state?.shopManualOrderDraft === "string"
        ? window.history.state.shopManualOrderDraft
        : emptySnapshot,
    () => emptySnapshot,
  );
  const value = useMemo(() => decode(raw), [raw]);
  function update(change: Partial<ManualOrderDraft>) {
    if (!enabled) return;
    const current = decode(
      typeof window.history.state?.shopManualOrderDraft === "string"
        ? window.history.state.shopManualOrderDraft
        : emptySnapshot,
    );
    window.history.replaceState(
      {
        ...window.history.state,
        shopManualOrderDraft: JSON.stringify({ ...current, ...change }),
      },
      "",
      window.location.href,
    );
    window.dispatchEvent(new Event(eventName));
  }
  return { value, update };
}
