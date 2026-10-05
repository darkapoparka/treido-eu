import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  human: vi.fn(),
  budget: vi.fn(),
  catalogue: vi.fn(),
  transactions: 0,
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (
    _db: unknown,
    work: (tx: unknown) => Promise<unknown>,
  ) => {
    mocks.transactions++;
    return work({ client: { query: mocks.query }, db: {} });
  },
}));
vi.mock("../sellers/persistence.server", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  authorizeHuman: mocks.human,
}));
vi.mock("../assistant-tools/storage.server", async () => {
  const { SellerError } = await import("../sellers/errors");
  const key = (identity: { subject: string }) =>
    identity.subject === "user_alice" ? "a".repeat(64) : "b".repeat(64);
  return {
    assistantActorKey: key,
    requireAssistantStorage: vi.fn(),
    checkAssistantBudget: mocks.budget,
    requireAssistantActor: (identity: { subject: string }, value: string) => {
      if (key(identity) !== value) throw new SellerError("UNAUTHENTICATED");
    },
  };
});
vi.mock("./catalogue.server", () => ({ giftCatalogue: mocks.catalogue }));
import { changeGift, readGift } from "./commands.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import type { SellerDatabase } from "../../server/db/database";
import type { GiftWorkspaceRow, GiftObservationRow } from "./storage.server";
import { parseGiftBrief, type GiftBrief } from "./model";
const db = {} as SellerDatabase,
  alice = { subject: "user_alice" },
  bob = { subject: "user_bob" },
  userId = "10000000-0000-4000-8000-000000000001",
  listingId = "10000000-0000-4000-8000-000000000002",
  requestId = "10000000-0000-4000-8000-000000000003";
