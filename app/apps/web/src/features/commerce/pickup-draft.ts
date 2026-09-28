"use client";

import { useMemo, useSyncExternalStore } from "react";

type PickupDraft = {
  pickup: boolean;
  offers: boolean;
  discount: boolean;
  discountCode: string;
  summary: boolean;
};
const initial: PickupDraft = {
  pickup: false,
  offers: true,
  discount: false,
  discountCode: "",
  summary: false,
};
const initialSnapshot = JSON.stringify(initial);
const eventName = "shop-pickup-draft";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(eventName, listener);
  };
}
function snapshot() {
  return typeof window.history.state?.shopPickupDraft === "string"
    ? window.history.state.shopPickupDraft
    : initialSnapshot;
}
function decode(raw: string): PickupDraft {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "pickup" in value &&
      typeof value.pickup === "boolean" &&
      "offers" in value &&
      typeof value.offers === "boolean" &&
      "discount" in value &&
      typeof value.discount === "boolean" &&
      "discountCode" in value &&
      typeof value.discountCode === "string" &&
      "summary" in value &&
      typeof value.summary === "boolean"
    )
      return {
        pickup: value.pickup,
        offers: value.offers,
        discount: value.discount,
        discountCode: value.discountCode,
        summary: value.summary,
      };
  } catch {
    // An unrelated or fresh checkout entry starts with the captured defaults.
  }
  return initial;
}

/** Local checkout choices belong to this history entry, including payment trips. */
export function usePickupDraft() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => initialSnapshot);
  const value = useMemo(() => decode(raw), [raw]);
  function update(patch: Partial<PickupDraft>) {
    const current = decode(snapshot());
    window.history.replaceState(
      {
        ...window.history.state,
        shopPickupDraft: JSON.stringify({ ...current, ...patch }),
      },
      "",
      window.location.href,
    );
    window.dispatchEvent(new Event(eventName));
  }
  return { value, update };
}
