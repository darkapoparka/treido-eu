import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  query: vi.fn(),
  human: vi.fn(),
  stripe: vi.fn(),
  allocation: vi.fn(),
  policy: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: (_database: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: state.query } }),
}));
vi.mock("../sellers/persistence.server", async (load) => ({
  ...(await load<typeof import("../sellers/persistence.server")>()),
  authorizeHuman: (...args: unknown[]) => state.human(...args),
}));
vi.mock("./bindings.server", () => ({
  requireCollection: () => ({
    applicationId: "terminal-refund-synthetic",
    platformAccount: "acct_Synthetic",
    livemode: false,
    environment: "test",
  }),
  verifiedStripe: () => ({ accounts: { retrieve: state.stripe } }),
}));
vi.mock("./registry.server", () => ({
  accountReadiness: () => ({ ready: true }),
  approvedPolicy: (...args: unknown[]) => state.policy(...args),
  approvedListing: vi.fn(),
  sellerBinding: (_tx: unknown, sellerId: string) => ({
    id: "binding-synthetic",
    sellerId,
    connectedAccount: "acct_ConnectedSynthetic",
  }),
}));
vi.mock("../inventory/allocations.server", () => ({
  allocateInventory: (...args: unknown[]) => state.allocation(...args),
  lockInventoryListings: vi.fn(),
}));
vi.mock("../purchase-reviews/persistence.server", () => ({
  snapshotLine: (_tx: unknown, _seller: string, line: object) => ({
    ...line,
    title: "Original new TEST purchase",
    options: {},
    deliveryDetails: "TEST pickup",
    current: true,
    available: 1,
  }),
}));
vi.mock("../order-aftercare/policy.server", () => ({
  freezeNewQuoteAftercare: () => null,
  persistNewQuoteAftercare: vi.fn(),
}));
import { createPayableQuote } from "./quotes.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import { terminalFullRefundSql } from "./terminal-refund.server";

beforeEach(() => {
  for (const mock of Object.values(state)) mock.mockReset();
  vi.stubEnv("TREIDO_DISCOVERY_CURSOR_KEY", "a".repeat(64));
});
afterEach(() => vi.unstubAllEnvs());

function fixture({ unresolved = false, cartRevision = 7 } = {}) {
  const identity: VerifiedIdentity = { subject: "synthetic-current-buyer" };
  const buyerId = randomUUID(),
    sellerId = randomUUID(),
    policyId = randomUUID();
  const command = {
    actorKey: libraryActorKey(identity),
    requestId: randomUUID(),
    source: { kind: "cart", sellerId, cartRevision: 7 },
    policyId,
    handover: "pickup",
    language: "en",
  };
  const writes: string[] = [];
  state.human.mockResolvedValue({ id: buyerId });
  state.stripe.mockResolvedValue({ id: "acct_ConnectedSynthetic" });
  state.policy.mockResolvedValue({
    id: policyId,
    feeBps: 0,
    feeFixedMinor: 0,
    settlementMerchant: "platform",
    approvalReference: "SYNTHETIC TEST ONLY",
    buyerTerms: { en: "TEST full refund terms" },
  });
  state.allocation.mockResolvedValue({
    id: randomUUID(),
    expiresAt: new Date("2026-10-10T09:00:00.000Z"),
  });
  state.query.mockImplementation(
    async (sql: string, values: unknown[] = []) => {
      const result = (rows: unknown[]) => ({ rows, rowCount: rows.length });
      if (
        sql.startsWith("SELECT id,input_hash") ||
        sql.startsWith("SELECT id,policy_id")
      )
        return result([]);
      if (sql.includes("pg_advisory_xact_lock")) return result([]);
      if (sql.startsWith("SELECT a.id FROM treido.payment_attempts")) {
        expect(values).toEqual([buyerId, sellerId]);
        expect(sql).toContain(terminalFullRefundSql);
        return result(unresolved ? [{ id: randomUUID() }] : []);
      }
      if (sql.startsWith("SELECT count(*)::int AS n"))
        return result([{ n: 1 }]);
      if (sql.startsWith("SELECT revision FROM treido.buyer_carts"))
        return result([{ revision: cartRevision }]);
      if (sql.includes("FROM treido.buyer_cart_lines"))
        return result([
          {
            listingId: randomUUID(),
            skuId: randomUUID(),
            publicationRevision: 3,
            quantity: 1,
            unitPriceMinor: 1000,
          },
        ]);
      if (sql.startsWith("SELECT name FROM treido.seller_accounts"))
        return result([{ name: "Original TEST seller" }]);
      if (sql.startsWith("SELECT user_id FROM treido.personal_seller_owners"))
        return result([]);
      if (sql.includes("expires_at::text"))
        return result([{ expiresAtExact: "2026-10-10 09:00:00+00" }]);
      if (sql.startsWith("INSERT")) {
        writes.push(sql);
        return result([]);
      }
      throw Error("Unexpected synthetic payable quote query");
    },
  );
  return {
    identity,
    buyerId,
    sellerId,
    command,
    writes,
    database: {} as SellerDatabase,
  };
}

