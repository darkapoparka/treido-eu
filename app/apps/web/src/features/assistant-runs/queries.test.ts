import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  query: vi.fn(),
  human: vi.fn(),
  policy: vi.fn(),
  lifecycle: vi.fn(),
  workspace: vi.fn(),
  run: vi.fn(),
  media: vi.fn(),
  catalogue: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (
    _db: unknown,
    work: (tx: unknown) => Promise<unknown>,
  ) => work({ client: { query: m.query } }),
}));
vi.mock("../sellers/persistence.server", () => ({ authorizeHuman: m.human }));
vi.mock("../assistant-tools/storage.server", () => ({
  assistantActorKey: () => "a".repeat(64),
}));
vi.mock("./storage.server", () => ({
  requireInputStorage: vi.fn(),
  inputLifecycleReady: m.lifecycle,
  inputWorkspace: m.workspace,
  ownedInputRun: m.run,
  ownedInputMedia: m.media,
}));
vi.mock("./policy.server", () => ({ runtimePolicy: m.policy }));
vi.mock("./catalogue.server", () => ({ inputCatalogue: m.catalogue }));
import { readAssistantInput } from "./queries.server";
import { SellerError } from "../sellers/errors";
import { isolatedPolicy } from "./test-fixtures";
import type { SellerDatabase } from "../../server/db/database";
const database = {} as SellerDatabase,
  identity = { subject: "user_alice" },
  userId = "10000000-0000-4000-8000-000000000002",
  runId = "10000000-0000-4000-8000-000000000003",
  assetId = "10000000-0000-4000-8000-000000000004";
let allowed: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  allowed = true;
  m.human.mockResolvedValue({ id: userId });
  m.policy.mockResolvedValue(isolatedPolicy);
  m.lifecycle.mockResolvedValue(true);
  m.workspace.mockResolvedValue({ revision: 5, runId, assetId });
  m.run.mockResolvedValue({
    id: runId,
    policyId: isolatedPolicy.id,
    state: "accepted",
    input: { criteria: "q=Sony", prompt: "Private prompt" },
    proposal: {
      criteria: "q=Sony",
      itemType: null,
      colour: null,
      style: null,
      transcript: "Private transcript",
    },
    accepted: "q=Sony",
    expiresAt: new Date("2030-01-01"),
    expired: false,
  });
  m.media.mockResolvedValue({
    id: assetId,
    mode: "voice",
    state: "ready",
    expiresAt: new Date("2030-01-01"),
    writeUntil: new Date("2030-01-01T00:10:00Z"),
    bytes: 100,
    contentType: "audio/wav",
    checksum: "b".repeat(64),
    expired: false,
  });
  m.catalogue.mockResolvedValue({ items: [], nextCursor: null });
  m.query.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM treido.buyer_assistant_consents"))
      return {
        rows: [{ allowed, policyId: isolatedPolicy.id, granted: true }],
      };
    if (sql.includes("FROM treido.assistant_run_reservations"))
      return { rows: [{ status: "unknown" }] };
    throw new Error("Unexpected read query");
  });
});
it("opening the input never creates a human, workspace, grant, run or provider effect", async () => {
  m.human.mockRejectedValue(new SellerError("NOT_FOUND"));
  const view = await readAssistantInput(database, identity, "text");
  expect(view.revision).toBe(0);
  expect(view.run).toBeNull();
  expect(view.consentChoice).toBeNull();
  expect(m.human.mock.calls[0][2]).toBe(false);
  expect(m.query).not.toHaveBeenCalled();
  expect(m.catalogue).not.toHaveBeenCalled();
});
it("old, expired or revoked processing consent stays explicitly withdrawable while every private result is hidden", async () => {
  for (const policy of [
    null,
    { ...isolatedPolicy, id: "10000000-0000-4000-8000-000000000005" },
    isolatedPolicy,
  ]) {
    m.policy.mockResolvedValue(policy);
    allowed = false;
    m.catalogue.mockClear();
    const view = await readAssistantInput(database, identity, "voice");
    expect(view.consent).toBe(false);
    expect(view.consentChoice).toEqual({
      policyId: isolatedPolicy.id,
      granted: true,
    });
    expect(view.run?.prompt).toBeNull();
    expect(view.run?.proposal).toBeNull();
    expect(view.run?.criteria).toBeNull();
    expect(view.run?.reviewedCriteria).toBeNull();
    expect(view.asset?.preview).toBeNull();
    expect(view.asset?.checksum).toBe("");
    expect(view.results).toBeNull();
    expect(m.catalogue).not.toHaveBeenCalled();
  }
});
it("accepted criteria use the current owned catalogue only with current usable consent and the original policy", async () => {
  const view = await readAssistantInput(database, identity, "voice");
  expect(m.catalogue.mock.calls[0].slice(1)).toEqual([userId, "q=Sony"]);
  expect(view.results).not.toBeNull();
  expect(view.run?.budgetPending).toBe(true);
  m.lifecycle.mockResolvedValue(false);
  const unavailable = await readAssistantInput(database, identity, "voice");
  expect(unavailable.policy?.modes).toEqual([]);
  expect(unavailable.consentChoice?.granted).toBe(true);
});
it("authority and metadata failures propagate without sample results or a fabricated empty success", async () => {
  m.human.mockRejectedValue(new SellerError("FORBIDDEN"));
  await expect(readAssistantInput(database, identity, "voice")).rejects.toThrow(
    "FORBIDDEN",
  );
  m.human.mockResolvedValue({ id: userId });
  m.query.mockRejectedValue(new Error("metadata denied"));
  await expect(readAssistantInput(database, identity, "voice")).rejects.toThrow(
    "metadata denied",
  );
  expect(m.catalogue).not.toHaveBeenCalled();
});
