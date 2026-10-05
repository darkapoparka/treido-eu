import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("server-only", () => ({}));
const f = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("../../server/db/database", () => ({
  inTransaction: (database: { tx: unknown }, work: (tx: unknown) => unknown) =>
    work(database.tx),
}));
vi.mock("../sellers/persistence.server", () => ({
  authorizeHuman: f.authorize,
  inputHash: (raw: unknown) =>
    createHash("sha256").update(JSON.stringify(raw)).digest("hex"),
}));
vi.mock("../../server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: "test",
    identity: { applicationId: "clerk-isolated" },
  }),
}));
vi.mock("../catalog/public-discovery.server", () => ({
  publicDiscoveryKey: () => Buffer.alloc(32, 8),
}));
import {
  readPromotionMeasurementChoice,
  changePromotionMeasurementChoice,
  measurementActorKey,
} from "./measurement-policy.server";
import { parseMeasurementChoice } from "./model";
import { SellerError } from "../sellers/errors";
import type { SellerDatabase } from "../../server/db/database";
const id = "00000000-0000-4000-8000-000000000001",
  identity = { subject: "user_isolated" },
  actorKey = measurementActorKey(identity);
const policy = {
  id,
  retentionDays: 30,
  consentRule: "explicit_promotion_measurement_opt_in",
  text: { bg: "Изолиран тест", en: "Isolated test" },
};
const command = {
  actorKey,
  policyId: id,
  requestId: id,
  expectedRevision: 0,
  allowed: true,
};
function transport(
  options: {
    policy?: typeof policy | null;
    prior?: unknown;
    latest?: unknown;
    read?: unknown;
  } = {},
) {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.includes("FROM treido.promotion_measurement_policies")
      ? options.policy === null
        ? []
        : [options.policy ?? policy]
      : sql.includes("WHERE user_id=$1 AND request_id=$2")
        ? options.prior
          ? [options.prior]
          : []
        : sql.includes("SELECT allowed,revision")
          ? options.read
            ? [options.read]
            : []
          : sql.includes("SELECT revision")
            ? options.latest
              ? [options.latest]
              : []
            : [],
    rowCount: 1,
  }));
  return {
    query,
    database: { tx: { client: { query } } } as unknown as SellerDatabase,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  f.authorize.mockResolvedValue({ id });
});
describe("separate own measurement choice via isolated transport, not genuine Clerk/native acceptance", () => {
  it.each([
    { ...command, allowed: "true" },
    { ...command, policyId: id + "\n" },
    { ...command, expectedRevision: -1 },
    { ...command, paid: true },
    { ...command, actorKey: "a".repeat(64) + "\n" },
  ])("rejects malformed/extra choice %#", (raw) =>
    expect(() => parseMeasurementChoice(raw)).toThrow(),
  );
  it("read of an unregistered actual identity never provisions or implies consent", async () => {
    f.authorize.mockRejectedValue(new SellerError("NOT_FOUND"));
    const t = transport();
    expect(
      await readPromotionMeasurementChoice(t.database, identity),
    ).toMatchObject({ registered: false, allowed: false, revision: 0 });
    expect(f.authorize).toHaveBeenCalledWith(
      expect.anything(),
      identity,
      false,
    );
    expect(t.query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))).toBe(
      true,
    );
  });
  it("a database error is not an empty successful choice", async () => {
    f.authorize.mockRejectedValue(new Error("database down"));
    const t = transport();
    await expect(
      readPromotionMeasurementChoice(t.database, identity),
    ).rejects.toThrow("database down");
  });
  it("actual current restriction blocks a read", async () => {
    f.authorize.mockRejectedValue(new SellerError("FORBIDDEN"));
    const t = transport();
    await expect(
      readPromotionMeasurementChoice(t.database, identity),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("missing reviewed policy blocks even explicit choice before first registration", async () => {
    const t = transport({ policy: null });
    await expect(
      changePromotionMeasurementChoice(t.database, identity, command),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(f.authorize).not.toHaveBeenCalled();
    expect(t.query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))).toBe(
      true,
    );
  });
  it("actor switch is rejected before any SQL", async () => {
    const t = transport();
    await expect(
      changePromotionMeasurementChoice(
        t.database,
        { subject: "foreign" },
        command,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(t.query).not.toHaveBeenCalled();
  });
  it("explicit withdrawal appends current revision and never deletes an earlier choice", async () => {
    const t = transport({ latest: { revision: 4 } });
    expect(
      await changePromotionMeasurementChoice(t.database, identity, {
        ...command,
        expectedRevision: 4,
        allowed: false,
      }),
    ).toEqual({ allowed: false, revision: 5 });
    expect(f.authorize).toHaveBeenCalledWith(expect.anything(), identity, true);
    const inserted = t.query.mock.calls.find(([sql]) =>
      sql.startsWith("INSERT"),
    ) as unknown as [string, unknown[]];
    expect(inserted[1].slice(0, 5)).toEqual([id, id, id, false, 5]);
    expect(
      t.query.mock.calls.some(([sql]) => /^(UPDATE|DELETE)/.test(sql)),
    ).toBe(false);
  });
  it("old exact enabled receipt is acknowledged without restoring later withdrawn choice", async () => {
    const hash = createHash("sha256")
        .update(JSON.stringify(command))
        .digest("hex"),
      t = transport({
        prior: { hash, allowed: true, revision: 1 },
        latest: { revision: 2 },
      });
    expect(
      await changePromotionMeasurementChoice(t.database, identity, command),
    ).toEqual({ allowed: true, revision: 1 });
    expect(
      t.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql)),
    ).toBe(false);
  });
  it("request reuse with changed allowed flag conflicts without a write", async () => {
    const t = transport({
      prior: { hash: "b".repeat(64), allowed: true, revision: 1 },
    });
    await expect(
      changePromotionMeasurementChoice(t.database, identity, command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(t.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("stale current choice revision never overwrites a newer withdrawal", async () => {
    const t = transport({ latest: { revision: 2 } });
    await expect(
      changePromotionMeasurementChoice(t.database, identity, command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(t.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("reviewed policy query pins separate current application/environment/event/consent definition", async () => {
    const t = transport();
    await readPromotionMeasurementChoice(t.database, identity);
    const [sql, args] = t.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(args).toEqual(["test", "clerk-isolated"]);
    for (const fragment of [
      "explicit_promotion_measurement_opt_in",
      "continuousMilliseconds",
      "revoked_at IS NULL",
      "max(latest.version)",
      "FOR SHARE",
    ])
      expect(sql).toContain(fragment);
  });
});