describe("new quote recovery after authoritative terminal full refund", () => {
  it("creates a new allocated quote after the native proof gate clears", async () => {
    const f = fixture();
    expect(await createPayableQuote(f.database, f.identity, f.command)).toEqual(
      { id: expect.any(String) },
    );
    expect(state.human).toHaveBeenCalledTimes(2);
    expect(state.stripe).toHaveBeenCalledTimes(1);
    expect(state.allocation).toHaveBeenCalledTimes(1);
    expect(f.writes).toHaveLength(2);
    const calls = state.query.mock.calls.map(([sql]) => sql as string);
    expect(
      calls.findIndex((sql) => sql.includes("pg_advisory_xact_lock")),
    ).toBeLessThan(
      calls.findIndex((sql) => sql.startsWith("SELECT a.id FROM")),
    );
  });
  it("keeps any remaining uncertain attempt blocking before allocation or writes", async () => {
    const f = fixture({ unresolved: true });
    await expect(
      createPayableQuote(f.database, f.identity, f.command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.allocation).not.toHaveBeenCalled();
    expect(f.writes).toEqual([]);
  });
  it("still denies a stale cart revision after the original refund is terminal", async () => {
    const f = fixture({ cartRevision: 8 });
    await expect(
      createPayableQuote(f.database, f.identity, f.command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.allocation).not.toHaveBeenCalled();
    expect(f.writes).toEqual([]);
  });
  it("still denies an obsolete actor before provider or persistence", async () => {
    const f = fixture();
    await expect(
      createPayableQuote(f.database, { subject: "foreign-buyer" }, f.command),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.query).not.toHaveBeenCalled();
    expect(state.stripe).not.toHaveBeenCalled();
  });
  it("rechecks current buyer authority after the provider readiness read", async () => {
    const f = fixture();
    state.human
      .mockResolvedValueOnce({ id: f.buyerId })
      .mockRejectedValueOnce(new SellerError("FORBIDDEN"));
    await expect(
      createPayableQuote(f.database, f.identity, f.command),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.allocation).not.toHaveBeenCalled();
    expect(f.writes).toEqual([]);
  });
  it("retains the original same-source/request quote instead of silently replacing it", async () => {
    const f = fixture(),
      originalId = randomUUID();
    state.query.mockResolvedValueOnce({
      rows: [{ id: originalId, hash: inputHash(f.command) }],
      rowCount: 1,
    });
    expect(await createPayableQuote(f.database, f.identity, f.command)).toEqual(
      { id: originalId },
    );
    expect(state.stripe).not.toHaveBeenCalled();
    expect(state.allocation).not.toHaveBeenCalled();
    expect(f.writes).toEqual([]);
  });
});
