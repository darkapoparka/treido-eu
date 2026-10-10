import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  query: vi.fn(),
  human: vi.fn(),
  seller: vi.fn(),
  recent: vi.fn(),
  enqueue: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: (_database: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: state.query } }),
}));
vi.mock("../../server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: (...args: unknown[]) =>
    state.recent(...args),
}));
vi.mock("../sellers/persistence.server", async (load) => ({
  ...(await load<typeof import("../sellers/persistence.server")>()),
  authorizeHuman: (...args: unknown[]) => state.human(...args),
  authorizeSeller: (...args: unknown[]) => state.seller(...args),
}));
vi.mock("../inventory/allocations.server", () => ({ lockAllocation: vi.fn() }));
vi.mock("../../server/jobs/outbox.server", () => ({
  enqueueJob: (...args: unknown[]) => state.enqueue(...args),
}));
vi.mock("../../server/jobs/config.server", () => ({
  requireJobBindings: () => ({ applicationId: "aftercare-synthetic" }),
}));
vi.mock("./bindings.server", () => ({
  paymentBindings: () => ({
    applicationId: "aftercare-synthetic",
    platformAccount: "acct_Synthetic",
    livemode: false,
    environment: "test",
  }),
}));
vi.mock("../order-aftercare/storage.server", () => ({
  legacyFullRefundMustOwnEntireBalance: vi.fn(),
}));
import { libraryActorKey } from "../library/cursor.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { requestPaymentCancellation } from "./attempts.server";
import { changePaidOrder } from "./orders.server";

beforeEach(() => {
  for (const stub of Object.values(state)) stub.mockReset();
  vi.stubEnv("TREIDO_DISCOVERY_CURSOR_KEY", "a".repeat(64));
});
afterEach(() => vi.unstubAllEnvs());

// Actual use cases with synthetic persistence/current authority. Native races
// and genuine Clerk/Stripe facts are separate integration acceptance.
function fixture() {
  const buyer: VerifiedIdentity = { subject: "synthetic-independent-buyer" };
  const merchant: VerifiedIdentity = { subject: "synthetic-current-merchant" };
  const foreign: VerifiedIdentity = { subject: "synthetic-foreign-human" };
  const buyerId = randomUUID(),
    merchantId = randomUUID(),
    sellerId = randomUUID();
  const quoteId = randomUUID(),
    orderId = randomUUID(),
    attemptId = randomUUID();
  const parameters = {
    metadata: { application_id: "aftercare-synthetic", environment: "test" },
  };
  const attempt = {
    id: attemptId,
    sellerId,
    buyerId,
    quoteId,
    allocationId: randomUUID(),
    providerId: "pi_Synthetic",
    totalMinor: 1000,
    applicationFeeMinor: 0,
    platformAccount: "acct_Synthetic",
    livemode: false,
    parameters,
    parameterHash: inputHash(parameters),
    terms: { refundPolicy: "full_fee_and_transfer_reversal" },
  };
  const order = {
    id: orderId,
    revision: 2,
    handover: "pickup",
    refundState: null,
    paymentState: "paid",
  };
  const receipt = {
    current: null as null | { hash: string; actorId: string; revision: number },
  };
  const writes: { sql: string; values: unknown[] }[] = [];
  let membership = true,
    activeBuyer = true,
    cancellationState = "requires_payment_method";
  state.recent.mockImplementation((identity) => identity === merchant);
  state.human.mockImplementation(async (_tx, identity) => {
    if (!activeBuyer) throw new SellerError("FORBIDDEN");
    return { id: identity === buyer ? buyerId : randomUUID() };
  });
  state.seller.mockImplementation(async (_tx, identity, id) => {
    if (!membership || identity !== merchant || id !== sellerId)
      throw new SellerError("FORBIDDEN");
    return { user: { id: merchantId } };
  });
  state.query.mockImplementation(
    async (sql: string, values: unknown[] = []) => {
      const result = (rows: unknown[]) => ({ rows, rowCount: rows.length });
      if (
        sql.includes("FROM treido.paid_orders o JOIN treido.payment_attempts")
      )
        return result(
          values[0] === orderId && values[1] === sellerId ? [attempt] : [],
        );
      if (sql.includes("FROM treido.paid_orders o JOIN treido.payable_quotes"))
        return result([{ ...order }]);
      if (sql.includes("FROM treido.paid_order_receipts"))
        return result(receipt.current ? [receipt.current] : []);
      if (
        sql.includes(
          "FROM treido.payment_attempts a JOIN treido.payable_quotes",
        )
      )
        return result(
          values[0] === quoteId && values[1] === buyerId ? [attempt] : [],
        );
      if (sql.startsWith("SELECT state FROM treido.payment_attempts"))
        return result([{ state: cancellationState }]);
      if (/^(INSERT|UPDATE)/.test(sql)) {
        writes.push({ sql, values });
        if (sql.startsWith("INSERT INTO treido.paid_order_receipts"))
          receipt.current = {
            hash: values[4] as string,
            actorId: values[2] as string,
            revision: values[5] as number,
          };
        if (sql.startsWith("UPDATE treido.paid_orders")) order.revision++;
        return result([]);
      }
      throw Error("Unexpected synthetic aftercare command query");
    },
  );
  const database = {
    pool: { query: state.query },
  } as unknown as SellerDatabase;
  const cancellation = {
    actorKey: libraryActorKey(buyer),
    requestId: randomUUID(),
    id: quoteId,
  };
  const refund = {
    actorKey: libraryActorKey(merchant),
    requestId: randomUUID(),
    id: orderId,
    sellerId,
    expectedRevision: 2,
    action: "refund",
    reason: "Synthetic full refund",
  };
  return {
    buyer,
    merchant,
    foreign,
    buyerId,
    merchantId,
    sellerId,
    quoteId,
    orderId,
    attemptId,
    order,
    receipt,
    writes,
    database,
    cancellation,
    refund,
    revokeMembership: () => {
      membership = false;
    },
    revokeBuyer: () => {
      activeBuyer = false;
    },
    terminalCancellation: (value: string) => {
      cancellationState = value;
    },
  };
}

