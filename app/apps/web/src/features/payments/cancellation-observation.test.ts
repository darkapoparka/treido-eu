import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SellerDatabase } from "../../server/db/database";
import type { EffectContext } from "../../server/jobs/execution.server";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  query: vi.fn(),
  stripe: null as unknown,
  apply: vi.fn(),
  facts: vi.fn(),
}));
vi.mock("./bindings.server", () => ({
  paymentBindings: () => ({
    applicationId: "cancellation-synthetic",
    environment: "test",
    platformAccount: "acct_Synthetic",
    livemode: false,
  }),
  verifiedStripe: async () => state.stripe,
}));
vi.mock("./settlement.server", () => ({
  applyPaymentObservation: (...args: unknown[]) => state.apply(...args),
  paymentFacts: (...args: unknown[]) => state.facts(...args),
}));
vi.mock("../inventory/allocations.server", () => ({ lockAllocation: vi.fn() }));
import { inputHash } from "../sellers/persistence.server";
import { processPaymentObservation } from "./jobs.server";

beforeEach(() => {
  state.query.mockReset();
  state.apply.mockReset();
  state.facts.mockReset().mockResolvedValue({ facts: [] });
});

// Actual provider command/verification with synthetic persistence and SDK facts.
// Allocation release/native races and signed callbacks remain separate proof.
function fixture(
  status: Stripe.PaymentIntent.Status = "requires_payment_method",
) {
  const id = randomUUID(),
    quoteId = randomUUID(),
    sellerId = randomUUID();
  const metadata = {
    attempt_id: id,
    quote_id: quoteId,
    seller_id: sellerId,
    application_id: "cancellation-synthetic",
    environment: "test",
  };
  const parameters = { metadata };
  const row = {
    id,
    quoteId,
    sellerId,
    allocationId: randomUUID(),
    platformAccount: "acct_Synthetic",
    livemode: false,
    providerId: "pi_Synthetic",
    totalMinor: 1000,
    applicationFeeMinor: 0,
    connectedAccount: "acct_Recipient",
    cancelRequested: true,
    cancelKey: "treido:cancel:v1:synthetic-original",
    expiresAt: new Date(Date.now() + 60000),
    parameters,
    parameterHash: inputHash(parameters),
    terms: { settlementMerchant: "platform" },
  };
  const intent = {
    id: "pi_Synthetic",
    livemode: false,
    amount: 1000,
    currency: "eur",
    application_fee_amount: 0,
    transfer_data: { destination: "acct_Recipient" },
    on_behalf_of: null,
    metadata,
    capture_method: "automatic",
    status,
  };
  const retrieve = vi.fn(async () => ({ ...intent }));
  const cancel = vi.fn(async () => ({ ...intent, status: "canceled" }));
  const create = vi.fn();
  state.stripe = { paymentIntents: { retrieve, cancel, create } };
  state.query.mockResolvedValue({ rows: [row] });
  const database = {
    pool: { query: state.query },
  } as unknown as SellerDatabase;
  const job = {
    kind: "payment.reconcile",
    authority: "service",
    resourceId: id,
    sellerId,
  } as EffectContext;
  return {
    row,
    intent,
    retrieve,
    cancel,
    create,
    database,
    job,
    observe: () => processPaymentObservation(database, job),
  };
}

describe("unpaid provider cancellation retains one original effect identity", () => {
  it("uses the persisted cancellation key and applies only the verified terminal provider result", async () => {
    const f = fixture();
    const result = await f.observe();
    expect(f.cancel).toHaveBeenCalledExactlyOnceWith(
      "pi_Synthetic",
      { cancellation_reason: "abandoned" },
      { idempotencyKey: f.row.cancelKey },
    );
    expect(state.apply).not.toHaveBeenCalled();
    await result.apply!({} as never);
    expect(state.apply.mock.calls[0][2]).toMatchObject({
      id: "pi_Synthetic",
      status: "canceled",
    });
    expect(f.create).not.toHaveBeenCalled();
  });
  it("ambiguous cancellation retrieves the original intent and never creates or substitutes a payment", async () => {
    const f = fixture();
    f.cancel.mockRejectedValueOnce(
      Error("synthetic cancellation acknowledgement lost"),
    );
    f.retrieve
      .mockResolvedValueOnce({ ...f.intent })
      .mockResolvedValueOnce({ ...f.intent, status: "canceled" });
    const result = await f.observe();
    await result.apply!({} as never);
    expect(f.retrieve.mock.calls).toEqual([["pi_Synthetic"], ["pi_Synthetic"]]);
    expect(state.apply.mock.calls[0][2]).toMatchObject({ status: "canceled" });
    expect(f.cancel).toHaveBeenCalledOnce();
    expect(f.create).not.toHaveBeenCalled();
  });
  it("an observed succeeded payment wins the cancellation race and is never cancelled locally", async () => {
    const f = fixture("succeeded");
    const result = await f.observe();
    await result.apply!({} as never);
    expect(f.cancel).not.toHaveBeenCalled();
    expect(state.apply.mock.calls[0][2]).toMatchObject({ status: "succeeded" });
    expect(f.create).not.toHaveBeenCalled();
  });
  it("terminal canceled replay only observes the original intent, without another provider cancellation", async () => {
    const f = fixture("canceled");
    await (
      await f.observe()
    ).apply!({} as never);
    await (
      await f.observe()
    ).apply!({} as never);
    expect(f.retrieve).toHaveBeenCalledTimes(2);
    expect(f.cancel).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });
  it("nonterminal provider reads cannot be relabeled canceled after a failed cancellation", async () => {
    const f = fixture();
    f.cancel.mockRejectedValueOnce(Error("synthetic provider failure"));
    await (
      await f.observe()
    ).apply!({} as never);
    expect(state.apply.mock.calls[0][2]).toMatchObject({
      status: "requires_payment_method",
    });
    expect(f.create).not.toHaveBeenCalled();
  });
  it("rejects a foreign provider result before the cancellation POST or settlement apply", async () => {
    const f = fixture();
    f.intent.metadata = { ...f.intent.metadata, attempt_id: randomUUID() };
    await expect(f.observe()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.cancel).not.toHaveBeenCalled();
    expect(state.apply).not.toHaveBeenCalled();
  });
  it("rejects caller-supplied job authority before any database/provider read", async () => {
    const f = fixture();
    await expect(
      processPaymentObservation(f.database, { ...f.job, authority: "member" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.query).not.toHaveBeenCalled();
    expect(f.retrieve).not.toHaveBeenCalled();
  });
});
