import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitJobHealth, jobHealth, JOB_HEALTH_LIMITS } from "./health";
import { JOB_HEALTH_SQL, observeJobHealth } from "./health.server";
import { JOB_OBSERVATION_LIMITS } from "./observations";
import type { SellerDatabase } from "../db/database";
import type { JobBindings } from "./bindings";
import { createJobExecutor } from "./inngest.server";
import { withRepairDueCheckpoint } from "./repair-due.server";
import { REPAIR_EVENT } from "./repair-wakeup.server";

const sdk = vi.hoisted(() => ({
  functions: [] as {
    options: Record<string, unknown>;
    run: (input: unknown) => Promise<unknown>;
  }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("inngest/next", () => ({ serve: vi.fn(() => ({})) }));
vi.mock("inngest", async (load) => ({
  ...(await load<typeof import("inngest")>()),
  Inngest: class {
    createFunction(
      options: Record<string, unknown>,
      run: (input: unknown) => Promise<unknown>,
    ) {
      sdk.functions.push({ options, run });
      return {};
    }
  },
}));
vi.mock("./repair-due.server", () => ({
  readRepairDue: vi.fn(),
  withRepairDueCheckpoint: vi.fn(),
}));
const empty = {
  pending: "0",
  accepted: "0",
  due: "0",
  leased: "0",
  retrying: "0",
  dead: "0",
  running: "0",
  oldestActiveMs: null,
  oldestDueMs: null,
};
const busy = {
  pending: "2",
  accepted: "3",
  due: "4",
  leased: "1",
  retrying: "3",
  dead: "2",
  running: "1",
  oldestActiveMs: "60000",
  oldestDueMs: "12000",
};
function fixture(rows: unknown[] = [empty]) {
  const query = vi.fn().mockResolvedValue({ rows });
  const database = () => ({ pool: { query } }) as unknown as SellerDatabase;
  return { query, database };
}
beforeEach(() => {
  vi.clearAllMocks();
  sdk.functions.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("bounded internal queue health", () => {
  it("distinguishes observed empty work from nonempty due, leased and retrying queues", () => {
    expect(jobHealth(empty)).toEqual({
      event: "treido.job.health",
      version: 1,
      status: "available",
      active: 0,
      ...Object.fromEntries(
        [
          "pending",
          "accepted",
          "due",
          "leased",
          "retrying",
          "dead",
          "running",
        ].map((key) => [key, 0]),
      ),
      oldestActiveMs: null,
      oldestDueMs: null,
    });
    expect(jobHealth(busy, 1.9)).toMatchObject({
      status: "available",
      active: 5,
      pending: 2,
      accepted: 3,
      due: 4,
      leased: 1,
      retrying: 3,
      dead: 2,
      running: 1,
      oldestActiveMs: 60000,
      oldestDueMs: 12000,
      durationMs: 1,
    });
  });
  it("does not turn unavailable, malformed or internally inconsistent reads into empty success", () => {
    for (const input of [
      undefined,
      null,
      [],
      {},
      { ...busy, pending: "-1" },
      { ...busy, pending: "2.5" },
      { ...busy, due: "6" },
      { ...busy, running: "6" },
      { ...busy, oldestDueMs: null },
      { ...empty, oldestActiveMs: "1" },
      { ...empty, oldestDueMs: undefined },
    ])
      expect(jobHealth(input)).toEqual({
        event: "treido.job.health",
        version: 1,
        status: "unavailable",
      });
  });
  it("caps large counters and ages explicitly within the existing observation byte budget", () => {
    const event = jobHealth(
      {
        pending: "9223372036854775807",
        accepted: "9223372036854775807",
        due: "9223372036854775807",
        leased: "9223372036854775807",
        retrying: "9223372036854775807",
        dead: "9223372036854775807",
        running: "9223372036854775807",
        oldestActiveMs: "9223372036854775807",
        oldestDueMs: "9223372036854775807",
      },
      Number.MAX_VALUE,
    );
    expect(event).toMatchObject({
      status: "available",
      active: JOB_HEALTH_LIMITS.count,
      countsCapped: true,
      agesCapped: true,
      oldestActiveMs: JOB_HEALTH_LIMITS.ageMs,
      oldestDueMs: JOB_HEALTH_LIMITS.ageMs,
      durationMs: JOB_OBSERVATION_LIMITS.durationMs,
      durationCapped: true,
    });
    expect(JSON.stringify(event).length).toBeLessThanOrEqual(
      JOB_OBSERVATION_LIMITS.bytes,
    );
    expect(Object.isFrozen(event)).toBe(true);
  });
  it("projects no contents, identities, URLs, prototypes or hostile accessors", () => {
    const getter = vi.fn(() => {
      throw Error("private-sentinel");
    });
    const value = Object.assign(
      Object.create({ private: "private-sentinel" }),
      busy,
      {
        actorId: "private-sentinel",
        recipient: "private-sentinel",
        url: "private-sentinel",
        error: Error("private-sentinel"),
        toJSON: getter,
      },
    );
    Object.defineProperty(value, "content", { get: getter });
    value.cycle = value;
    const projected = jobHealth(value);
    expect(projected.status).toBe("available");
    expect(JSON.stringify(projected)).not.toContain("private-sentinel");
    expect(getter).not.toHaveBeenCalled();
    Object.defineProperty(value, "pending", { get: getter });
    expect(jobHealth(value).status).toBe("unavailable");
    expect(getter).not.toHaveBeenCalled();
    expect(
      jobHealth(new Proxy({}, { getOwnPropertyDescriptor: getter })).status,
    ).toBe("unavailable");
  });
  it("contains failed input and synchronous/asynchronous sinks without a raw fallback", async () => {
    const sink = vi.fn();
    emitJobHealth(() => {
      throw Error("private-sentinel");
    }, sink);
    expect(sink).toHaveBeenCalledWith({
      event: "treido.job.health",
      version: 1,
      status: "unavailable",
    });
    expect(() =>
      emitJobHealth(
        () => busy,
        () => {
          throw Error("private-sentinel");
        },
      ),
    ).not.toThrow();
    expect(
      emitJobHealth(
        () => busy,
        () => Promise.reject(Error("private-sentinel")),
      ),
    ).toBeUndefined();
    await Promise.resolve();
  });
  it("uses one aggregate read, preserving unavailable reads and excluding raw row fields", async () => {
    const input = fixture([{ ...busy, recipient: "private-sentinel" }]);
    const sink = vi.fn();
    await observeJobHealth(input.database, sink);
    expect(input.query).toHaveBeenCalledExactlyOnceWith(JOB_HEALTH_SQL);
    expect(sink.mock.calls[0][0]).toMatchObject({
      status: "available",
      active: 5,
    });
    expect(JSON.stringify(sink.mock.calls)).not.toContain("private-sentinel");
    for (const rows of [[], [empty, empty]]) {
      const failed = fixture(rows),
        output = vi.fn();
      await observeJobHealth(failed.database, output);
      expect(output.mock.calls[0][0].status).toBe("unavailable");
    }
  });
  it("contains factory/read/sink failures without logging the original error", async () => {
    const error = new Error("private-sentinel");
    const input = fixture();
    input.query.mockRejectedValue(error);
    const sink = vi.fn();
    await expect(
      observeJobHealth(input.database, sink),
    ).resolves.toBeUndefined();
    await expect(
      observeJobHealth(() => {
        throw error;
      }, sink),
    ).resolves.toBeUndefined();
    expect(
      sink.mock.calls.every(([event]) => event.status === "unavailable"),
    ).toBe(true);
    expect(JSON.stringify(sink.mock.calls)).not.toContain("private-sentinel");
    await expect(
      observeJobHealth(input.database, () => {
        throw error;
      }),
    ).resolves.toBeUndefined();
  });
});

describe("repair health hook authority and outcome", () => {
  const bindings: JobBindings = {
    applicationId: "treido-health-test",
    environment: "health-test",
    origin: "https://example.invalid",
    repairServiceId: "health-test-service",
    repairScheduler: "external-minute",
  };
  function repair() {
    const input = fixture();
    createJobExecutor(bindings, {}, input.database);
    return {
      ...input,
      run: sdk.functions.find((item) => item.options.id === "outbox-repair-v1")!
        .run,
    };
  }
  it("observes before the empty-work optimization and preserves its exact result", async () => {
    const logs = vi.spyOn(console, "info").mockImplementation(() => {});
    const input = repair();
    const result = { leased: 0, accepted: 0, failed: 0 };
    vi.mocked(withRepairDueCheckpoint).mockImplementation(async () => {
      expect(input.query).toHaveBeenCalledOnce();
      return result;
    });
    await expect(
      input.run({
        event: {
          name: REPAIR_EVENT,
          data: {
            schemaVersion: 1,
            applicationId: bindings.applicationId,
            environment: bindings.environment,
            minute: Math.floor(Date.now() / 60000),
          },
        },
        step: {},
      }),
    ).resolves.toBe(result);
    expect(logs).toHaveBeenCalledOnce();
    expect(JSON.parse(logs.mock.calls[0][0]).status).toBe("available");
  });
  it("rejects a foreign wakeup before any queue read or health output", async () => {
    const logs = vi.spyOn(console, "info").mockImplementation(() => {}),
      input = repair();
    await expect(
      input.run({
        event: {
          name: REPAIR_EVENT,
          data: {
            schemaVersion: 1,
            applicationId: "foreign-app",
            environment: bindings.environment,
            minute: Math.floor(Date.now() / 60000),
          },
        },
        step: {},
      }),
    ).rejects.toThrow("authority was rejected");
    expect(input.query).not.toHaveBeenCalled();
    expect(logs).not.toHaveBeenCalled();
    expect(withRepairDueCheckpoint).not.toHaveBeenCalled();
  });
  it("a telemetry read or sink failure preserves the original repair failure", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {
      throw Error("private-sink");
    });
    const input = repair();
    input.query.mockRejectedValue(Error("private-read"));
    const original = Error("original-repair-error");
    vi.mocked(withRepairDueCheckpoint).mockRejectedValue(original);
    await expect(
      input.run({
        event: {
          name: REPAIR_EVENT,
          data: {
            schemaVersion: 1,
            applicationId: bindings.applicationId,
            environment: bindings.environment,
            minute: Math.floor(Date.now() / 60000),
          },
        },
        step: {},
      }),
    ).rejects.toBe(original);
  });
});
