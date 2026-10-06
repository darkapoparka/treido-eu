import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { SellerDatabase } from "../db/database";
import type { JobBindings } from "./bindings";
import {
  REPAIR_EVENT,
  validRepairWakeup,
  wakeRepair,
} from "./repair-wakeup.server";

const bindings: JobBindings = {
  applicationId: "treido-prod",
  environment: "production",
  origin: "https://treido.eu",
  repairServiceId: "treido-repair",
  repairScheduler: "external-minute",
};
const now = 1791290400000;
const minute = Math.floor(now / 60000);
const data = {
  schemaVersion: 1,
  applicationId: bindings.applicationId,
  environment: bindings.environment,
  minute,
};
function database(due: unknown = true) {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ ready: true }] })
    .mockResolvedValue({ rows: [{ due }] });
  return { query, db: { pool: { query } } as unknown as SellerDatabase };
}
describe("external minute repair wake-up", () => {
  it("keeps empty ticks off Inngest and detects newly due work next tick", async () => {
    const input = database(false);
    const send = vi.fn().mockResolvedValue({ ids: ["accepted"] });
    expect(await wakeRepair(input.db, bindings, send, now)).toEqual({
      status: "empty",
    });
    expect(send).not.toHaveBeenCalled();
    input.query.mockResolvedValue({ rows: [{ ready: true, due: true }] });
    expect(await wakeRepair(input.db, bindings, send, now + 60000)).toEqual({
      status: "queued",
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].data.minute).toBe(minute + 1);
  });
  it("unknown due state retains recovery and deduplicates ambiguous sends within a minute", async () => {
    const input = database();
    input.query.mockRejectedValue(Error("permission or storage unavailable"));
    const send = vi
      .fn()
      .mockRejectedValueOnce(Error("accepted but response lost"))
      .mockResolvedValue({ ids: ["accepted"] });
    await expect(wakeRepair(input.db, bindings, send, now)).rejects.toThrow(
      "response lost",
    );
    await wakeRepair(input.db, bindings, send, now + 1000);
    const event = send.mock.calls[0][0];
    expect(event).toEqual(send.mock.calls[1][0]);
    expect(event).toEqual({
      id: expect.stringMatching(/^repair-[a-f0-9]{64}$/),
      name: REPAIR_EVENT,
      data,
    });
    await wakeRepair(input.db, bindings, send, now + 60000);
    expect(send.mock.calls[2][0].id).not.toBe(event.id);
    await wakeRepair(
      input.db,
      { ...bindings, environment: "another-env" },
      send,
      now,
    );
    expect(send.mock.calls[3][0].id).not.toBe(event.id);
  });
  it("rejects disabled mode before database or enqueue", async () => {
    const input = database();
    const send = vi.fn();
    await expect(
      wakeRepair(
        input.db,
        { ...bindings, repairScheduler: undefined },
        send,
        now,
      ),
    ).rejects.toThrow("NOT_AVAILABLE");
    expect(input.query).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("does not treat malformed or missing durable acceptance as success", async () => {
    for (const result of [
      undefined,
      {},
      { ids: [] },
      { ids: [""] },
      { ids: [null] },
      { ids: ["one", "two"] },
    ])
      await expect(
        wakeRepair(
          database().db,
          bindings,
          vi.fn().mockResolvedValue(result),
          now,
        ),
      ).rejects.toThrow("acceptance is unavailable");
  });
  it("validates exact minimal binding and bounded time independently of event ID", () => {
    expect(validRepairWakeup(data, bindings, now)).toBe(true);
    expect(
      validRepairWakeup({ ...data, minute: minute - 1440 }, bindings, now),
    ).toBe(true);
    expect(
      validRepairWakeup({ ...data, minute: minute + 1 }, bindings, now),
    ).toBe(true);
    for (const value of [
      null,
      [],
      { ...data, schemaVersion: 2 },
      { ...data, applicationId: "other-app" },
      { ...data, environment: "preview" },
      { ...data, privatePayload: "secret" },
      { ...data, minute: minute + 2 },
      { ...data, minute: minute - 1441 },
      { ...data, minute: -1 },
      { ...data, minute: NaN },
      { ...data, minute: String(minute) },
      { ...data, minute: minute + 0.5 },
    ])
      expect(validRepairWakeup(value, bindings, now)).toBe(false);
  });
});
