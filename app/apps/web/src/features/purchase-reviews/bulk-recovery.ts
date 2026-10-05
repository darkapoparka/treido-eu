import { object } from "./model";
import {
  CANCELLATION_BATCH_LIMIT,
  parseCancellationBatch,
  parseCancellationRow,
  type CancellationRow,
  type CancellationResult,
} from "./bulk-model";
export type CancellationEntry = {
  row: CancellationRow;
  label: string;
  result: CancellationResult | null;
};
export type CancellationDraft = {
  version: 1;
  submitted: boolean;
  entries: CancellationEntry[];
};
export const emptyCancellationDraft = (): CancellationDraft => ({
  version: 1,
  submitted: false,
  entries: [],
});

function resultFor(
  value: unknown,
  row: CancellationRow,
): CancellationResult | null {
  if (
    !object(value) ||
    value.allocationId !== row.allocationId ||
    value.requestId !== row.requestId
  )
    return null;
  if (value.state === "cancelled") {
    const receipt = value.receipt;
    if (
      !object(receipt) ||
      receipt.allocationId !== row.allocationId ||
      receipt.offerId !== row.offerId ||
      receipt.threadId !== row.threadId ||
      receipt.requestId !== row.requestId ||
      typeof receipt.revision !== "number" ||
      !Number.isSafeInteger(receipt.revision) ||
      receipt.revision < 1 ||
      receipt.revision >= 2147483647
    )
      return null;
    return {
      allocationId: row.allocationId,
      requestId: row.requestId,
      state: "cancelled",
      receipt: {
        allocationId: row.allocationId,
        requestId: row.requestId,
        offerId: row.offerId,
        threadId: row.threadId,
        revision: receipt.revision,
      },
    };
  }
  if (
    (value.state === "rejected" || value.state === "unresolved") &&
    typeof value.code === "string" &&
    /^[A-Z_]{1,40}$/.test(value.code)
  )
    return {
      allocationId: row.allocationId,
      requestId: row.requestId,
      state: value.state,
      code: value.code,
    };
  return null;
}
export function unresolvedCancellation(
  row: CancellationRow,
  code = "NOT_AVAILABLE",
): CancellationResult {
  return {
    allocationId: row.allocationId,
    requestId: row.requestId,
    state: "unresolved",
    code,
  };
}
export function parseCancellationDraft(
  raw: string | null,
  actorKey: string,
  sellerId: string | null,
): {
  draft: CancellationDraft;
  invalid: boolean;
} {
  if (raw === null) return { draft: emptyCancellationDraft(), invalid: false };
  try {
    if (raw.length > 24000) throw new Error("limit");
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      value.version !== 1 ||
      typeof value.submitted !== "boolean" ||
      !Array.isArray(value.entries) ||
      value.entries.length > CANCELLATION_BATCH_LIMIT
    )
      throw new Error("shape");
    const entries = value.entries.map((entry): CancellationEntry => {
      if (
        !object(entry) ||
        typeof entry.label !== "string" ||
        entry.label.length > 180
      )
        throw new Error("label");
      const row = parseCancellationRow(entry.row);
      const result =
        entry.result === null ? null : resultFor(entry.result, row);
      if (entry.result !== null && !result) throw new Error("receipt");
      if (!value.submitted && result !== null) throw new Error("state");
      return { row, label: entry.label, result };
    });
    if (entries.length)
      parseCancellationBatch({
        actorKey,
        sellerId,
        rows: entries.map((entry) => entry.row),
      });
    return {
      draft: { version: 1, submitted: value.submitted, entries },
      invalid: false,
    };
  } catch {
    return { draft: emptyCancellationDraft(), invalid: true };
  }
}
export function retryableCancellation(entry: CancellationEntry) {
  return entry.result === null || entry.result.state === "unresolved";
}
/** Correlate every receipt to the original selection. Missing, duplicate or
 * malformed response rows stay unresolved, never overwrite earlier success. */
export function mergeCancellationResults(
  draft: CancellationDraft,
  raw: unknown,
): CancellationDraft {
  const values =
    Array.isArray(raw) && raw.length <= CANCELLATION_BATCH_LIMIT ? raw : [];
  return {
    ...draft,
    submitted: true,
    entries: draft.entries.map((entry) => {
      if (!retryableCancellation(entry)) return entry;
      const matches = values.filter(
        (value) => object(value) && value.requestId === entry.row.requestId,
      );
      return {
        ...entry,
        result:
          matches.length === 1
            ? (resultFor(matches[0], entry.row) ??
              unresolvedCancellation(entry.row))
            : unresolvedCancellation(entry.row),
      };
    }),
  };
}
