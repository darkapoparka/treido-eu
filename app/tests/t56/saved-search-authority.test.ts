import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
const mocks = vi.hoisted(() => ({ authorizeHuman: vi.fn(), start: vi.fn() }));
vi.mock("../../apps/web/src/server/db/database", () => ({
  inTransaction: (database: { tx: unknown }, work: (tx: unknown) => unknown) =>
    work(database.tx),
}));
vi.mock("../../apps/web/src/features/catalog/public-discovery.server", () => ({
  publicDiscoveryKey: () => Buffer.alloc(32, 7),
}));
vi.mock("../../apps/web/src/features/sellers/persistence.server", () => ({
  authorizeHuman: mocks.authorizeHuman,
  inputHash: (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex"),
}));
vi.mock("../../apps/web/src/features/saved-searches/runs.server", () => ({
  startSearchRun: mocks.start,
  runStepKey: (id: string, step: number) => id + ":" + step,
  runColumns: "test-run-columns",
}));
import { changeSavedSearch } from "../../apps/web/src/features/saved-searches/commands.server";
import { readSavedSearches } from "../../apps/web/src/features/saved-searches/queries.server";
import { authorizeSearchJob } from "../../apps/web/src/features/saved-searches/job-authority.server";
import { searchActorKey } from "../../apps/web/src/features/saved-searches/storage.server";
import {
  parseSearchCommand,
  reviewedCriteria,
} from "../../apps/web/src/features/saved-searches/model";
import { parseToolIntent } from "../../apps/web/src/features/shopping-tools/intent";
import { SellerError } from "../../apps/web/src/features/sellers/errors";
import type {
  SellerDatabase,
  SellerTransaction,
} from "../../apps/web/src/server/db/database";
import type { BuyerJobRow } from "../../apps/web/src/server/jobs/outbox.server";

const userId = "00000000-0000-4000-8000-000000000001";
const searchId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const identity = { subject: "synthetic-t56-user" };
const criteria = reviewedCriteria(
  parseToolIntent("q=phone&maxPrice=100", "find-for-me"),
  "find-for-me",
);
const command = {
  actorKey: searchActorKey(identity),
  expectedRevision: 2,
  requestId,
  operation: {
    kind: "save",
    name: "Phone",
    criteria,
    enable: false,
    frequency: 1440,
  },
};
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("T56 saved-search current authority/recovery — mocked transport, no database proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeHuman.mockResolvedValue({ id: userId });
  });
  function database({
    ready = true,
    receipt,
    revision = 2,
  }: { ready?: boolean; receipt?: unknown; revision?: number } = {}) {
    const query = vi.fn(async (text: string) => {
      if (text.includes("to_regclass")) return { rows: [{ ready }] };
      if (text.includes("SELECT revision")) return { rows: [{ revision }] };
      if (text.includes("SELECT input_hash"))
        return { rows: receipt ? [receipt] : [] };
      return { rows: [{ count: 0 }] };
    });
    return {
      query,
      db: { tx: { client: { query } } } as unknown as SellerDatabase,
    };
  }
  it("fails missing real storage before creating a human or workspace", async () => {
    const { db, query } = database({ ready: false });
    await expect(
      changeSavedSearch(db, identity, command),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(mocks.authorizeHuman).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("refuses an old account fingerprint before touching storage", async () => {
    const { db, query } = database();
    await expect(
      changeSavedSearch(db, { subject: "other-account" }, command),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(query).not.toHaveBeenCalled();
  });
  it("propagates current revocation instead of acknowledging historical requests", async () => {
    mocks.authorizeHuman.mockRejectedValue(new SellerError("FORBIDDEN"));
    const { db } = database({
      receipt: {
        hash: hash(parseSearchCommand(command)),
        revision: 3,
        searchId,
        version: 1,
      },
    });
    await expect(
      changeSavedSearch(db, identity, command),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("acknowledges exact historical criteria before current-registry validation", async () => {
    const original = {
      ...command,
      operation: {
        ...command.operation,
        criteria: {
          ...criteria,
          registry: criteria.registry + 1,
          query: "original-unsupported=kept",
        },
      },
    };
    const { db } = database({
      receipt: {
        hash: hash(parseSearchCommand(original, true)),
        revision: 3,
        searchId,
        version: 1,
      },
    });
    await expect(changeSavedSearch(db, identity, original)).resolves.toEqual({
      revision: 3,
      searchId,
      version: 1,
      replayed: true,
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("rejects historical unaccepted criteria and does not relax them", async () => {
    const original = {
      ...command,
      operation: {
        ...command.operation,
        criteria: { ...criteria, registry: criteria.registry + 1 },
      },
    };
    await expect(
      changeSavedSearch(database().db, identity, original),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("rejects a changed command under the original request id", async () => {
    const { db } = database({
      receipt: {
        hash: hash(parseSearchCommand(command)),
        revision: 3,
        searchId,
        version: 1,
      },
    });
    await expect(
      changeSavedSearch(db, identity, {
        ...command,
        operation: { ...command.operation, enable: true },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("rejects a stale new command before scheduling", async () => {
    await expect(
      changeSavedSearch(database({ revision: 4 }).db, identity, command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("GET/read with missing storage is unavailable, never sample empty success", async () => {
    await expect(
      readSavedSearches(database({ ready: false }).db, identity),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(mocks.authorizeHuman).not.toHaveBeenCalled();
  });
  it("a legitimate unregistered read creates zero human/workspace/subscription rows", async () => {
    mocks.authorizeHuman.mockRejectedValue(new SellerError("NOT_FOUND"));
    const { db, query } = database();
    await expect(readSavedSearches(db, identity)).resolves.toMatchObject({
      searches: [],
      revision: 0,
    });
    expect(mocks.authorizeHuman).toHaveBeenCalledWith(
      expect.anything(),
      identity,
      false,
    );
    expect(
      query.mock.calls.every(([text]) => !/INSERT|UPDATE|DELETE/.test(text)),
    ).toBe(true);
  });
  it("a real read/storage transport failure remains a failure", async () => {
    const db = {
      tx: {
        client: {
          query: vi.fn().mockRejectedValue(new Error("transport down")),
        },
      },
    } as unknown as SellerDatabase;
    await expect(readSavedSearches(db, identity)).rejects.toThrow(
      "transport down",
    );
  });

  function jobSetup(
    patch: Record<string, unknown> = {},
    jobPatch: Record<string, unknown> = {},
  ) {
    const run = {
      id: requestId,
      userId,
      searchId,
      version: 1,
      generation: 2,
      state: "running",
      step: 1,
    };
    const search = {
      id: searchId,
      userId,
      criteria,
      version: 1,
      generation: 2,
      status: "enabled",
      consentAt: new Date(),
      ...patch,
    };
    const query = vi.fn(async (text: string) => {
      if (text.includes("to_regclass")) return { rows: [{ ready: true }] };
      if (text.includes("clerk_subject"))
        return { rows: [{ subject: identity.subject }] };
      if (text.includes("FROM treido.buyer_saved_search_runs"))
        return { rows: [run] };
      return { rows: [search] };
    });
    const tx = { client: { query } } as unknown as SellerTransaction;
    const job = {
      buyerId: userId,
      actorId: userId,
      resourceId: requestId,
      state: "pending",
      operationKey: requestId + ":1",
      ...jobPatch,
    } as unknown as BuyerJobRow;
    return { tx, job, run, search };
  }
  it.each([
    { status: "paused" },
    { status: "removed" },
    { consentAt: null },
    { generation: 3 },
    { version: 2 },
    { criteria: { ...criteria, registry: criteria.registry + 1 } },
  ])("revoked/superseded consent cannot execute matching %#", async (patch) => {
    const { tx, job } = jobSetup(patch);
    await expect(authorizeSearchJob(tx, job)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("valid current version/generation can proceed", async () => {
    const { tx, job, run, search } = jobSetup();
    await expect(authorizeSearchJob(tx, job)).resolves.toEqual({ run, search });
  });
  it.each([{ actorId: searchId }, { operationKey: "obsolete-step" }])(
    "forged buyer identity/stale executor step fails %#",
    async (patch) => {
      const { tx, job } = jobSetup({}, patch);
      await expect(authorizeSearchJob(tx, job)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    },
  );
  it("a completed effect replay still requires current consent", async () => {
    const { tx, job } = jobSetup({ status: "paused" }, { state: "completed" });
    await expect(authorizeSearchJob(tx, job)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
