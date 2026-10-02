"use client";

import { useCallback, useSyncExternalStore } from "react";
import { parseDraftPayload, validId, type DraftPayload } from "./draft-model";

const changedEvent = "treido-draft-buffer-changed";
const serverSnapshot = () => null;
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changedEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changedEvent, listener);
  };
}

export type DraftBuffer = {
  version: 1;
  payload: DraftPayload;
  price: string;
  revision: number;
  requestId: string;
};

export function parseDraftBuffer(raw: string | null): DraftBuffer | null {
  if (!raw || raw.length > 26000) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved))
      return null;
    const item = saved as Record<string, unknown>;
    const payload = parseDraftPayload(item.payload);
    if (
      item.version !== 1 ||
      !payload ||
      typeof item.price !== "string" ||
      item.price.length > 80 ||
      !Number.isSafeInteger(item.revision) ||
      (item.revision as number) < 0 ||
      !validId(item.requestId)
    )
      return null;
    return {
      version: 1,
      payload,
      price: item.price,
      revision: item.revision as number,
      requestId: item.requestId,
    };
  } catch {
    return null;
  }
}

export function useDraftBuffer(key: string) {
  const snapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  return parseDraftBuffer(
    useSyncExternalStore(subscribe, snapshot, serverSnapshot),
  );
}

/** Convenience input only. Keys are scoped by the server to the human and draft. */
export function writeDraftBuffer(key: string, buffer: DraftBuffer | null) {
  try {
    if (buffer) localStorage.setItem(key, JSON.stringify(buffer));
    else localStorage.removeItem(key);
    window.dispatchEvent(new Event(changedEvent));
  } catch {
    /* A device storage failure never changes the server save result. */
  }
}
