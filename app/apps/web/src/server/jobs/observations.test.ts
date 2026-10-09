import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emitJobObservation,
  jobObservation,
  JOB_OBSERVATION_LIMITS,
} from "./observations";
import { dispatchOutbox, type EventSender } from "./dispatch.server";
import { createJobExecutor } from "./inngest.server";
import { leaseJobs, recordHandoff, releaseDispatch } from "./outbox.server";
import { executeJob, markExecutorFailure } from "./execution.server";
import { JobError } from "./model";
import { NonRetriableError, serializeError } from "inngest";
import { SellerError } from "../../features/sellers/errors";
import type { SellerDatabase } from "../db/database";
import type { JobBindings } from "./bindings";

const sdk = vi.hoisted(() => ({
  functions: [] as {
    options: Record<string, unknown>;
    run: (input: unknown) => Promise<unknown>;
  }[],
  options: null as unknown,
}));
vi.mock("server-only", () => ({}));
vi.mock("./outbox.server", async (load) => ({
  ...(await load<typeof import("./outbox.server")>()),
  leaseJobs: vi.fn(),
  recordHandoff: vi.fn(),
  releaseDispatch: vi.fn(),
}));
vi.mock("./execution.server", () => ({
  executeJob: vi.fn(),
  markExecutorFailure: vi.fn(),
}));
vi.mock("inngest/next", () => ({ serve: vi.fn(() => ({})) }));
vi.mock("inngest", async (load) => {
  const actual = await load<typeof import("inngest")>();
  return {
    ...actual,
    Inngest: class {
      constructor(options: unknown) {
        sdk.options = options;
      }
      createFunction(
        options: Record<string, unknown>,
        run: (input: unknown) => Promise<unknown>,
      ) {
        sdk.functions.push({ options, run });
        return {};
      }
    },
  };
});
const id = "00000000-0000-0000-0000-000000000001";
const otherId = "00000000-0000-0000-0000-000000000002";
const sdkId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const database = {} as SellerDatabase;
const bindings = {
  environment: "test",
  applicationId: "treido-observation-test",
} as JobBindings;
const job = { id, generation: 1, sellerId: otherId, buyerId: null } as Awaited<
  ReturnType<typeof leaseJobs>
