"use client";
import { useSyncExternalStore } from "react";
import { PREPARATION_STORAGE_KEY } from "./form-model";

const changedEvent = "treido-preparation-changed";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changedEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changedEvent, listener);
  };
}
function snapshot(): string | null {
  try {
    return window.localStorage.getItem(PREPARATION_STORAGE_KEY);
  } catch {
    return null;
  }
}
const serverSnapshot = () => null;
export function useDevicePreparation() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Device storage is convenience state, never an account draft or permission. */
export function writeDevicePreparation(value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(PREPARATION_STORAGE_KEY);
    else window.localStorage.setItem(PREPARATION_STORAGE_KEY, value);
    window.dispatchEvent(new Event(changedEvent));
    return true;
  } catch {
    return false;
  }
}
