import { object } from "../purchase-reviews/model";
import {
  parseNotificationRead,
  parseReadSelection,
  validSequence,
  NOTIFICATION_LIMIT,
  type NotificationScope,
  type NotificationReadResult,
  type ReadSelection,
} from "./model";
export type ReadEntry = {
  row: ReadSelection;
  label: string;
  result: NotificationReadResult | null;
};
export type ReadDraft = {
  version: 1;
  submitted: boolean;
  entries: ReadEntry[];
};
export const emptyReadDraft = (): ReadDraft => ({
  version: 1,
  submitted: false,
  entries: [],
});
export const retryableRead = (entry: ReadEntry) =>
  !entry.result || entry.result.state === "unresolved";
export const unresolvedRead = (
  row: ReadSelection,
  code = "AWAITING_ACK",
): NotificationReadResult => ({ ...row, state: "unresolved", code });
function readResult(
  value: unknown,
  row: ReadSelection,
): NotificationReadResult | null {
  if (
    !object(value) ||
    value.messageId !== row.messageId ||
    value.threadId !== row.threadId ||
    value.sequence !== row.sequence ||
    value.requestId !== row.requestId
  )
    return null;
  if (
    value.state === "read" &&
    validSequence(value.acknowledgedThrough) &&
    value.acknowledgedThrough >= row.sequence
  )
    return {
      ...row,
      state: "read",
      acknowledgedThrough: value.acknowledgedThrough,
    };
  if (
    (value.state === "rejected" || value.state === "unresolved") &&
    typeof value.code === "string" &&
    /^[A-Z_]{1,64}$/.test(value.code)
  )
    return { ...row, state: value.state, code: value.code };
  return null;
}
export function parseReadDraft(
  raw: string | null,
  scope: NotificationScope,
): { draft: ReadDraft; invalid: boolean } {
  if (!raw) return { draft: emptyReadDraft(), invalid: false };
  try {
    if (raw.length > 24000) throw Error();
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      value.version !== 1 ||
      typeof value.submitted !== "boolean" ||
      !Array.isArray(value.entries) ||
      value.entries.length > NOTIFICATION_LIMIT
    )
      throw Error();
    const entries = value.entries.map((entry): ReadEntry => {
      if (
        !object(entry) ||
        typeof entry.label !== "string" ||
        entry.label.length > 180
      )
        throw Error();
      const row = parseReadSelection(entry.row),
        result = entry.result === null ? null : readResult(entry.result, row);
      if (entry.result !== null && !result) throw Error();
      return { row, label: entry.label, result };
    });
    if (entries.length)
      parseNotificationRead({
        ...scope,
        rows: entries.map((entry) => entry.row),
      });
    if (!value.submitted && entries.some((entry) => entry.result !== null))
      throw Error();
    return {
      draft: { version: 1, submitted: value.submitted, entries },
      invalid: false,
    };
  } catch {
    return { draft: emptyReadDraft(), invalid: true };
  }
}
export function mergeReadResults(draft: ReadDraft, raw: unknown): ReadDraft {
  const results: unknown[] = Array.isArray(raw) ? raw : [];
  return {
    ...draft,
    entries: draft.entries.map((entry) => {
      if (!retryableRead(entry)) return entry;
      const candidates = results.filter(
        (value) => object(value) && value.requestId === entry.row.requestId,
      );
      const result =
        candidates.length === 1 ? readResult(candidates[0], entry.row) : null;
      return {
        ...entry,
        result: result ?? unresolvedRead(entry.row, "NOT_AVAILABLE"),
      };
    }),
  };
}
