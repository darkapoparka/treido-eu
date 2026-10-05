import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  human: vi.fn(),
  seller: vi.fn(),
  save: vi.fn(),
  storage: vi.fn(),
  budget: vi.fn(),
  inTransaction: false,
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (
    _database: unknown,
    work: (tx: unknown) => Promise<unknown>,
  ) => {
    mocks.inTransaction = true;
    try {
      return await work({ client: { query: mocks.query }, db: {} });
    } finally {
      mocks.inTransaction = false;
    }
  },
}));
vi.mock("../sellers/persistence.server", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    authorizeHuman: mocks.human,
    authorizeSeller: mocks.seller,
  };
});
vi.mock("../selling/drafts.server", () => ({ saveListingDraft: mocks.save }));
vi.mock("./storage.server", async () => {
  const { SellerError } = await import("../sellers/errors");
  return {
    requireAssistantStorage: mocks.storage,
    checkAssistantBudget: mocks.budget,
    assistantActorKey: () => "a".repeat(64),
    requireAssistantActor: (identity: { subject: string }, key: string) => {
      if (identity.subject !== "user_alice" || key !== "a".repeat(64))
        throw new SellerError("UNAUTHENTICATED");
    },
  };
});
import { changeSellHelper } from "./sell-helper.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import type { SellerDatabase } from "../../server/db/database";
import type { DraftPayload } from "../selling/draft-model";
import {
  editableDraft,
  type HelperCommand,
  type HelperChange,
} from "./sell-helper-model";
import type { HelperIntentRow } from "./helper-storage.server";
const sellerId = "10000000-0000-4000-8000-000000000001",
  draftId = "10000000-0000-4000-8000-000000000002",
  proposalId = "10000000-0000-4000-8000-000000000003",
  requestId = "10000000-0000-4000-8000-000000000004",
  userId = "10000000-0000-4000-8000-000000000005";
const actor = { subject: "user_alice" },
  database = {} as SellerDatabase;
