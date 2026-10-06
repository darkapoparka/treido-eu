import "server-only";
import type { SellerDatabase } from "../db/database";

export type RepairDue = { version: 1; due: boolean };

/** Optimization only. Missing schema/grants or a failed read retains all repair. */
export async function readRepairDue(
  database: SellerDatabase,
): Promise<RepairDue> {
  try {
    const ready = await database.pool.query<{ ready: boolean }>(
      "SELECT to_regprocedure('treido.repair_any_due_v1()') IS NOT NULL AS ready",
    );
    if (ready.rows[0]?.ready !== true) return { version: 1, due: true };
    const result = await database.pool.query<{ due: boolean }>(
      "SELECT treido.repair_any_due_v1() AS due",
    );
    return { version: 1, due: result.rows[0]?.due !== false };
  } catch {
    // The original effects still expose their own genuine database failures.
    return { version: 1, due: true };
  }
}

export async function withRepairDueCheckpoint<T>(
  checkpoint: (read: () => Promise<RepairDue>) => Promise<RepairDue>,
  database: () => SellerDatabase,
  repair: () => Promise<T>,
): Promise<T | { leased: 0; accepted: 0; failed: 0 }> {
  const snapshot = await checkpoint(() => readRepairDue(database()));
  if (snapshot?.version === 1 && snapshot.due === false)
    return { leased: 0, accepted: 0, failed: 0 };
  return repair();
}
