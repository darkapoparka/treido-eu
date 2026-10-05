import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("server-only", () => ({}));
const fake = vi.hoisted(() => ({
  human: vi.fn(),
  recent: vi.fn(),
  facts: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: (database: { tx: unknown }, work: (tx: unknown) => unknown) =>
    work(database.tx),
}));
vi.mock("../../server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: fake.recent,
}));
vi.mock("../catalog/public-discovery.server", () => ({
  publicDiscoveryKey: () => Buffer.alloc(32, 8),
}));
vi.mock("../sellers/persistence.server", () => ({
  authorizeHuman: fake.human,
  inputHash: (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex"),
}));
vi.mock("./projections.server", () => ({
  readClosureFacts: fake.facts,
  projectExport: vi.fn(),
}));
import { changePrivacy } from "./commands.server";
import { privacyActorKey } from "./storage.server";
import { readPrivacy, readPrivateDownload } from "./queries.server";
import type { SellerDatabase } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
const identity = { subject: "user_privacy_unit" },
  id = "00000000-0000-4000-8000-000000000001";
const acknowledgment = {
  revision: 2,
  kind: "review",
  resourceId: id,
  acceptedState: "review",
  expiresAt: "2026-10-04T10:15:00Z",
};
const command = {
  version: 1,
  actorKey: privacyActorKey(identity),
  requestId: id,
  expectedRevision: 1,
  operation: { kind: "review" },
};
function transport(rows: (sql: string) => unknown[]) {
  const query = vi.fn(async (sql: string) => ({ rows: rows(sql) }));
  return {
    query,
    database: { tx: { client: { query } } } as unknown as SellerDatabase,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  fake.recent.mockReturnValue(true);
  fake.human.mockResolvedValue({ id, status: "active" });
});
describe("privacy authority and immutable recovery through mocked transaction transport (not database proof)", () => {
  it("rejects synthetic/stale recent authentication before any database operation", async () => {
    fake.recent.mockReturnValue(false);
    const { database, query } = transport(() => []);
    await expect(
      (async () => changePrivacy(database, identity, command))(),
    ).rejects.toMatchObject({ code: "RECENT_AUTH_REQUIRED" });
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects a switched actor's frozen command before persistence", async () => {
    const { database, query } = transport(() => []);
    await expect(
      (async () =>
        changePrivacy(database, { subject: "user_other" }, command))(),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(query).not.toHaveBeenCalled();
  });
  it("rechecks current human access before returning an existing private receipt", async () => {
    fake.human.mockRejectedValue(new SellerError("FORBIDDEN"));
    const { database, query } = transport((sql) =>
      sql.includes("to_regclass") ? [{ ready: true }] : [],
    );
    await expect(
      changePrivacy(database, identity, command),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("SELECT input_hash AS hash,acknowledgment FROM"),
      ),
    ).toBe(false);
    expect(
      query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)\b/.test(sql)),
    ).toBe(false);
  });
  it("returns the original acknowledgment despite a later workspace revision and expired review", async () => {
    const hash = createHash("sha256")
      .update(JSON.stringify(command))
      .digest("hex");
    const { database, query } = transport((sql) =>
      sql.includes("to_regclass")
        ? [{ ready: true }]
        : sql.includes("FOR UPDATE")
          ? [{ revision: 99 }]
          : sql.includes("SELECT input_hash")
            ? [{ hash, acknowledgment }]
            : [],
    );
    await expect(changePrivacy(database, identity, command)).resolves.toEqual({
      acknowledgment,
      replayed: true,
    });
    expect(query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(
      false,
    );
    expect(fake.facts).not.toHaveBeenCalled();
  });
  it("same request with different frozen input conflicts rather than replacing the receipt", async () => {
    const { database } = transport((sql) =>
      sql.includes("to_regclass")
        ? [{ ready: true }]
        : sql.includes("FOR UPDATE")
          ? [{ revision: 1 }]
          : sql.includes("SELECT input_hash")
            ? [{ hash: "changed", acknowledgment }]
            : [],
    );
    await expect(
      changePrivacy(database, identity, command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("missing privacy storage is unavailable without a sample success", async () => {
    const { database } = transport((sql) =>
      sql.includes("to_regclass") ? [{ ready: false }] : [],
    );
    await expect(
      changePrivacy(database, identity, command),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(fake.human).not.toHaveBeenCalled();
  });
  it("first-use read shows registration needed and unknown facts without creating a human", async () => {
    fake.human.mockRejectedValue(new SellerError("NOT_FOUND"));
    const { database } = transport((sql) =>
      sql.includes("to_regclass")
        ? [{ ready: true }]
        : sql.includes("clock_timestamp() AS now")
          ? [{ now: new Date("2026-10-04T10:00:00Z") }]
          : [],
    );
    const view = await readPrivacy(database, identity);
    expect(view).toMatchObject({
      revision: 0,
      registrationNeeded: true,
      facts: null,
      exports: [],
      closures: [],
    });
    expect(fake.human.mock.calls[0][2]).toBe(false);
  });
  it("an explicit first-use review uses normal verified human registration without creating a seller", async () => {
    const facts = {
      personalListings: 0,
      businessMemberships: 0,
      soleBusinessOwnerships: 0,
      allocations: 0,
      offers: 0,
      paymentAttempts: 0,
      orders: 0,
      refunds: 0,
      openReports: 0,
    };
    fake.facts.mockResolvedValue(facts);
    const { database, query } = transport((sql) =>
      sql.includes("to_regclass")
        ? [{ ready: true }]
        : sql.includes("FOR UPDATE")
          ? [{ revision: 0 }]
          : sql.includes("count(*)")
            ? [{ count: 0 }]
            : sql.includes("clock_timestamp() AS now")
              ? [
                  {
                    now: new Date("2026-10-04T10:00:00Z"),
                    expiry: new Date("2026-10-04T10:15:00Z"),
                  },
                ]
              : [],
    );
    const result = await changePrivacy(database, identity, {
      ...command,
      expectedRevision: 0,
    });
    expect(result.acknowledgment.acceptedState).toBe("review");
    expect(fake.human.mock.calls[0][2]).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        /INSERT INTO treido\.(seller|users|outbox)/.test(sql),
      ),
    ).toBe(false);
  });
  it("changed current obligations invalidate a frozen review before submission", async () => {
    fake.facts.mockResolvedValue({ orders: 1 });
    const { database, query } = transport((sql) =>
      sql.includes("to_regclass")
        ? [{ ready: true }]
        : sql.includes("FOR UPDATE")
          ? [{ revision: 1 }]
          : sql.includes("count(*)")
            ? [{ count: 0 }]
            : sql.includes("clock_timestamp() AS now")
              ? [{ now: new Date(), expiry: new Date() }]
              : sql.includes("SELECT facts,facts_hash")
                ? [
                    {
                      facts: { orders: 0 },
                      hash: "outdated",
                      valid: true,
                      latest: true,
                    },
                  ]
                : [],
    );
    await expect(
      changePrivacy(database, identity, {
        ...command,
        operation: { kind: "submit", reviewId: id, acknowledged: true },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("INSERT INTO treido.account_closure_requests"),
      ),
    ).toBe(false);
  });
  it("a previously used withdrawn review returns definite conflict without inserting another closure", async () => {
    const facts = { orders: 0 };
    fake.facts.mockResolvedValue(facts);
    const hash = createHash("sha256")
      .update(JSON.stringify(facts))
      .digest("hex");
    const { database, query } = transport((sql) =>
      sql.includes("to_regclass")
        ? [{ ready: true }]
        : sql.includes("FOR UPDATE")
          ? [{ revision: 1 }]
          : sql.includes("count(*)")
            ? [{ count: 0 }]
            : sql.includes("clock_timestamp() AS now")
              ? [{ now: new Date(), expiry: new Date() }]
              : sql.includes("SELECT facts,facts_hash")
                ? [{ facts, hash, valid: true, latest: true }]
                : sql.startsWith(
                      "SELECT id FROM treido.account_closure_requests",
                    )
                  ? [{ id, state: "withdrawn" }]
                  : [],
    );
    await expect(
      changePrivacy(database, identity, {
        ...command,
        operation: { kind: "submit", reviewId: id, acknowledged: true },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      query.mock.calls.some(
        ([sql]) =>
          sql.startsWith("SELECT id FROM treido.account_closure_requests") &&
          sql.includes("review_id=$2"),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("INSERT INTO treido.account_closure_requests"),
      ),
    ).toBe(false);
  });
  it("expired downloads fail before returning their private body", async () => {
    const { database } = transport((sql) =>
      sql.includes("to_regclass")
        ? [{ ready: true }]
        : sql.includes("snapshot::text AS body")
          ? [{ valid: false, body: "private" }]
          : [],
    );
    await expect(
      readPrivateDownload(database, identity, id, privacyActorKey(identity)),
    ).rejects.toMatchObject({ code: "EXPIRED" });
  });
});
