import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SellerDatabase,
  SellerTransaction,
} from "../../server/db/database";
import type { EffectContext } from "../../server/jobs/execution.server";
import type { RefundIntent } from "./refund-storage.server";
import type { RefundObservation } from "./refund-provider.server";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  query: vi.fn(),
  provider: vi.fn(),
  observation: null as unknown as RefundObservation,
  create: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: (_database: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: state.query } }),
}));
vi.mock("../inventory/allocations.server", () => ({
  lockAllocation: vi.fn(),
}));
vi.mock("./storage.server", () => ({
  aftercareStorageAvailable: async () => true,
}));
vi.mock("./refund-provider.server", () => ({
  orderRefundProvider: () => state.provider(),
  assertRefundBinding: vi.fn(),
  findOriginalRefund: async () => null,
  observeOriginalRefund: async () => ({
    ...state.observation,
    fact: { ...state.observation.fact },
  }),
}));

import { inputHash } from "../sellers/persistence.server";
import { processOrderRefund } from "./jobs.server";

beforeEach(() => {
  state.query.mockReset();
  state.provider.mockReset();
  state.create.mockReset();
  state.provider.mockResolvedValue({
    binding: {},
    stripe: { refunds: { create: state.create } },
  });
});

// Actual processor and apply callback, synthetic persistence/provider facts.
// Native cases separately verify conditional SQL and repair-batch fairness.
function fixture(status: "pending" | "succeeded" | null = "pending") {
  const id = randomUUID(),
    orderId = randomUUID(),
    attemptId = randomUUID(),
    sellerId = randomUUID(),
    parameters = {
      payment_intent: "pi_Synthetic",
      amount: 1000,
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: {
        treido_purpose: "goods_aftercare_v2",
        aftercare_intent_id: id,
        order_id: orderId,
        attempt_id: attemptId,
        application_id: "aftercare-observation-synthetic",
        environment: "test",
      },
    };
  const row: RefundIntent = {
    id,
    orderId,
    attemptId,
    quoteId: randomUUID(),
    policyId: randomUUID(),
    sellerId,
    buyerId: randomUUID(),
    actorId: randomUUID(),
    requestId: randomUUID(),
    allocationId: randomUUID(),
    amountMinor: 1000,
    feeMinor: 10,
    originalFeeMinor: 20,
    totalMinor: 2000,
    currency: "EUR",
    platformAccount: "acct_Synthetic",
    livemode: false,
    environment: "test",
    applicationId: parameters.metadata.application_id,
    paymentIntentId: parameters.payment_intent,
    chargeId: "ch_Synthetic",
    connectedAccount: "acct_SyntheticSeller",
    operationKey: "treido:order-refund:v2:" + id,
    parameters,
    parameterHash: inputHash(parameters),
    expiresAt: new Date(Date.now() + 600000),
    firstAttemptAt: new Date(),
    state: "reconciling",
    revision: 1,
    generation: 0,
    providerId: status ? "re_Synthetic" : null,
    providerStatus: status,
    settlementState: "reconciling",
  };
  state.observation = {
    providerId: status ? "re_Synthetic" : null,
    providerStatus: status,
    state: status === "pending" ? "pending" : "reconciling",
    settlementState: "reconciling",
    fact: {
      refundId: status ? "re_Synthetic" : null,
      status,
      amountMinor: row.amountMinor,
      chargeId: row.chargeId,
      amountRefundedMinor: status === "succeeded" ? row.amountMinor : 0,
      chargeDisputed: false,
      reversalId: null,
      reversalMinor: null,
      feeRefundedMinor: null,
      feeRefundIds: [],
    },
  };
  const writes: { sql: string; values: unknown[] }[] = [],
    order = { payment: "refund_pending", settlement: "reconciliation" };
  let totals = { paid: row.amountMinor, pending: false };
  state.query.mockImplementation(
    async (sql: string, values: unknown[] = []) => {
      const result = (rows: unknown[]) => ({ rows, rowCount: rows.length });
      if (sql.includes("FROM treido.order_refund_intents r JOIN"))
        return result([{ ...row }]);
      if (sql.startsWith("UPDATE treido.order_refund_intents SET generation")) {
        row.generation++;
        return result([{ generation: row.generation }]);
      }
      if (sql.includes("sum(fee_minor)")) return result([{ fee: 0, n: 0 }]);
      if (sql.includes("sum(amount_minor)")) return result([totals]);
      if (sql.startsWith("SELECT id FROM treido.paid_orders"))
        return result([{ id: orderId }]);
      if (sql.startsWith("INSERT INTO treido.order_refund_observations")) {
        writes.push({ sql, values });
        return result([]);
      }
      if (
        sql.startsWith("UPDATE treido.order_refund_intents SET provider_id")
      ) {
        writes.push({ sql, values });
        row.providerId ??= values[1] as string | null;
        row.providerStatus = values[2] as string | null;
        row.state = values[3] as RefundIntent["state"];
        row.settlementState = values[4] as string;
        return result([]);
      }
      if (sql.startsWith("UPDATE treido.paid_orders")) {
        writes.push({ sql, values });
        order.payment = values[1] as string;
        order.settlement = values[2]
          ? "reversed"
          : values[3]
            ? "reconciliation"
            : order.settlement;
        return result([]);
      }
      throw Error("Unexpected synthetic aftercare query");
    },
  );
  const database = {
      pool: { query: state.query },
    } as unknown as SellerDatabase,
    tx = { client: { query: state.query } } as unknown as SellerTransaction,
    job = {
      kind: "payment.aftercare",
      authority: "service",
      actorId: null,
      resourceId: id,
      sellerId,
    } as EffectContext;
  return {
    row,
    order,
    writes,
    tx,
    job,
    totals: (next: typeof totals) => {
      totals = next;
    },
    observe: () => processOrderRefund(database, job),
  };
}

