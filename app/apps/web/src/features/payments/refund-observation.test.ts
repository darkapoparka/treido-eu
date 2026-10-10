import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SellerDatabase,
  SellerTransaction,
} from "../../server/db/database";
import type { EffectContext } from "../../server/jobs/execution.server";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  query: vi.fn(),
  stripe: null as unknown,
  append: vi.fn(),
  authorizeSeller: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: (_database: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: state.query } }),
}));
vi.mock("../inventory/allocations.server", () => ({
  lockAllocation: vi.fn(),
}));
vi.mock("./bindings.server", () => ({
  paymentBindings: () => ({
    applicationId: "refund-observation-synthetic",
    environment: "test",
    platformAccount: "acct_Synthetic",
    livemode: false,
  }),
  verifiedStripe: async () => state.stripe,
}));
vi.mock("./attempts.server", () => ({
  attemptColumns: "synthetic_attempt_columns",
  assertAttemptScope: vi.fn(),
  enqueuePaymentObservation: vi.fn(),
  verifyPaymentIntent: vi.fn(),
}));
vi.mock("./settlement.server", () => ({
  appendFacts: (...args: unknown[]) => state.append(...args),
  applyPaymentObservation: vi.fn(),
  paymentFacts: vi.fn(),
}));
vi.mock("../sellers/persistence.server", async (load) => ({
  ...(await load<typeof import("../sellers/persistence.server")>()),
  authorizeSeller: (...args: unknown[]) => state.authorizeSeller(...args),
}));

import { inputHash } from "../sellers/persistence.server";
import { processPaymentRefund } from "./jobs.server";

beforeEach(() => {
  state.query.mockReset();
  state.append.mockReset();
  state.authorizeSeller.mockReset().mockResolvedValue({});
});

// Actual processor/callback with synthetic persistence and provider responses.
// These cases prove callback replay behavior, not native races or Stripe readiness.
function fixture(
  status: "pending" | "succeeded" | "failed" | null,
  options: { prepared?: boolean; feeMinor?: number } = {},
) {
  const id = randomUUID(),
    attemptId = randomUUID(),
    sellerId = randomUUID(),
    orderId = randomUUID();
  const parameters = {
    payment_intent: "pi_Synthetic",
    amount: 1000,
    reverse_transfer: true,
    refund_application_fee: (options.feeMinor ?? 0) > 0,
    metadata: {
      refund_id: id,
      attempt_id: attemptId,
      application_id: "refund-observation-synthetic",
      environment: "test",
    },
  };
  const refund = {
    id,
    attemptId,
    sellerId,
    orderId,
    actorId: randomUUID(),
    operationKey: "synthetic-original-refund-key",
    state: options.prepared ? "prepared" : "reconciling",
    providerId:
      status && !options.prepared ? "re_Synthetic" : (null as string | null),
    parameters,
    parameterHash: inputHash(parameters),
  };
  const attempt = {
    id: attemptId,
    allocationId: randomUUID(),
    providerId: "pi_Synthetic",
    totalMinor: 1000,
    applicationFeeMinor: options.feeMinor ?? 0,
  };
  const order = {
    paymentState: "refund_pending",
    settlementState: "reconciliation",
  };
  const writes: { sql: string; values: unknown[] }[] = [];
  let exists = true;
  state.query.mockImplementation(
    async (sql: string, values: unknown[] = []) => {
      const result = (rows: unknown[]) => ({ rows, rowCount: rows.length });
      if (sql.includes("FROM treido.payment_refunds"))
        return result(exists ? [{ ...refund }] : []);
      if (sql.includes("FROM treido.payment_attempts"))
        return result([{ ...attempt }]);
      if (sql.includes("FROM treido.users"))
        return result([{ subject: "synthetic-current-refund-human" }]);
      if (sql.includes("FROM treido.payment_facts"))
        return result(
          sql.includes("kind='transfer'")
            ? [{ id: "tr_Synthetic" }]
            : attempt.applicationFeeMinor > 0
              ? [{ id: "fee_Synthetic" }]
              : [],
        );
      if (sql.startsWith("UPDATE treido.payment_refunds")) {
        writes.push({ sql, values });
        if (sql.includes("state='creating'")) {
          refund.state = "creating";
          return result([]);
        }
        if (sql.includes("state='reconciling'")) {
          refund.state = "reconciling";
          return result([]);
        }
        refund.providerId ??= values[1] as string | null;
        refund.state = values[2] as string;
        return result([]);
      }
      if (sql.startsWith("UPDATE treido.paid_orders")) {
        writes.push({ sql, values });
        order.paymentState = values[1] as string;
        order.settlementState = values[2] ? "reversed" : "reconciliation";
        return result([]);
      }
      throw Error("Unexpected synthetic refund query");
    },
  );
  const observed = {
    id: "re_Synthetic",
    status,
    amount: 1000,
    currency: "eur",
    payment_intent: "pi_Synthetic",
    metadata: parameters.metadata,
    transfer_reversal: "trr_Synthetic",
  };
  const create = vi.fn(async (): Promise<typeof observed> => {
    throw Error("Observation must not emit another refund");
  });
  const reversal = {
    id: "trr_Synthetic",
    amount: 1000,
    currency: "eur",
    source_refund: "re_Synthetic",
  };
  const list = vi.fn((): AsyncGenerator<typeof observed> =>
    (async function* () {})(),
  );
  state.stripe = {
    refunds: {
      create,
      retrieve: vi.fn(async () => ({ ...observed })),
      list,
    },
    transfers: {
      retrieveReversal: vi.fn(async () => ({ ...reversal })),
    },
    applicationFees: {
      retrieve: vi.fn(async () => ({
        id: "fee_Synthetic",
        amount_refunded: attempt.applicationFeeMinor,
      })),
      listRefunds: vi.fn(async () => ({
        has_more: false,
        data: [
          {
            id: "fr_Synthetic",
            amount: attempt.applicationFeeMinor,
            currency: "eur",
          },
        ],
      })),
    },
  };
  const database = {
    pool: { query: state.query },
  } as unknown as SellerDatabase;
  const tx = { client: { query: state.query } } as unknown as SellerTransaction;
  const job = {
    kind: "payment.refund",
    authority: "service",
    actorId: null,
    resourceId: id,
    sellerId,
  } as EffectContext;
  return {
    refund,
    order,
    writes,
    create,
    list,
    observed,
    reversal,
    attempt,
    tx,
    hideRefund: () => {
      exists = false;
    },
    observe: () => processPaymentRefund(database, job),
  };
}

