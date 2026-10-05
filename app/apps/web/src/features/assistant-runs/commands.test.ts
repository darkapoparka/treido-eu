import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  query: vi.fn(),
  human: vi.fn(),
  actor: vi.fn(),
  budget: vi.fn(),
  policy: vi.fn(),
  consent: vi.fn(),
  workspace: vi.fn(),
  run: vi.fn(),
  lifecycle: vi.fn(),
  reserve: vi.fn(),
  catalogue: vi.fn(),
  execute: vi.fn(),
  complete: vi.fn(),
  gateway: vi.fn(),
  mediaStorage: vi.fn(),
  register: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (
    _db: unknown,
    work: (tx: unknown) => Promise<unknown>,
  ) => work({ client: { query: m.query } }),
}));
vi.mock("../sellers/persistence.server", async () => {
  const { createHash } = await import("node:crypto");
  return {
    authorizeHuman: m.human,
    inputHash: (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex"),
  };
});
vi.mock("../assistant-tools/storage.server", () => ({
  requireAssistantStorage: vi.fn(),
  requireAssistantActor: m.actor,
  checkAssistantBudget: m.budget,
}));
vi.mock("./storage.server", () => ({
  requireInputStorage: vi.fn(),
  inputWorkspace: m.workspace,
  ownedInputRun: m.run,
  ownedInputMedia: vi.fn(),
  requireInputConsent: m.consent,
  requireInputLifecycle: m.lifecycle,
  reserveInputMoney: m.reserve,
  lockInputSpending: vi.fn(),
}));
vi.mock("./policy.server", async () => {
  const { SellerError } = await import("../sellers/errors");
  return {
    runtimePolicy: m.policy,
    requirePolicy: (policy: unknown) => {
      if (!policy) throw new SellerError("NOT_AVAILABLE");
      return policy;
    },
  };
});
vi.mock("./media.server", () => ({
  inputMediaStorage: m.mediaStorage,
  registerInputObject: m.register,
  claimMediaValidation: vi.fn(),
  completeInputMedia: m.complete,
}));
vi.mock("./provider.server", () => ({ gatewayAdapter: m.gateway }));
vi.mock("./execution.server", () => ({ performAssistantInput: m.execute }));
vi.mock("./catalogue.server", () => ({ inputCatalogue: m.catalogue }));
import { changeAssistantInput } from "./commands.server";
import { inputHash } from "../sellers/persistence.server";
import { parseInputCommand, type InputCommand } from "./model";
import { SellerError } from "../sellers/errors";
import { isolatedPolicy } from "./test-fixtures";
import type { SellerDatabase } from "../../server/db/database";
const database = {} as SellerDatabase,
  identity = { subject: "user_alice" },
  userId = "10000000-0000-4000-8000-000000000002",
  runId = "10000000-0000-4000-8000-000000000003";
const command: InputCommand = {
  actorKey: "a".repeat(64),
  requestId: "10000000-0000-4000-8000-000000000004",
  expectedRevision: 2,
  mode: "text",
  operation: { kind: "execute", runId, confirmed: true },
};
let prior: {
    hash: string;
    revision: number;
    runId: string | null;
    assetId: string | null;
  } | null,
  hasReceipt: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  m.actor.mockReset();
  prior = null;
  hasReceipt = false;
  m.human.mockResolvedValue({ id: userId });
  m.workspace.mockResolvedValue({ revision: 2, runId, assetId: null });
  m.run.mockResolvedValue({
    id: runId,
    policyId: isolatedPolicy.id,
    expired: false,
    state: "reserved",
    steps: 0,
  });
  m.policy.mockResolvedValue(isolatedPolicy);
  m.mediaStorage.mockReturnValue({
    scope: isolatedPolicy.config.mediaScope,
    prefix: "isolated/",
  });
  m.consent.mockResolvedValue(undefined);
  m.budget.mockResolvedValue(undefined);
  m.lifecycle.mockResolvedValue(undefined);
  m.execute.mockImplementation(async () => {
    expect(hasReceipt).toBe(true);
  });
  m.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith("SELECT input_hash"))
      return { rows: prior ? [prior] : [] };
    if (sql.startsWith("INSERT INTO treido.buyer_assistant_receipts"))
      hasReceipt = true;
    return { rows: [], rowCount: 1 };
  });
});
it("authenticates the actor and accepts the immutable original receipt before one external execution", async () => {
  await expect(
    changeAssistantInput(database, identity, command, async () => identity),
  ).resolves.toEqual({ revision: 3, runId, assetId: null, replayed: false });
  expect(m.actor).toHaveBeenCalledWith(identity, command.actorKey);
  expect(m.execute).toHaveBeenCalledTimes(1);
  expect(m.execute.mock.calls[0].slice(0, 4)).toEqual([
    database,
    identity,
    runId,
    "text",
  ]);
  expect(m.budget.mock.calls[0][2]).toBe(false);
});
it("staging registers the original one-clock fixed expiry before any external upload or validation", async () => {
  m.workspace.mockResolvedValue({ revision: 2, runId: null, assetId: null });
  const expiry = new Date("2030-01-01T00:10:00Z"),
    writeUntil = new Date("2030-01-01T00:20:00Z");
  m.query.mockImplementation(async (sql: string) =>
    sql.includes("WITH lifetime AS MATERIALIZED")
      ? { rows: [{ expiresAt: expiry, writeUntil }] }
      : sql.includes("count(*)::int AS count")
        ? { rows: [{ count: 0 }] }
        : { rows: [], rowCount: 1 },
  );
  const result = await changeAssistantInput(
    database,
    identity,
    {
      ...command,
      mode: "voice",
      operation: {
        kind: "stage",
        policyId: isolatedPolicy.id,
        bytes: 100,
        contentType: "audio/wav",
        checksum: "b".repeat(64),
        confirmed: true,
      },
    },
    async () => identity,
  );
  expect(result.assetId).not.toBeNull();
  expect(m.register).toHaveBeenCalledTimes(1);
  expect(m.register.mock.calls[0][1]).toMatchObject({
    id: result.assetId,
    userId,
    expiresAt: expiry,
    writeUntil,
  });
  const insertion = m.query.mock.calls.find(([sql]) =>
    sql.includes("INSERT INTO treido.assistant_media_assets"),
  )!;
  expect(insertion[0].match(/clock_timestamp\(\)/g)).toHaveLength(1);
  expect(insertion[1].slice(-2)).toEqual([600, 600]);
  expect(m.execute).not.toHaveBeenCalled();
  expect(m.complete).not.toHaveBeenCalled();
  expect(m.gateway).not.toHaveBeenCalled();
});
it("identical original replay returns its receipt before approval/quota/revision changes and never repeats an effect", async () => {
  prior = {
    hash: inputHash(parseInputCommand(command)),
    revision: 3,
    runId,
    assetId: null,
  };
  m.workspace.mockResolvedValue({ revision: 19, runId: null, assetId: null });
  m.policy.mockRejectedValue(new Error("revoked registry"));
  m.budget.mockRejectedValue(new Error("no budget"));
  await expect(
    changeAssistantInput(database, identity, command, async () => identity),
  ).resolves.toEqual({ revision: 3, runId, assetId: null, replayed: true });
  expect(m.policy).not.toHaveBeenCalled();
  expect(m.budget).not.toHaveBeenCalled();
  expect(m.lifecycle).not.toHaveBeenCalled();
  expect(m.execute).not.toHaveBeenCalled();
  expect(m.complete).not.toHaveBeenCalled();
  expect(hasReceipt).toBe(false);
});
it("a reused receipt with changed input fails without a new effect or receipt", async () => {
  prior = {
    hash: inputHash(parseInputCommand(command)),
    revision: 3,
    runId,
    assetId: null,
  };
  await expect(
    changeAssistantInput(
      database,
      identity,
      { ...command, mode: "voice" },
      async () => identity,
    ),
  ).rejects.toThrow("CONFLICT");
  expect(m.execute).not.toHaveBeenCalled();
  expect(m.budget).not.toHaveBeenCalled();
  expect(hasReceipt).toBe(false);
});
it("withdraws the current own-mode choice even when the current policy is missing or has changed", async () => {
  m.workspace.mockResolvedValue({ revision: 2, runId: null, assetId: null });
  m.policy.mockRejectedValue(new Error("no current policy"));
  await changeAssistantInput(
    database,
    identity,
    {
      ...command,
      operation: {
        kind: "consent",
        policyId: isolatedPolicy.id,
        granted: false,
        confirmed: true,
      },
    },
    async () => identity,
  );
  const update = m.query.mock.calls.find(([sql]) =>
    sql.startsWith("UPDATE treido.buyer_assistant_consents"),
  )!;
  expect(update[0]).toContain("WHERE user_id=$1 AND mode=$2");
  expect(update[0]).not.toContain("policy_id=$3");
  expect(update[1]).toEqual([userId, "text"]);
  expect(m.policy).not.toHaveBeenCalled();
  expect(m.gateway).not.toHaveBeenCalled();
  expect(m.lifecycle).not.toHaveBeenCalled();
  expect(m.execute).not.toHaveBeenCalled();
});
it("current consent, lifecycle and exact owned run are required for a new execution", async () => {
  m.consent.mockRejectedValue(new SellerError("FORBIDDEN"));
  await expect(
    changeAssistantInput(database, identity, command, async () => identity),
  ).rejects.toThrow("FORBIDDEN");
  expect(m.execute).not.toHaveBeenCalled();
  expect(hasReceipt).toBe(false);
  m.consent.mockResolvedValue(undefined);
  m.run.mockRejectedValue(new SellerError("NOT_FOUND"));
  await expect(
    changeAssistantInput(database, identity, command, async () => identity),
  ).rejects.toThrow("NOT_FOUND");
  expect(m.execute).not.toHaveBeenCalled();
  expect(hasReceipt).toBe(false);
});
it("rejects stale revisions and actor changes before a provider or recovery mutation", async () => {
  await expect(
    changeAssistantInput(
      database,
      identity,
      { ...command, expectedRevision: 1 },
      async () => identity,
    ),
  ).rejects.toThrow("CONFLICT");
  expect(m.execute).not.toHaveBeenCalled();
  expect(m.budget).not.toHaveBeenCalled();
  m.query.mockClear();
  m.actor.mockImplementation(() => {
    throw new SellerError("UNAUTHENTICATED");
  });
  await expect(
    changeAssistantInput(database, identity, command, async () => identity),
  ).rejects.toThrow("UNAUTHENTICATED");
  expect(m.query).not.toHaveBeenCalled();
  expect(m.execute).not.toHaveBeenCalled();
});
