import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  human: vi.fn(),
  run: vi.fn(),
  workspace: vi.fn(),
  consent: vi.fn(),
  policy: vi.fn(),
  interpret: vi.fn(),
  bytes: vi.fn(),
  lifecycle: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (
    _db: unknown,
    work: (tx: unknown) => Promise<unknown>,
  ) => work({ client: { query: mocks.query }, db: {} }),
}));
vi.mock("../sellers/persistence.server", () => ({
  authorizeHuman: mocks.human,
}));
vi.mock("./storage.server", () => ({
  requireInputStorage: vi.fn(),
  requireInputLifecycle: mocks.lifecycle,
  ownedInputRun: mocks.run,
  inputWorkspace: mocks.workspace,
  requireInputConsent: mocks.consent,
  lockInputSpending: vi.fn(),
}));
vi.mock("./policy.server", async () => {
  const { SellerError } = await import("../sellers/errors");
  return {
    runtimePolicy: mocks.policy,
    requirePolicy: (policy: unknown) => {
      if (!policy) throw new SellerError("NOT_AVAILABLE");
      return policy;
    },
    parsePolicyConfig: vi.fn(),
  };
});
vi.mock("./provider.server", () => ({
  gatewayAdapter: () => ({ interpret: mocks.interpret }),
  verifiedUsage: () => false,
}));
vi.mock("./media.server", () => ({ readOwnedInputBytes: mocks.bytes }));
import { performAssistantInput } from "./execution.server";
import { SellerError } from "../sellers/errors";
import { isolatedPolicy } from "./test-fixtures";
import type { SellerDatabase } from "../../server/db/database";
import type { InputRun } from "./storage.server";
const database = {} as SellerDatabase,
  identity = { subject: "user_alice" },
  userId = "10000000-0000-4000-8000-000000000002",
  runId = "10000000-0000-4000-8000-000000000003";
