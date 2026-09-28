"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

const eventName = "shop-search-draft";
type DraftKind =
  "composer" | "jeans-answer" | "photo-answer" | `store-search:${string}`;
type DraftRecord = { id: string; raw: string };
// Only deliberately related history entries share an ID (Search and its
// consumed answer sheet). This cache lasts for this document, never storage.
const ownedDrafts = new Map<string, string>();
function readRecord(kind: DraftKind): DraftRecord | undefined {
  const record = window.history.state?.shopSearchDrafts?.[kind];
  return typeof record?.id === "string" && typeof record.raw === "string"
    ? record
    : undefined;
}
function restoreOwnedDrafts() {
  const records = window.history.state?.shopSearchDrafts;
  if (!records || typeof records !== "object") return;
  let changed = false;
  const next = { ...records };
  for (const [kind, record] of Object.entries(records)) {
    const value = record as Partial<DraftRecord> | null;
    if (typeof value?.id !== "string" || typeof value.raw !== "string")
      continue;
    const raw = ownedDrafts.get(value.id);
    if (raw === undefined) ownedDrafts.set(value.id, value.raw);
    if (raw !== undefined && raw !== value.raw) {
      next[kind] = { id: value.id, raw };
      changed = true;
    }
  }
  if (changed)
    window.history.replaceState(
      { ...window.history.state, shopSearchDrafts: next },
      "",
      window.location.href,
    );
}
function subscribe(listener: () => void) {
  const restore = () => {
    restoreOwnedDrafts();
    listener();
  };
  window.addEventListener("popstate", restore);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("popstate", restore);
    window.removeEventListener(eventName, listener);
  };
}
type Draft = { draft: string; photo: string; editing: boolean };
const emptyDraft = JSON.stringify({ draft: "", photo: "", editing: false });
function storeRecord(kind: DraftKind, raw: string) {
  const record = { id: readRecord(kind)?.id ?? crypto.randomUUID(), raw };
  ownedDrafts.set(record.id, raw);
  window.history.replaceState(
    {
      ...window.history.state,
      shopSearchDrafts: {
        ...window.history.state?.shopSearchDrafts,
        [kind]: record,
      },
    },
    "",
    window.location.href,
  );
  window.dispatchEvent(new Event(eventName));
}
/** Call before copying this entry into its explicitly owned answer sheet. */
export function prepareSearchDraftOwner(kind: DraftKind) {
  const record = readRecord(kind);
  const legacy = window.history.state?.shopSearchDraft;
  storeRecord(
    kind,
    record
      ? (ownedDrafts.get(record.id) ?? record.raw)
      : legacy?.kind === kind && typeof legacy.raw === "string"
        ? legacy.raw
        : emptyDraft,
  );
  return window.history.state.shopSearchDrafts as Partial<
    Record<DraftKind, DraftRecord>
  >;
}
/** Carry deliberate owners only after the router creates the answer entry. */
export function inheritSearchDraftOwners(
  records: ReturnType<typeof prepareSearchDraftOwner>,
) {
  window.history.replaceState(
    { ...window.history.state, shopSearchDrafts: records },
    "",
    window.location.href,
  );
  restoreOwnedDrafts();
  window.dispatchEvent(new Event(eventName));
}
function decode(raw: string, fallback: Draft): Draft {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "draft" in value &&
      typeof value.draft === "string" &&
      "photo" in value &&
      typeof value.photo === "string"
    )
      return {
        draft: value.draft,
        photo: value.photo,
        editing: "editing" in value && value.editing === true,
      };
  } catch {
    // An unrelated or malformed history entry restores the route seed.
  }
  return fallback;
}
// Drafts belong to the actual navigation entry. They never enter a URL,
// storage, server request or shared account, and a fresh entry starts empty.
export function useSearchDraft(
  kind: DraftKind,
  initialDraft = "",
  initialPhoto = "",
) {
  const seed = JSON.stringify({
    draft: initialDraft,
    photo: initialPhoto,
    editing: false,
  });
  function snapshot() {
    const record = readRecord(kind);
    if (record) return ownedDrafts.get(record.id) ?? record.raw;
    // Existing open browser entries retain their pre-extension drafts.
    const value = window.history.state?.shopSearchDraft;
    return value?.kind === kind && typeof value.raw === "string"
      ? value.raw
      : seed;
  }
  const raw = useSyncExternalStore(subscribe, snapshot, () => seed);
  useEffect(() => {
    restoreOwnedDrafts();
  }, []);
  const value = useMemo(
    () =>
      decode(raw, { draft: initialDraft, photo: initialPhoto, editing: false }),
    [raw, initialDraft, initialPhoto],
  );
  function update(patch: Partial<Draft>) {
    const current = decode(snapshot(), value);
    const next = { ...current, ...patch };
    if (
      patch.photo !== undefined &&
      patch.photo !== current.photo &&
      current.photo.startsWith("blob:")
    )
      URL.revokeObjectURL(current.photo);
    storeRecord(kind, JSON.stringify(next));
  }
  return { ...value, update };
}