describe("unpaid cancellation current authority", () => {
  it("denies a foreign buyer's owned-session request before writes or enqueue", async () => {
    const f = fixture();
    await expect(
      requestPaymentCancellation(f.database, f.foreign, {
        ...f.cancellation,
        actorKey: libraryActorKey(f.foreign),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.writes).toEqual([]);
    expect(state.enqueue).not.toHaveBeenCalled();
  });
  it("denies a revoked buyer and obsolete actor key before writes", async () => {
    const f = fixture();
    f.revokeBuyer();
    await expect(
      requestPaymentCancellation(f.database, f.buyer, f.cancellation),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.writes).toEqual([]);
    await expect(
      requestPaymentCancellation(f.database, f.foreign, f.cancellation),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.enqueue).not.toHaveBeenCalled();
  });
  it.each(["paid", "quarantined"])(
    "never requests provider cancellation for authoritative %s",
    async (value) => {
      const f = fixture();
      f.terminalCancellation(value);
      await expect(
        requestPaymentCancellation(f.database, f.buyer, f.cancellation),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(f.writes).toEqual([]);
      expect(state.enqueue).not.toHaveBeenCalled();
    },
  );
  it("retries retain the original observation identity and only request cancellation", async () => {
    const f = fixture();
    const first = await requestPaymentCancellation(
      f.database,
      f.buyer,
      f.cancellation,
    );
    expect(
      await requestPaymentCancellation(f.database, f.buyer, f.cancellation),
    ).toEqual(first);
    expect(first).toEqual({ id: f.attemptId, status: "reconciling" });
    expect(state.enqueue.mock.calls.map((call) => call[1])).toEqual(
      Array(2).fill({
        kind: "payment.reconcile",
        sellerId: f.sellerId,
        resourceId: f.attemptId,
        operationKey: f.cancellation.requestId,
        actorId: null,
        authority: "service",
      }),
    );
    expect(
      f.writes.every((write) =>
        write.sql.startsWith(
          "UPDATE treido.payment_attempts SET cancel_requested=true",
        ),
      ),
    ).toBe(true);
  });
});

describe("full refund command current seller authority and immutable receipt", () => {
  it("requires fresh verified authentication before opening persistence", async () => {
    const f = fixture();
    state.recent.mockReturnValue(false);
    await expect(
      changePaidOrder(f.database, f.merchant, f.refund),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.query).not.toHaveBeenCalled();
    expect(state.enqueue).not.toHaveBeenCalled();
  });
  it("denies revoked membership and foreign order resources without provider intent", async () => {
    const f = fixture();
    f.revokeMembership();
    await expect(
      changePaidOrder(f.database, f.merchant, f.refund),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.writes).toEqual([]);
    expect(state.enqueue).not.toHaveBeenCalled();
    const other = fixture();
    await expect(
      changePaidOrder(other.database, other.merchant, {
        ...other.refund,
        id: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(other.writes).toEqual([]);
  });
  it("denies stale current revision before the original refund is accepted", async () => {
    const f = fixture();
    f.order.revision = 3;
    await expect(
      changePaidOrder(f.database, f.merchant, f.refund),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.writes).toEqual([]);
    expect(state.enqueue).not.toHaveBeenCalled();
  });
  it("an exact retry returns the immutable receipt despite a changed current revision, without another refund", async () => {
    const f = fixture();
    const accepted = await changePaidOrder(f.database, f.merchant, f.refund);
    f.order.revision = 4;
    const before = f.writes.length;
    expect(await changePaidOrder(f.database, f.merchant, f.refund)).toEqual(
      accepted,
    );
    expect(accepted).toEqual({ id: f.orderId, revision: 3 });
    expect(f.writes).toHaveLength(before);
    expect(state.enqueue).toHaveBeenCalledOnce();
    expect(
      f.writes.filter((write) =>
        write.sql.startsWith("INSERT INTO treido.payment_refunds"),
      ),
    ).toHaveLength(1);
    expect(
      f.writes.some((write) =>
        /inventory_(skus|events)|inventory_allocations/.test(write.sql),
      ),
    ).toBe(false);
    await expect(
      changePaidOrder(f.database, f.merchant, {
        ...f.refund,
        reason: "Changed original terms",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("current membership remains required even for an accepted receipt replay", async () => {
    const f = fixture();
    await changePaidOrder(f.database, f.merchant, f.refund);
    f.revokeMembership();
    await expect(
      changePaidOrder(f.database, f.merchant, f.refund),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.enqueue).toHaveBeenCalledOnce();
  });
});