let current: InputRun, emitted: boolean, budget: string;
const proposed = {
  criteria: "q=Sony",
  itemType: "camera",
  colour: null,
  style: null,
  transcript: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  emitted = false;
  budget = "calling";
  current = {
    id: runId,
    userId,
    mode: "text",
    policyId: isolatedPolicy.id,
    mediaId: null,
    state: "calling",
    input: { criteria: "q=Sony", prompt: "Camera" },
    proposal: null,
    accepted: null,
    providerId: null,
    steps: 0,
    expiresAt: new Date("2030-01-01"),
    expired: false,
  };
  mocks.human.mockResolvedValue({ id: userId, status: "active" });
  mocks.run.mockImplementation(async () => ({ ...current }));
  mocks.workspace.mockResolvedValue({ runId, assetId: null, revision: 1 });
  mocks.policy.mockResolvedValue(isolatedPolicy);
  mocks.consent.mockResolvedValue(undefined);
  mocks.lifecycle.mockResolvedValue(undefined);
  mocks.interpret.mockResolvedValue({ proposal: proposed, generationId: null });
  mocks.query.mockImplementation(
    async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("SELECT u.id"))
        return { rows: [{ id: userId }], rowCount: 1 };
      if (sql.includes("SET emission_started_at")) {
        if (emitted) return { rows: [], rowCount: 0 };
        emitted = true;
        current.steps = 1;
        return { rows: [{ id: runId }], rowCount: 1 };
      }
      if (sql.includes("SET state=CASE WHEN emission_started_at")) {
        if (current.state === "calling" && (params[3] === true || !emitted)) {
          current.state = emitted ? "unknown" : "failed";
        }
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("UPDATE treido.assistant_run_reservations b")) {
        if (budget === "calling" && (params[3] === true || !emitted)) {
          budget = emitted ? "unknown" : "released";
        }
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SET state='proposed'")) {
        current.state = "proposed";
        current.proposal = proposed;
      }
      if (sql.includes("SET status='unknown'")) budget = "unknown";
      return { rows: [], rowCount: 1 };
    },
  );
});
it("initial foreign owner/mode rejection has no recovery mutation or provider emission", async () => {
  for (const code of ["NOT_FOUND", "FORBIDDEN"] as const) {
    mocks.query.mockClear();
    mocks.run.mockRejectedValue(new SellerError(code));
    await expect(
      performAssistantInput(
        database,
        identity,
        runId,
        "voice",
        async () => identity,
      ),
    ).rejects.toThrow(code);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.interpret).not.toHaveBeenCalled();
    expect(current.state).toBe("calling");
    expect(budget).toBe("calling");
  }
});
it("a known pre-emission byte failure releases only its original authorized unused reservation", async () => {
  current.mediaId = "10000000-0000-4000-8000-000000000004";
  mocks.bytes.mockRejectedValue(new SellerError("INVALID_INPUT"));
  await expect(
    performAssistantInput(
      database,
      identity,
      runId,
      "text",
      async () => identity,
    ),
  ).rejects.toThrow("INVALID_INPUT");
  expect(emitted).toBe(false);
  expect(current.state).toBe("failed");
  expect(budget).toBe("released");
  expect(mocks.interpret).not.toHaveBeenCalled();
  const recovery = mocks.query.mock.calls.find(([sql]) =>
    sql.includes("SET state=CASE WHEN emission_started_at"),
  )!;
  expect(recovery[1]).toEqual([runId, userId, "text", false]);
  expect(recovery[0]).toContain("emission_started_at IS NULL AND steps=0");
});
it("a response lost after committed emission remains unknown and retains the charge", async () => {
  mocks.interpret.mockRejectedValue(new Error("response lost"));
  await expect(
    performAssistantInput(
      database,
      identity,
      runId,
      "text",
      async () => identity,
    ),
  ).rejects.toThrow("response lost");
  expect(emitted).toBe(true);
  expect(current.state).toBe("unknown");
  expect(budget).toBe("unknown");
  expect(mocks.interpret).toHaveBeenCalledTimes(1);
});
it("two initial snapshots produce one emission and a losing claimant cannot invalidate the winner", async () => {
  let snapshots = 0,
    releaseSnapshots!: () => void,
    finishProvider!: () => void,
    releaseLoser!: () => void;
  const barrier = new Promise<void>((resolve) => {
    releaseSnapshots = resolve;
  });
  mocks.run.mockImplementation(
    async (
      _tx: unknown,
      _user: string,
      _mode: string,
      _id: string,
      lock: boolean,
    ) => {
      const snapshot = { ...current };
      if (!lock) {
        snapshots++;
        if (snapshots <= 2) {
          if (snapshots === 2) releaseSnapshots();
          await barrier;
        }
      }
      return snapshot;
    },
  );
  const waiting = new Promise<void>((resolve) => {
    finishProvider = resolve;
  });
  const loserRecovered = new Promise<void>((resolve) => {
    releaseLoser = resolve;
  });
  const originalQuery = mocks.query.getMockImplementation()!;
  mocks.query.mockImplementation(
    async (sql: string, params: unknown[] = []) => {
      const result = await originalQuery(sql, params);
      if (
        sql.includes("UPDATE treido.assistant_run_reservations b") &&
        params[3] === false
      )
        releaseLoser();
      return result;
    },
  );
  mocks.interpret.mockImplementation(async () => {
    await waiting;
    return { proposal: proposed, generationId: null };
  });
  const first = performAssistantInput(
      database,
      identity,
      runId,
      "text",
      async () => identity,
    ),
    second = performAssistantInput(
      database,
      identity,
      runId,
      "text",
      async () => identity,
    );
  // Attach handlers immediately; whichever won stays in the original in-flight
  // request. The other finishes conflict without changing its committed marker.
  const settled = Promise.allSettled([first, second]);
  await loserRecovered;
  expect(mocks.interpret).toHaveBeenCalledTimes(1);
  expect(current.state).toBe("calling");
  expect(budget).toBe("calling");
  finishProvider();
  const outcomes = await settled;
  expect(outcomes.filter((row) => row.status === "fulfilled")).toHaveLength(1);
  expect(current.state).toBe("proposed");
  expect(budget).toBe("unknown");
});
it("post-response account switch or cancellation cannot publish a late private proposal", async () => {
  let fresh = 0;
  await expect(
    performAssistantInput(database, identity, runId, "text", async () =>
      ++fresh === 1 ? identity : { subject: "user_bob" },
    ),
  ).rejects.toThrow("UNAUTHENTICATED");
  expect(current.proposal).toBeNull();
  expect(budget).toBe("unknown");
  current.state = "calling";
  current.steps = 0;
  emitted = false;
  budget = "calling";
  mocks.interpret.mockImplementation(async () => {
    current.state = "cancelled";
    current.input = null;
    return { proposal: proposed, generationId: null };
  });
  await expect(
    performAssistantInput(
      database,
      identity,
      runId,
      "text",
      async () => identity,
    ),
  ).rejects.toThrow("CONFLICT");
  expect(current.state).toBe("cancelled");
  expect(current.proposal).toBeNull();
  expect(budget).toBe("unknown");
});