const original: DraftPayload = {
  schemaVersion: 1,
  title: "Seller title",
  description: "Seller facts",
  categoryId: "cat:electronics/cameras-lenses",
  condition: "good",
  fields: { brand: "Sony", model: "A7", workingStatus: "working" },
  priceMinor: 17000,
  currency: "EUR",
  locality: "София",
};
const candidate = { ...original, title: "Reviewed seller title" };
const command: HelperCommand = {
  actorKey: "a".repeat(64),
  sellerId,
  expectedRevision: 0,
  requestId,
  operation: {
    kind: "accept",
    proposalId,
    proposalHash: inputHash({
      draftId,
      draftRevision: 5,
      baseHash: inputHash(original),
      payload: candidate,
    }),
    expectedDraftRevision: 5,
    confirm: true,
  },
};
let state: {
  revision: number;
  draftRevision: number;
  payload: DraftPayload;
  intent: HelperIntentRow | null;
  receipt: { hash: string; result: HelperChange } | null;
  saved: { hash: string; revision: number } | null;
  proposalDeleted: boolean;
};
beforeEach(() => {
  vi.resetAllMocks();
  state = {
    revision: 0,
    draftRevision: 5,
    payload: structuredClone(original),
    intent: null,
    receipt: null,
    saved: null,
    proposalDeleted: false,
  };
  mocks.storage.mockResolvedValue(undefined);
  mocks.budget.mockResolvedValue(undefined);
  mocks.human.mockResolvedValue({ id: userId });
  mocks.seller.mockResolvedValue({
    user: { id: userId },
    seller: { kind: "personal" },
  });
  mocks.query.mockImplementation(
    async (text: string, values: unknown[] = []) => {
      if (text.startsWith("INSERT INTO treido.seller_helper_workspaces"))
        return { rows: [] };
      if (text.includes("SELECT revision FROM treido.seller_helper_workspaces"))
        return { rows: [{ revision: state.revision }] };
      if (text.startsWith("UPDATE treido.seller_helper_workspaces")) {
        state.revision = Number(values[2]);
        return { rows: [] };
      }
      if (
        text.trimStart().startsWith("SELECT") &&
        text.includes("FROM treido.seller_helper_receipts")
      )
        return { rows: state.receipt ? [state.receipt] : [] };
      if (text.startsWith("INSERT INTO treido.seller_helper_receipts")) {
        state.receipt = {
          hash: String(values[3]),
          result: structuredClone(values[6]) as HelperChange,
        };
        return { rows: [] };
      }
      if (
        text.trimStart().startsWith("SELECT") &&
        text.includes("FROM treido.seller_helper_acceptance_intents")
      )
        return { rows: state.intent ? [state.intent] : [] };
      if (
        text.startsWith("INSERT INTO treido.seller_helper_acceptance_intents")
      ) {
        state.intent = {
          requestId: String(values[2]),
          hash: String(values[3]),
          revision: Number(values[4]),
          proposalId: String(values[5]),
          draftId: String(values[6]),
          draftRevision: Number(values[7]),
          payload: structuredClone(values[8]) as DraftPayload,
          command: structuredClone(values[9]) as HelperCommand,
        };
        return { rows: [] };
      }
      if (
        text.startsWith("DELETE FROM treido.seller_helper_acceptance_intents")
      ) {
        state.intent = null;
        return { rows: [] };
      }
      if (
        text.trimStart().startsWith("SELECT") &&
        text.includes("FROM treido.seller_helper_proposals")
      )
        return {
          rows: [
            {
              id: proposalId,
              draftId,
              draftRevision: 5,
              baseHash: inputHash(original),
              proposalHash:
                command.operation.kind === "accept"
                  ? command.operation.proposalHash
                  : "",
              original: editableDraft(original),
              payload: candidate,
              createdAt: new Date("2026-10-04T10:00:00Z"),
            },
          ],
        };
      if (text.startsWith("DELETE FROM treido.seller_helper_proposals")) {
        state.proposalDeleted = true;
        return { rows: [] };
      }
      if (text.includes("FROM treido.listings l JOIN treido.listing_drafts"))
        return {
          rows: [
            {
              revision: state.draftRevision,
              payload: state.payload,
              publication: "draft",
            },
          ],
        };
      if (text.includes("FROM treido.draft_save_receipts"))
        return { rows: state.saved ? [state.saved] : [] };
      throw new Error("Unexpected owned test query");
    },
  );
  mocks.save.mockImplementation(
    async (
      _db: unknown,
      _actor: unknown,
      input: { expectedRevision: number; payload: DraftPayload },
    ) => {
      expect(mocks.inTransaction).toBe(false);
      expect(state.intent).not.toBeNull();
      state.saved = {
        hash: inputHash({
          expectedRevision: input.expectedRevision,
          payload: input.payload,
        }),
        revision: 6,
      };
      state.draftRevision = 6;
      state.payload = structuredClone(input.payload);
      return {
        id: draftId,
        sellerId,
        revision: 6,
        updatedAt: "2026-10-04T10:00:00Z",
      };
    },
  );
});
describe("helper adapter recovery with mocked transport (not database/Clerk acceptance)", () => {
  it("calls the ordinary draft command only after durable explicit acceptance", async () => {
    const result = await changeSellHelper(database, actor, command);
    expect(result.outcome).toBe("applied");
    expect(result.draftRevision).toBe(6);
    expect(mocks.save).toHaveBeenCalledWith(database, actor, {
      sellerId,
      draftId,
      expectedRevision: 5,
      requestId,
      payload: candidate,
    });
    expect(state.intent).toBeNull();
    expect(state.proposalDeleted).toBe(true);
    const statements = mocks.query.mock.calls.map(([text]) => String(text));
    expect(
      statements.findIndex((text) =>
        text.startsWith("INSERT INTO treido.seller_helper_receipts"),
      ),
    ).toBeLessThan(
      statements.findIndex((text) =>
        text.startsWith("DELETE FROM treido.seller_helper_acceptance_intents"),
      ),
    );
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "DELETE FROM treido.seller_helper_acceptance_intents",
      ),
      [userId, sellerId, requestId],
    );
  });
  it("preserves a frozen original intent after unknown save outcome", async () => {
    mocks.save.mockRejectedValueOnce(new SellerError("NOT_AVAILABLE"));
    await expect(
      changeSellHelper(database, actor, command),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(state.intent?.payload).toEqual(candidate);
    expect(state.intent?.command).toEqual(command);
    expect(state.receipt).toBeNull();
    expect(state.proposalDeleted).toBe(false);
    const result = await changeSellHelper(database, actor, command);
    expect(result.outcome).toBe("applied");
    expect(mocks.save.mock.calls[1][2]).toMatchObject({
      expectedRevision: 5,
      requestId,
      payload: candidate,
    });
  });
  it("recovers the proven original save after another editor advanced the draft", async () => {
    mocks.save.mockImplementationOnce(
      async (
        _db: unknown,
        _actor: unknown,
        input: { expectedRevision: number; payload: DraftPayload },
      ) => {
        state.saved = {
          hash: inputHash({
            expectedRevision: input.expectedRevision,
            payload: input.payload,
          }),
          revision: 6,
        };
        throw new SellerError("NOT_AVAILABLE");
      },
    );
    await expect(
      changeSellHelper(database, actor, command),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    state.draftRevision = 7;
    state.payload = { ...original, title: "Later independent edit" };
    const result = await changeSellHelper(database, actor, command);
    expect(result.outcome).toBe("applied");
    expect(result.draftRevision).toBe(6);
    expect(state.payload.title).toBe("Later independent edit");
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("terminal draft conflict becomes a definite immutable outcome without inventing success", async () => {
    mocks.save.mockRejectedValueOnce(new SellerError("CONFLICT"));
    const result = await changeSellHelper(database, actor, command);
    expect(result.outcome).toBe("conflict");
    expect(result.draftRevision).toBeNull();
    expect(state.intent).toBeNull();
    expect(state.proposalDeleted).toBe(false);
  });
  it("replay acknowledges its past result without applying the draft again", async () => {
    await changeSellHelper(database, actor, command);
    state.draftRevision = 9;
    const result = await changeSellHelper(database, actor, command);
    expect(result.replayed).toBe(true);
    expect(result.draftRevision).toBe(6);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("changed input under the frozen key conflicts without another save", async () => {
    mocks.save.mockRejectedValueOnce(new SellerError("NOT_AVAILABLE"));
    await expect(
      changeSellHelper(database, actor, command),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    await expect(
      changeSellHelper(database, actor, { ...command, expectedRevision: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("missing storage fails before human registration or private SQL mutation", async () => {
    mocks.storage.mockRejectedValueOnce(new SellerError("NOT_AVAILABLE"));
    await expect(
      changeSellHelper(database, actor, command),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(mocks.human).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("changed account rejects a frozen request before the transaction", async () => {
    await expect(
      changeSellHelper(database, { subject: "user_bob" }, command),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("revoked seller access is rechecked before returning a prior receipt", async () => {
    await changeSellHelper(database, actor, command);
    mocks.seller.mockRejectedValueOnce(new SellerError("FORBIDDEN"));
    mocks.query.mockClear();
    await expect(
      changeSellHelper(database, actor, command),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});