>[number];
let logs: string[];
beforeEach(() => {
  vi.resetAllMocks();
  sdk.functions.length = 0;
  logs = [];
  vi.spyOn(console, "info").mockImplementation((value) => {
    logs.push(String(value));
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(leaseJobs).mockResolvedValue([]);
  vi.mocked(releaseDispatch).mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());
const observed = () => logs.map((line) => JSON.parse(line));
function executor() {
  createJobExecutor(bindings, {}, () => database);
  return sdk.functions[0];
}
const executorInput = () => ({
  event: {
    id: sdkId,
    data: {
      jobId: id,
      generation: 1,
      sellerId: otherId,
      privatePrompt: "private-sentinel",
    },
  },
  runId: sdkId,
  step: {
    run: async (name: string, operation: () => Promise<unknown>) => {
      expect(name).toBe("execute-owned-effect-v1");
      return operation();
    },
  },
});

describe("fixed job observation privacy and bounds", () => {
  it("projects only finite metadata without reading private getters or toJSON", () => {
    const privateGetter = vi.fn(() => {
      throw Error("private-sentinel");
    });
    const input = {
      phase: "executor",
      outcome: "completed",
      durationMs: 12.9,
      correlation: { jobId: id, generation: 2, sellerId: otherId },
      runId: sdkId,
      eventId: sdkId,
      actorId: otherId,
      error: Error("private-sentinel"),
      token: "private-sentinel",
      toJSON: privateGetter,
    };
    Object.defineProperty(input, "request", { get: privateGetter });
    const result = jobObservation(input);
    expect(result).toEqual({
      event: "treido.job.observation",
      version: 1,
      phase: "executor",
      outcome: "completed",
      durationMs: 12,
      jobId: id,
      generation: 2,
      runId: sdkId,
      eventId: sdkId,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private-sentinel");
    expect(privateGetter).not.toHaveBeenCalled();
  });
  it("omits arbitrary strings, URLs, email, malformed identifiers and invalid generation", () => {
    for (const value of [
      "https://example.test/private",
      "private@example.test",
      "private-sentinel",
      "x".repeat(200),
      {},
      null,
    ]) {
      const result = jobObservation({
        phase: "executor",
        outcome: "failed",
        correlation: { jobId: id, generation: Number.MAX_SAFE_INTEGER },
        runId: value,
        eventId: value,
        errorClass: value,
      });
      expect(result).toEqual({
        event: "treido.job.observation",
        version: 1,
        phase: "executor",
        outcome: "failed",
        errorClass: "effect_unavailable",
      });
    }
  });
  it("caps measured duration explicitly and omits unavailable/negative/nonfinite duration", () => {
    expect(
      jobObservation({ phase: "executor", outcome: "stale", durationMs: 1e20 }),
    ).toMatchObject({
      durationMs: JOB_OBSERVATION_LIMITS.durationMs,
      durationCapped: true,
    });
    for (const durationMs of [-1, NaN, Infinity, "12", {}])
      expect(
        jobObservation({ phase: "executor", outcome: "stale", durationMs }),
      ).not.toHaveProperty("durationMs");
  });
  it("rejects invalid phase/outcome and batch counts instead of logging misleading metrics", () => {
    for (const input of [
      { phase: "private-sentinel", outcome: "completed" },
      { phase: "handoff", outcome: "completed" },
      {
        phase: "batch",
        outcome: "completed",
        leased: 21,
        accepted: 0,
        failed: 0,
      },
      { phase: "batch", outcome: "failed", leased: 1, accepted: 1, failed: 1 },
      {
        phase: "batch",
        outcome: "completed",
        leased: 1,
        accepted: "1",
        failed: 0,
      },
    ])
      expect(jobObservation(input)).toBeNull();
    expect(
      jobObservation({
        phase: "batch",
        outcome: "completed",
        leased: 20,
        accepted: 19,
        failed: 0,
        jobId: id,
        runId: sdkId,
      }),
    ).toEqual({
      event: "treido.job.observation",
      version: 1,
      phase: "batch",
      outcome: "completed",
      leased: 20,
      accepted: 19,
      failed: 0,
    });
  });
  it("contains hostile proxies/accessors and synchronous or asynchronous sink failure", async () => {
    const sink = vi.fn();
    expect(
      jobObservation(
        new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw Error("private-sentinel");
            },
          },
        ),
      ),
    ).toBeNull();
    expect(
      jobObservation(
        Object.defineProperty({}, "phase", {
          get() {
            throw Error("private-sentinel");
          },
        }),
      ),
    ).toBeNull();
    expect(() =>
      emitJobObservation(() => {
        throw Error("private-sentinel");
      }, sink),
    ).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
    expect(() =>
      emitJobObservation(
        () => ({ phase: "executor", outcome: "stale" }),
        () => {
          throw Error("private-sentinel");
        },
      ),
    ).not.toThrow();
    expect(
      emitJobObservation(
        () => ({ phase: "executor", outcome: "stale" }),
        () => Promise.reject(Error("private-sentinel")),
      ),
    ).toBeUndefined();
    await Promise.resolve();
  });
});

describe("unchanged dispatch results and release behavior", () => {
  it("retains the same event identity and counts for accepted handoff", async () => {
    vi.mocked(leaseJobs).mockResolvedValueOnce([job]);
    vi.mocked(recordHandoff).mockResolvedValue(true);
    const send = vi.fn<EventSender>().mockResolvedValue({ ids: [sdkId] });
    expect(await dispatchOutbox(database, bindings, send)).toEqual({
      leased: 1,
      accepted: 1,
      failed: 0,
    });
    expect(send.mock.calls[0][0]).toMatchObject({
      id: id + ":1",
      data: { jobId: id, sellerId: otherId, generation: 1 },
    });
    expect(recordHandoff).toHaveBeenCalledExactlyOnceWith(database, job, sdkId);
    expect(releaseDispatch).not.toHaveBeenCalled();
    expect(observed().map((event) => [event.phase, event.outcome])).toEqual([
      ["handoff", "accepted"],
      ["batch", "completed"],
    ]);
    expect(logs.join(" ")).not.toContain(otherId);
  });
  it("retains unrecorded acceptance as zero accepted/failed and observes stale", async () => {
    vi.mocked(leaseJobs).mockResolvedValueOnce([job]);
    vi.mocked(recordHandoff).mockResolvedValue(false);
    expect(
      await dispatchOutbox(database, bindings, async () => ({ ids: [sdkId] })),
    ).toEqual({ leased: 1, accepted: 0, failed: 0 });
    expect(releaseDispatch).not.toHaveBeenCalled();
    expect(observed()[0].outcome).toBe("stale");
  });
  it("releases the original job once after failed send even when the log sink throws", async () => {
    vi.mocked(leaseJobs).mockResolvedValueOnce([job]);
    vi.mocked(console.info).mockImplementation(() => {
      throw Error("sink unavailable");
    });
    expect(
      await dispatchOutbox(database, bindings, async () => {
        throw Error("private-sentinel");
      }),
    ).toEqual({ leased: 1, accepted: 0, failed: 1 });
    expect(releaseDispatch).toHaveBeenCalledExactlyOnceWith(database, job);
    expect(recordHandoff).not.toHaveBeenCalled();
  });
  it("preserves release and lease exceptions while observing partial batch failure", async () => {
    const failure = Error("private-sentinel");
    vi.mocked(leaseJobs).mockResolvedValueOnce([job]);
    vi.mocked(releaseDispatch).mockRejectedValueOnce(failure);
    await expect(
      dispatchOutbox(database, bindings, async () => ({ ids: [] })),
    ).rejects.toBe(failure);
    expect(releaseDispatch).toHaveBeenCalledTimes(1);
    expect(observed().map((event) => event.outcome)).toEqual([
      "failed",
      "failed",
    ]);
    expect(logs.join(" ")).not.toContain("private-sentinel");
    logs = [];
    vi.mocked(leaseJobs).mockRejectedValueOnce(failure);
    await expect(
      dispatchOutbox(database, bindings, async () => ({ ids: [] })),
    ).rejects.toBe(failure);
    expect(observed()).toMatchObject([
      { phase: "batch", outcome: "failed", leased: 0, accepted: 0, failed: 0 },
    ]);
  });
});

describe("unchanged executor outcome, sanitation and retry policy", () => {
  it.each([
    new JobError("INVALID_INPUT"),
    new JobError("NOT_FOUND"),
    new SellerError("FORBIDDEN"),
    new JobError("BUSY"),
    Object.assign(new Error("private-sentinel"), {
      code: "private-sentinel",
      cause: new Error("private-sentinel"),
    }),
  ])(
    "sanitizes and classifies %s before the actual SDK serializes the step error",
    async (failure) => {
      vi.mocked(executeJob).mockRejectedValue(failure);
      const fn = executor();
      const input = executorInput();
      let recorded: unknown;
      input.step.run = async (_name, operation) => {
        try {
          return await operation();
        } catch (error) {
          recorded = serializeError(error);
          throw error;
        }
      };
      await expect(fn.run(input)).rejects.toThrow();
      const permanent =
        failure instanceof SellerError ||
        (failure instanceof JobError && failure.code !== "BUSY");
      expect(recorded).toMatchObject({
        name: permanent ? "NonRetriableError" : "Error",
        message: permanent
          ? "Treido job input or authority was rejected."
          : "Treido durable effect is unavailable; retry with the same identity.",
      });
      expect(JSON.stringify(recorded)).not.toContain("private-sentinel");
      expect(recorded).not.toHaveProperty("code");
      expect((recorded as { cause?: unknown }).cause).toBeUndefined();
    },
  );
  it.each(["completed", "cancelled", "stale"] as const)(
    "returns the original %s outcome without logging private event fields",
    async (status) => {
      const result = { jobId: id, status };
      vi.mocked(executeJob).mockResolvedValue(result);
      const fn = executor();
      expect(await fn.run(executorInput())).toBe(result);
      expect(executeJob).toHaveBeenCalledTimes(1);
      expect(observed()[0]).toMatchObject({
        phase: "executor",
        outcome: status,
        jobId: id,
        generation: 1,
        runId: sdkId,
        eventId: sdkId,
      });
      expect(logs.join(" ")).not.toContain("private-sentinel");
      expect(logs.join(" ")).not.toContain(otherId);
      expect(fn.options.retries).toBe(4);
    },
  );
  it("preserves non-retriable rejection and reads the original authority error code only once", async () => {
    const error = new JobError("FORBIDDEN"),
      read = vi.fn(() => "FORBIDDEN");
    Object.defineProperty(error, "code", { get: read });
    vi.mocked(executeJob).mockRejectedValue(error);
    await expect(executor().run(executorInput())).rejects.toBeInstanceOf(
      NonRetriableError,
    );
    expect(read).toHaveBeenCalledTimes(1);
    expect(observed()[0].errorClass).toBe("authority_rejected");
  });
  it("retains the fixed retriable exception despite a failed observer sink", async () => {
    vi.mocked(executeJob).mockRejectedValue(Error("private-sentinel"));
    vi.mocked(console.info).mockImplementation(() => {
      throw Error("sink unavailable");
    });
    await expect(executor().run(executorInput())).rejects.toThrow(
      "Treido durable effect is unavailable; retry with the same identity.",
    );
  });
  it("retains the original terminal failure callback and quiet SDK settings", async () => {
    vi.mocked(markExecutorFailure).mockResolvedValue(undefined);
    const fn = executor();
    const onFailure = fn.options.onFailure as (
      input: unknown,
    ) => Promise<unknown>;
    const data = executorInput().event.data;
    await onFailure({ event: { data: { event: { id: sdkId, data } } } });
    expect(markExecutorFailure).toHaveBeenCalledExactlyOnceWith(
      database,
      data,
      bindings,
    );
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "Treido durable job exhausted its executor retries.",
    );
    expect(observed()[0]).toMatchObject({
      phase: "exhaustion",
      outcome: "exhausted",
      jobId: id,
      generation: 1,
    });
    const settings = sdk.options as {
      logger: unknown;
      internalLogger: unknown;
    };
    expect(settings.logger).toBe(settings.internalLogger);
    expect(logs.join(" ")).not.toContain("private-sentinel");
  });
  it("retains failure-recording rejection instead of reporting an exhausted persisted job", async () => {
    const failure = Error("private-sentinel");
    vi.mocked(markExecutorFailure).mockRejectedValue(failure);
    const fn = executor();
    const onFailure = fn.options.onFailure as (
      input: unknown,
    ) => Promise<unknown>;
    await expect(
      onFailure({
        event: { data: { event: { data: executorInput().event.data } } },
      }),
    ).rejects.toThrow("Treido executor failure recording is unavailable.");
    expect(observed()[0]).toMatchObject({
      phase: "exhaustion",
      outcome: "failed",
      errorClass: "exhaustion_unavailable",
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});