describe("full refund observations retain newer authoritative results", () => {
  it("emits the original full refund once, then only observes it on replay", async () => {
    const f = fixture("pending", { prepared: true });
    f.create.mockResolvedValueOnce({ ...f.observed });
    const first = await f.observe();
    await first.apply!(f.tx);
    expect(state.authorizeSeller).toHaveBeenCalledWith(
      expect.anything(),
      { subject: "synthetic-current-refund-human" },
      f.refund.sellerId,
      "refund.request",
    );
    expect(f.create).toHaveBeenCalledExactlyOnceWith(f.refund.parameters, {
      idempotencyKey: f.refund.operationKey,
    });
    await (
      await f.observe()
    ).apply!(f.tx);
    expect(f.create).toHaveBeenCalledOnce();
    expect(f.refund).toMatchObject({
      state: "pending",
      providerId: "re_Synthetic",
    });
  });

  it("lost provider acknowledgement is reconciled by the original metadata without another POST", async () => {
    const f = fixture("succeeded", { prepared: true });
    f.create.mockRejectedValueOnce(Error("synthetic accepted response lost"));
    await (
      await f.observe()
    ).apply!(f.tx);
    expect(f.refund).toMatchObject({ state: "reconciling", providerId: null });
    f.list.mockImplementationOnce(() =>
      (async function* () {
        yield { ...f.observed };
      })(),
    );
    await (
      await f.observe()
    ).apply!(f.tx);
    expect(f.create).toHaveBeenCalledOnce();
    expect(f.list).toHaveBeenCalledWith({
      payment_intent: "pi_Synthetic",
      limit: 100,
    });
    expect(f.refund).toMatchObject({
      state: "succeeded",
      providerId: "re_Synthetic",
    });
    expect(f.order).toEqual({
      paymentState: "refunded",
      settlementState: "reversed",
    });
  });

  it("revoked current membership prevents the prepared provider emission", async () => {
    const f = fixture("succeeded", { prepared: true });
    state.authorizeSeller.mockRejectedValueOnce(
      Object.assign(Error("FORBIDDEN"), { code: "FORBIDDEN" }),
    );
    await expect(f.observe()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.create).not.toHaveBeenCalled();
    expect(f.writes).toEqual([]);
    expect(state.append).not.toHaveBeenCalled();
  });

  it.each(["amount", "source_refund"] as const)(
    "an unverified reversal %s cannot complete a provider-successful refund",
    async (field) => {
      const f = fixture("succeeded");
      if (field === "amount") f.reversal.amount--;
      else f.reversal.source_refund = "re_Foreign";
      await (
        await f.observe()
      ).apply!(f.tx);
      expect(f.refund.state).toBe("reconciling");
      expect(f.order).toEqual({
        paymentState: "refund_pending",
        settlementState: "reconciliation",
      });
      expect(state.append.mock.calls[0][2]).toEqual([
        {
          kind: "refund",
          objectId: "re_Synthetic",
          amountMinor: 1000,
          currency: "eur",
        },
      ]);
    },
  );

  it("records the applicable full fee refund separately from gross refund and transfer reversal", async () => {
    const f = fixture("succeeded", { feeMinor: 20 });
    await (
      await f.observe()
    ).apply!(f.tx);
    expect(f.refund.state).toBe("succeeded");
    expect(state.append.mock.calls[0][2]).toContainEqual({
      kind: "fee_refund",
      objectId: "fr_Synthetic",
      amountMinor: 20,
      currency: "eur",
    });
    expect(f.create).not.toHaveBeenCalled();
  });

  it.each([null, "pending"] as const)(
    "does not replace a newer success with an older %s observation",
    async (status) => {
      const f = fixture(status),
        effect = await f.observe();
      f.refund.state = "succeeded";
      f.refund.providerId = "re_Synthetic";
      f.order.paymentState = "refunded";
      f.order.settlementState = "reversed";
      await effect.apply!(f.tx);
      expect(f.refund.state).toBe("succeeded");
      expect(f.order).toEqual({
        paymentState: "refunded",
        settlementState: "reversed",
      });
      expect(f.writes).toEqual([]);
      expect(state.append).not.toHaveBeenCalled();
      expect(f.create).not.toHaveBeenCalled();
    },
  );

  it("does not replace a newer terminal failure with an older pending observation", async () => {
    const f = fixture("pending"),
      effect = await f.observe();
    f.refund.state = "failed";
    f.order.paymentState = "reconciliation";
    await effect.apply!(f.tx);
    expect(f.refund.state).toBe("failed");
    expect(f.order.paymentState).toBe("reconciliation");
    expect(f.writes).toEqual([]);
  });

  it("ignores an empty old lookup after the same refund has a known provider identity", async () => {
    const f = fixture(null),
      effect = await f.observe();
    f.refund.state = "pending";
    f.refund.providerId = "re_Synthetic";
    await effect.apply!(f.tx);
    expect(f.refund.state).toBe("pending");
    expect(f.refund.providerId).toBe("re_Synthetic");
    expect(f.writes).toEqual([]);
  });

  it("rejects a different current provider identity before appending facts or changing the order", async () => {
    const f = fixture("succeeded"),
      effect = await f.observe();
    f.refund.providerId = "re_Different";
    await expect(effect.apply!(f.tx)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(f.writes).toEqual([]);
    expect(state.append).not.toHaveBeenCalled();
  });

  it("requires the original scoped refund to remain present at apply time", async () => {
    const f = fixture("pending"),
      effect = await f.observe();
    f.hideRefund();
    await expect(effect.apply!(f.tx)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(f.writes).toEqual([]);
    expect(state.append).not.toHaveBeenCalled();
  });

  it("retains ordinary pending observation and the original provider identity", async () => {
    const f = fixture("pending"),
      effect = await f.observe();
    await effect.apply!(f.tx);
    expect(f.refund.state).toBe("pending");
    expect(f.refund.providerId).toBe("re_Synthetic");
    expect(f.order.paymentState).toBe("refund_pending");
    expect(f.writes).toHaveLength(2);
    expect(f.create).not.toHaveBeenCalled();
  });

  it("still completes an original full refund only with its observed reversal", async () => {
    const f = fixture("succeeded"),
      effect = await f.observe();
    await effect.apply!(f.tx);
    expect(f.refund.state).toBe("succeeded");
    expect(f.order).toEqual({
      paymentState: "refunded",
      settlementState: "reversed",
    });
    expect(state.append.mock.calls[0][2]).toEqual([
      {
        kind: "refund",
        objectId: "re_Synthetic",
        amountMinor: 1000,
        currency: "eur",
      },
      {
        kind: "transfer_reversal",
        objectId: "trr_Synthetic",
        amountMinor: 1000,
        currency: "eur",
      },
    ]);
    expect(f.create).not.toHaveBeenCalled();
  });
});
