import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { SellerDatabase } from "../db/database";
import {
  readRepairDue,
  withRepairDueCheckpoint,
  type RepairDue,
} from "./repair-due.server";

function fixture(...values: unknown[]) {
  const due = values.length ? values[0] : false;
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ ready: true }] })
    .mockResolvedValue({ rows: [{ due }] });
  return { query, database: { pool: { query } } as unknown as SellerDatabase };
}
describe("durable maintenance due checkpoint", () => {
  it("uses notification-aware due coverage when the additive migration exists", async () => {
    const input = fixture();
    input.query
      .mockReset()
      .mockResolvedValueOnce({ rows: [{ ready: true, notifications: true }] })
      .mockResolvedValueOnce({ rows: [{ due: true }] });
    expect((await readRepairDue(input.database)).due).toBe(true);
    expect(input.query).toHaveBeenLastCalledWith(
      "SELECT treido.repair_any_due_v2() AS due",
    );
  });
  it("only an explicit false boolean permits the empty return", async () => {
    for (const due of [undefined, null, 0, "false", true]) {
      expect((await readRepairDue(fixture(due).database)).due).toBe(true);
    }
    expect(await readRepairDue(fixture().database)).toEqual({
      version: 1,
      due: false,
    });
  });
  it("missing migration and read/grant failures retain full repair", async () => {
    const missing = fixture();
    missing.query.mockReset().mockResolvedValue({ rows: [] });
    expect((await readRepairDue(missing.database)).due).toBe(true);
    expect(missing.query).toHaveBeenCalledTimes(1);
    for (const call of [1, 2]) {
      const failed = fixture();
      failed.query.mockReset();
      if (call === 2)
        failed.query.mockResolvedValueOnce({ rows: [{ ready: true }] });
      failed.query.mockRejectedValueOnce(Error("query or permission failure"));
      expect((await readRepairDue(failed.database)).due).toBe(true);
    }
  });
  it("an empty cached snapshot is stable on replay; a new tick sees new work", async () => {
    const input = fixture();
    const repair = vi.fn().mockResolvedValue({ leased: 1 });
    let cached: RepairDue | undefined;
    const checkpoint = async (read: () => Promise<RepairDue>) =>
      (cached ??= await read());
    expect(
      await withRepairDueCheckpoint(checkpoint, () => input.database, repair),
    ).toEqual({ leased: 0, accepted: 0, failed: 0 });
    input.query.mockResolvedValue({ rows: [{ ready: true, due: true }] });
    await withRepairDueCheckpoint(checkpoint, () => input.database, repair);
    expect(repair).not.toHaveBeenCalled();
    expect(input.query).toHaveBeenCalledTimes(2);
    await withRepairDueCheckpoint(
      (read) => read(),
      () => input.database,
      repair,
    );
    expect(repair).toHaveBeenCalledOnce();
  });
  it("later repair failure does not reevaluate the cached positive guard", async () => {
    const input = fixture(true);
    let cached: RepairDue | undefined;
    const checkpoint = async (read: () => Promise<RepairDue>) =>
      (cached ??= await read());
    const repair = vi
      .fn()
      .mockRejectedValueOnce(Error("later step failed"))
      .mockResolvedValueOnce({ leased: 2 });
    await expect(
      withRepairDueCheckpoint(checkpoint, () => input.database, repair),
    ).rejects.toThrow("later step failed");
    expect(
      await withRepairDueCheckpoint(checkpoint, () => input.database, repair),
    ).toEqual({ leased: 2 });
    expect(input.query).toHaveBeenCalledTimes(2);
  });
});
