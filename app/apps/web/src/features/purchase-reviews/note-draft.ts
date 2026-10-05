"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  object,
  parseReviewEdit,
  type PurchaseReview,
  type ReviewEdit,
} from "./model";
type NoteDraft = {
  note: string;
  revision: number;
  archived: boolean;
  attempt: { key: string; command: ReviewEdit } | null;
};
const transient = new Map<string, string>();
const eventName = "treido-purchase-note-draft";
const serverSnapshot = () => null;
/** Tab-local unsaved input and retry identity, never authoritative purchase data.
 * The actor/review key prevents rendering a previous account's draft. No storage
 * access happens during SSR. Storage denial leaves an in-memory editing fallback. */
export function useReviewNoteDraft(initial: PurchaseReview, actorKey: string) {
  const key = "treido-purchase-note-v1:" + actorKey + ":" + initial.id;
  const subscribe = useCallback(
    (notify: () => void) => {
      const changed = (event: Event) => {
        if (!(event instanceof CustomEvent) || event.detail === key) notify();
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
    try {
      return sessionStorage.getItem(key) ?? transient.get(key) ?? null;
    } catch {
      return transient.get(key) ?? null;
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const draft = useMemo<NoteDraft>(() => {
    const fallback = {
      note: initial.note,
      revision: initial.revision,
      archived: initial.archived,
      attempt: null,
    };
    try {
      if (!raw || raw.length > 8000) return fallback;
      const value: unknown = JSON.parse(raw);
      if (
        !object(value) ||
        typeof value.note !== "string" ||
        value.note.length > 1000 ||
        !Number.isSafeInteger(value.revision) ||
        Number(value.revision) < 0 ||
        Number(value.revision) >= 2147483647 ||
        typeof value.archived !== "boolean"
      )
        return fallback;
      let attempt: NoteDraft["attempt"] = null;
      if (
        object(value.attempt) &&
        typeof value.attempt.key === "string" &&
        value.attempt.key.length < 3000
      ) {
        const command = parseReviewEdit(value.attempt.command);
        if (command.actorKey === actorKey && command.reviewId === initial.id)
          attempt = { key: value.attempt.key, command };
      }
      return {
        note: value.note,
        revision: Number(value.revision),
        archived: value.archived,
        attempt,
      };
    } catch {
      return fallback;
    }
  }, [
    raw,
    initial.id,
    initial.note,
    initial.revision,
    initial.archived,
    actorKey,
  ]);
  const update = (patch: Partial<NoteDraft>) => {
    const value = JSON.stringify({ ...draft, ...patch });
    transient.set(key, value);
    try {
      sessionStorage.setItem(key, value);
    } catch {}
    window.dispatchEvent(new CustomEvent(eventName, { detail: key }));
  };
  return { draft, update };
}