describe("aftercare observations keep current original monetary evidence", () => {
  it.each([null, "pending"] as const)(
    "does not overwrite a succeeded acknowledgement with an older %s read in the same generation",
    async (status) => {
      const f = fixture(status),
        effect = await f.observe();
      f.row.providerId = "re_Synthetic";
      f.row.providerStatus = "succeeded";
      await effect.apply!(f.tx);
      expect(f.row.providerStatus).toBe("succeeded");
      expect(f.row.state).toBe("reconciling");
      expect(f.writes).toEqual([]);
      expect(state.create).not.toHaveBeenCalled();
    },
  );
  it.each(["failed", "canceled"])(
    "preserves newer terminal provider status %s",
    async (terminal) => {
      const f = fixture(),
        effect = await f.observe();
      f.row.providerStatus = terminal;
      await effect.apply!(f.tx);
      expect(f.row.providerStatus).toBe(terminal);
      expect(f.writes).toEqual([]);
    },
  );
  it("retains an identified refund after an older empty lookup", async () => {
    const f = fixture(null),
      effect = await f.observe();
    f.row.providerId = "re_Synthetic";
    await effect.apply!(f.tx);
    expect(f.writes).toEqual([]);
  });
  it("rejects a different provider identity before appending observations", async () => {
    const f = fixture(),
      effect = await f.observe();
    f.row.providerId = "re_Different";
    await expect(effect.apply!(f.tx)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(f.writes).toEqual([]);
  });
  it.each(["succeeded", "expired", "remedy_required"] as const)(
    "does not revive current terminal local state %s",
    async (terminal) => {
      const f = fixture(),
        effect = await f.observe();
      f.row.state = terminal;
      await effect.apply!(f.tx);
      expect(f.row.state).toBe(terminal);
      expect(f.writes).toEqual([]);
    },
  );
  it("keeps the existing newer-generation fence", async () => {
    const f = fixture(),
      effect = await f.observe();
    f.row.generation++;
    await effect.apply!(f.tx);
    expect(f.writes).toEqual([]);
  });
  it.each([false, true])(
    "continues succeeded refund settlement recovery, full=%s",
    async (full) => {
      const f = fixture("succeeded");
      state.observation.state = "succeeded";
      state.observation.settlementState = "verified";
      if (full) f.totals({ paid: f.row.totalMinor, pending: false });
      const effect = await f.observe();
      await effect.apply!(f.tx);
      expect(f.row.state).toBe("succeeded");
      expect(f.row.settlementState).toBe("verified");
      expect(f.order.payment).toBe(full ? "refunded" : "paid");
      expect(f.order.settlement).toBe(full ? "reversed" : "reconciliation");
      expect(f.writes).toHaveLength(3);
      expect(state.create).not.toHaveBeenCalled();
    },
  );
  it("keeps succeeded-but-unverified settlement eligible for another observation", async () => {
    const f = fixture("succeeded"),
      effect = await f.observe();
    f.totals({ paid: f.row.amountMinor, pending: true });
    await effect.apply!(f.tx);
    expect(f.row.state).toBe("reconciling");
    expect(f.row.providerStatus).toBe("succeeded");
    expect(f.row.settlementState).toBe("reconciling");
    expect(f.order.payment).toBe("refund_pending");
    expect(f.writes).toHaveLength(3);
  });
  it("completes an already succeeded refund without provider IO", async () => {
    const f = fixture("succeeded");
    f.row.state = "succeeded";
    expect(await f.observe()).toEqual({ resultId: f.row.id });
    expect(state.provider).not.toHaveBeenCalled();
    expect(state.create).not.toHaveBeenCalled();
  });
});
