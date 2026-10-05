import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { object } from "./model";
export const CANCELLATION_BATCH_LIMIT = 20;
export type CancellationRow = {
  allocationId: string;
  threadId: string;
  offerId: string;
  expectedRevision: number;
  requestId: string;
};
export type CancellationCommand = CancellationRow & {
  actorKey: string;
  sellerId: string | null;
};
export type CancellationBatch = {
  actorKey: string;
  sellerId: string | null;
  rows: CancellationRow[];
};
export type CancellationReceipt = {
  allocationId: string;
  offerId: string;
  threadId: string;
  requestId: string;
  revision: number;
};
export type CancellationResult =
  | {
      allocationId: string;
      requestId: string;
      state: "cancelled";
      receipt: CancellationReceipt;
    }
  | {
      allocationId: string;
      requestId: string;
      state: "rejected" | "unresolved";
      code: string;
    };
export function parseCancellationRow(raw: unknown): CancellationRow {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (k) =>
        ![
          "allocationId",
          "threadId",
          "offerId",
          "expectedRevision",
          "requestId",
        ].includes(k),
    ) ||
    !validId(raw.allocationId) ||
    !validId(raw.threadId) ||
    !validId(raw.offerId) ||
    !validId(raw.requestId) ||
    !Number.isSafeInteger(raw.expectedRevision) ||
    Number(raw.expectedRevision) < 0 ||
    Number(raw.expectedRevision) >= 2147483647
  )
    throw new SellerError("INVALID_INPUT");
  return raw as CancellationRow;
}
export function parseCancellationBatch(raw: unknown): CancellationBatch {
  if (
    !object(raw) ||
    Object.keys(raw).some(
      (k) => !["actorKey", "sellerId", "rows"].includes(k),
    ) ||
    typeof raw.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey) ||
    (raw.sellerId !== null && !validId(raw.sellerId)) ||
    !Array.isArray(raw.rows) ||
    !raw.rows.length ||
    raw.rows.length > CANCELLATION_BATCH_LIMIT
  )
    throw new SellerError("INVALID_INPUT");
  const rows = raw.rows.map(parseCancellationRow);
  for (const key of [
    "allocationId",
    "threadId",
    "offerId",
    "requestId",
  ] as const)
    if (new Set(rows.map((r) => r[key])).size !== rows.length)
      throw new SellerError("INVALID_INPUT");
  return {
    actorKey: raw.actorKey,
    sellerId: raw.sellerId as string | null,
    rows,
  };
}