const brief: GiftBrief = parseGiftBrief({
  version: 1,
  occasion: "birthday",
  age: "adult",
  neededBy: null,
  criteria: "category=cat%3Aelectronics%2Fcameras-lenses&q=Sony&lang=bg",
});
const command = {
  actorKey: "a".repeat(64),
  expectedRevision: 0,
  requestId,
  operation: { kind: "find", brief, confirmed: true },
};
let workspace: GiftWorkspaceRow,
  observations: GiftObservationRow[],
  ready: boolean,
  prior: { hash: string; revision: number; count: number } | null;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.transactions = 0;
  ready = true;
  prior = null;
  observations = [];
  workspace = { revision: 0, brief: null, selectedIds: [], nextCursor: null };
  mocks.human.mockResolvedValue({ id: userId, status: "active" });
  mocks.budget.mockResolvedValue(undefined);
  mocks.catalogue.mockResolvedValue({ items: [], nextCursor: null });
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes("to_regclass")) return { rows: [{ ready }] };
    if (
      sql.startsWith("SELECT input_hash") &&
      sql.includes("buyer_gift_receipts")
    )
      return { rows: prior ? [prior] : [] };
    if (sql.startsWith("SELECT revision,brief")) return { rows: [workspace] };
    if (sql.startsWith("SELECT position,snapshot"))
      return { rows: observations };
    return { rows: [] };
  });
});
it("a read never creates a human/workspace or executes a command", async () => {
  await readGift(db, alice);
  expect(mocks.human).toHaveBeenCalledWith(expect.anything(), alice, false);
  expect(
    mocks.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql)),
  ).toBe(false);
  expect(mocks.budget).not.toHaveBeenCalled();
});
it("unknown human gets a true empty read with no provisioning", async () => {
  mocks.human.mockRejectedValue(new SellerError("NOT_FOUND"));
  const view = await readGift(db, alice);
  expect(view).toMatchObject({ revision: 0, brief: null, items: [] });
  expect(mocks.query).toHaveBeenCalledTimes(1);
});
it("missing Gift storage rejects before registration/private access", async () => {
  ready = false;
  await expect(changeGift(db, alice, command)).rejects.toThrow("NOT_AVAILABLE");
  expect(mocks.human).not.toHaveBeenCalled();
  expect(mocks.query).toHaveBeenCalledTimes(1);
});
it("switched current account cannot reuse another actor's frozen request", async () => {
  await expect(changeGift(db, bob, command)).rejects.toThrow("UNAUTHENTICATED");
  expect(mocks.transactions).toBe(0);
  expect(mocks.query).not.toHaveBeenCalled();
});
it("revoked current human cannot read a private receipt or replay it", async () => {
  mocks.human.mockRejectedValue(new SellerError("FORBIDDEN"));
  await expect(changeGift(db, alice, command)).rejects.toThrow("FORBIDDEN");
  expect(
    mocks.query.mock.calls.some(([sql]) => sql.startsWith("SELECT input_hash")),
  ).toBe(false);
  expect(
    mocks.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql)),
  ).toBe(false);
});
it("find records a durable zero-result brief with scoped hash acknowledgement", async () => {
  expect(await changeGift(db, alice, command)).toEqual({
    revision: 1,
    count: 0,
    replayed: false,
  });
  expect(mocks.human).toHaveBeenCalledWith(expect.anything(), alice, true);
  expect(mocks.budget).toHaveBeenCalledWith(expect.anything(), userId, true);
  const receipt = mocks.query.mock.calls.find(([sql]) =>
    sql.startsWith("INSERT INTO treido.buyer_gift_receipts"),
  );
  expect(receipt?.[1]).toEqual([
    userId,
    requestId,
    expect.stringMatching(/^[a-f0-9]{64}$/),
    1,
    "find",
    0,
  ]);
  expect(
    mocks.query.mock.calls.some(([sql]) => sql.includes("FOR UPDATE")),
  ).toBe(true);
});
it("original receipt replays before stale revision/expired cursor without another search", async () => {
  await changeGift(db, alice, command);
  const values = mocks.query.mock.calls.find(([sql]) =>
    sql.startsWith("INSERT INTO treido.buyer_gift_receipts"),
  )?.[1];
  prior = { hash: values[2], revision: 1, count: 0 };
  workspace.revision = 5;
  mocks.catalogue.mockClear();
  mocks.budget.mockClear();
  mocks.query.mockClear();
  expect(await changeGift(db, alice, command)).toEqual({
    revision: 1,
    count: 0,
    replayed: true,
  });
  expect(mocks.catalogue).not.toHaveBeenCalled();
  expect(mocks.budget).not.toHaveBeenCalled();
  expect(
    mocks.query.mock.calls.some(
      ([sql]) => sql.startsWith("UPDATE") || sql.startsWith("DELETE"),
    ),
  ).toBe(false);
});
it("same key/different review never becomes a new search", async () => {
  prior = { hash: "e".repeat(64), revision: 1, count: 0 };
  await expect(changeGift(db, alice, command)).rejects.toThrow("CONFLICT");
  expect(mocks.catalogue).not.toHaveBeenCalled();
});
it("stale revision has no budget or catalogue effect", async () => {
  workspace.revision = 1;
  await expect(changeGift(db, alice, command)).rejects.toThrow("CONFLICT");
  expect(mocks.budget).not.toHaveBeenCalled();
  expect(mocks.catalogue).not.toHaveBeenCalled();
});
it("foreign/unobserved shortlist IDs conflict before results or mutation", async () => {
  workspace.brief = brief;
  await expect(
    changeGift(db, alice, {
      ...command,
      operation: { kind: "choose", listingIds: [listingId] },
    }),
  ).rejects.toThrow("CONFLICT");
  expect(mocks.catalogue).not.toHaveBeenCalled();
  expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(
    false,
  );
});
it("refresh preserves the last observation when facts differ from the frozen review", async () => {
  workspace.brief = brief;
  const observation = {
    listingId,
    publicationRevision: 2,
    skuId: null,
    priceMinor: 1000,
    stock: "unknown" as const,
  };
  observations = [
    {
      position: 1,
      observedAt: new Date(),
      snapshot: {
        observation,
        title: "Declared item",
        categoryId: "cat:electronics/cameras-lenses",
        condition: "good",
        locality: "София",
        attributes: {},
        handover: ["shipping"],
        defects: null,
      },
    },
  ];
  await expect(
    changeGift(db, alice, {
      ...command,
      operation: {
        kind: "refresh",
        briefHash: inputHash(brief),
        listingIds: [listingId],
        expected: [{ listingId, observation }],
      },
    }),
  ).rejects.toThrow("CONFLICT");
  expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("DELETE"))).toBe(
    false,
  );
});
it("clear checks the exact frozen IDs and purges only feature workspace facts", async () => {
  workspace.brief = brief;
  await expect(
    changeGift(db, alice, {
      ...command,
      operation: {
        kind: "clear",
        briefHash: inputHash(brief),
        listingIds: [listingId],
      },
    }),
  ).rejects.toThrow("CONFLICT");
  expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("DELETE"))).toBe(
    false,
  );
  expect(
    await changeGift(db, alice, {
      ...command,
      operation: { kind: "clear", briefHash: inputHash(brief), listingIds: [] },
    }),
  ).toEqual({ revision: 1, count: 0, replayed: false });
  expect(mocks.budget).toHaveBeenLastCalledWith(
    expect.anything(),
    userId,
    false,
  );
  const deletion = mocks.query.mock.calls.find(([sql]) =>
    sql.startsWith("DELETE"),
  );
  expect(deletion?.[1]).toEqual([userId]);
  expect(deletion?.[0]).toBe(
    "DELETE FROM treido.buyer_gift_observations WHERE user_id=$1",
  );
});
it("unknown transaction outcome rejects with no invented acknowledgement", async () => {
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith("INSERT INTO treido.buyer_gift_receipts"))
      throw new Error("lost transport");
    if (sql.includes("to_regclass")) return { rows: [{ ready: true }] };
    if (sql.startsWith("SELECT revision,brief")) return { rows: [workspace] };
    return { rows: [] };
  });
  await expect(changeGift(db, alice, command)).rejects.toThrow(
    "lost transport",
  );
});
