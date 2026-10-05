import { describe, expect, it, vi } from "vitest";
// The focused configuration and ordinary unit suite share the actual web server marker.
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
import { randomUUID } from "node:crypto";
import {
  processBillingObservation,
  receiveBillingEvent,
} from "../../apps/web/src/features/seller-billing/jobs.server";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { PLANS } from "../../apps/web/src/features/seller-billing/model";
import type {
  SellerDatabase,
  SellerTransaction,
} from "../../apps/web/src/server/db/database";
import type { EffectContext } from "../../apps/web/src/server/jobs/execution.server";
import type { PaymentBindings } from "../../apps/web/src/features/payments/bindings.server";

const state = vi.hoisted(() => ({
  query: vi.fn(),
  provider: null as unknown,
  queued: vi.fn(),
}));
vi.mock("../../apps/web/src/server/db/database", () => ({
  inTransaction: (_db: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: state.query } }),
}));
vi.mock("../../apps/web/src/server/jobs/outbox.server", () => ({
  enqueueJob: (_tx: unknown, intent: unknown) => state.queued(intent),
}));
vi.mock("../../apps/web/src/features/payments/bindings.server", () => ({
  paymentBindings: () => ({
    platformAccount: "acct_Synthetic",
    livemode: false,
    environment: "test",
    applicationId: "t72-synthetic",
  }),
  verifiedStripe: () => state.provider,
}));
function fixture() {
  const sellerId = randomUUID(),
    id = randomUUID(),
    origin = randomUUID(),
    catalogue = randomUUID(),
    target = randomUUID(),
    customer = randomUUID();
  const row = {
    id,
    sellerId,
    operation: "change",
    catalogueId: target,
    customerBindingId: customer,
    subscriptionId: "sub_Synthetic",
    parameters: {
      payment_behavior: "pending_if_incomplete",
      proration_behavior: "always_invoice",
    },
    parameterHash: "",
    state: "ready",
    changeInvoiceId: "in_Synthetic",
    revision: 2,
    result: null,
  };
  row.parameterHash = inputHash(row.parameters);
  const sync = { generation: 0 },
    subscription = {
      id: randomUUID(),
      providerId: "sub_Synthetic",
      generation: 0,
      retiredAt: null,
    };
  const sub = {
    id: "sub_Synthetic",
    livemode: false,
    customer: "cus_Synthetic",
    metadata: {
      purpose: "seller_subscription",
      seller_id: sellerId,
      application_id: "t72-synthetic",
      environment: "test",
      billing_intent_id: origin,
    },
    items: {
      has_more: false,
      data: [
        {
          id: "si_Synthetic",
          quantity: 1,
          price: { id: "price_Old" },
          current_period_end: 2000000000,
        },
      ],
    },
    collection_method: "charge_automatically",
    status: "active",
    trial_end: null,
    schedule: null,
    pending_update: null,
    cancel_at_period_end: false,
  };
  const invoice = {
    id: "in_Synthetic",
    livemode: false,
    customer: "cus_Synthetic",
    currency: "eur",
    billing_reason: "subscription_update",
    collection_method: "charge_automatically",
    parent: { subscription_details: { subscription: "sub_Synthetic" } },
    total: 120,
    status: "void",
    post_payment_credit_notes_amount: 0,
    hosted_invoice_url: "https://invoice.stripe.com/i/synthetic",
  };
  const tx = { client: { query: state.query } } as unknown as SellerTransaction;
  state.query.mockReset();
  state.queued.mockReset();
  state.query.mockImplementation(
    async (sql: string, values: unknown[] = []) => {
      const result = (rows: unknown[]) => ({ rows, rowCount: rows.length });
      if (sql.includes("to_regclass")) return result([{ ready: true }]);
      if (sql.includes("FROM treido.seller_usage"))
        return result([{ seller_id: sellerId }]);
      if (sql.startsWith("SELECT revision"))
        return result([{ revision: row.revision }]);
      if (
        sql.startsWith("SELECT") &&
        sql.includes("FROM treido.billing_intents")
      )
        return result(
          sql.includes("operation='checkout'")
            ? [{ id: origin }]
            : [{ ...row }],
        );
      if (sql.includes("FROM treido.billing_customers"))
        return result([
          { id: customer, providerId: "cus_Synthetic", kind: "business" },
        ]);
      if (sql.startsWith("INSERT INTO treido.billing_sync")) return result([]);
      if (sql.startsWith("UPDATE treido.billing_sync"))
        return result([{ generation: ++sync.generation }]);
      if (sql.startsWith("SELECT generation FROM treido.billing_sync"))
        return result([sync]);
      if (sql.startsWith("UPDATE treido.billing_subscriptions SET generation"))
        return result([
          { ...subscription, generation: ++subscription.generation },
        ]);
      if (
        sql.startsWith("SELECT") &&
        sql.includes("FROM treido.billing_subscriptions")
      )
        return result([{ ...subscription }]);
      if (sql.includes("FROM treido.billing_catalogue"))
        return result([
          {
            id: catalogue,
            planId: "business_pro",
            version: 1,
            kind: "business",
            priceId: "price_Old",
            productId: "prod_Synthetic",
            amountMinor: 2499,
            limits: PLANS.business_pro.limits,
            terms: { bg: "Тест", en: "Test" },
            termsVersion: "synthetic-v1",
          },
        ]);
      if (sql.includes("FROM treido.billing_paid_intervals")) return result([]);
      if (sql.startsWith("UPDATE treido.billing_intents")) {
        if (values[3]) {
          row.state = values[3] as string;
          row.revision++;
        }
        return result([]);
      }
      if (sql.startsWith("UPDATE") || sql.startsWith("INSERT"))
        return result([]);
      throw Error("Unexpected synthetic SQL: " + sql);
    },
  );
  state.provider = {
    subscriptions: { retrieve: vi.fn(async () => sub) },
    invoices: {
      retrieve: vi.fn(async () => invoice),
      list: vi.fn(async () => ({ data: [invoice], has_more: false })),
    },
  };
  const job = {
    kind: "billing.reconcile",
    authority: "service",
    sellerId,
    resourceId: id,
  } as EffectContext;
  return {
    row,
    sync,
    subscription,
    sub,
    invoice,
    tx,
    job,
    database: {} as SellerDatabase,
  };
}
describe("T72 authoritative observation and late confirmation", () => {
  it("abandon -> provider void -> read reconciliation releases exactly the original change for replacement", async () => {
    const f = fixture();
    const result = await processBillingObservation(f.database, f.job);
    expect(f.row.state).toBe("ready");
    await result.apply!(f.tx);
    expect(f.row.state).toBe("expired");
  });
  it("a stale old observation cannot retire or complete a changed/replaced request", async () => {
    const f = fixture(),
      old = await processBillingObservation(f.database, f.job);
    f.row.state = "expired";
    f.row.revision++;
    await old.apply!(f.tx);
    expect(f.row.state).toBe("expired");
    expect(
      state.query.mock.calls.filter(([sql]) =>
        String(sql).startsWith("UPDATE treido.billing_intents"),
      ),
    ).toHaveLength(0);
  });
  it("a later observation generation defeats an older network result", async () => {
    const f = fixture(),
      old = await processBillingObservation(f.database, f.job);
    await processBillingObservation(f.database, f.job);
    await old.apply!(f.tx);
    expect(f.row.state).toBe("ready");
  });
  it("wrong-customer invoice cannot retire pending uniqueness", async () => {
    const f = fixture();
    f.invoice.customer = "cus_Other";
    await expect(
      processBillingObservation(f.database, f.job),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.row.state).toBe("ready");
  });
  it("signed correlation wakes origin and pending change using different deterministic outbox keys", async () => {
    const sellerId = randomUUID(),
      origin = randomUUID(),
      change = randomUUID();
    state.query.mockReset();
    state.queued.mockReset();
    state.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes("to_regclass")
        ? [{ ready: true }]
        : sql.includes("SELECT DISTINCT")
          ? [{ id: origin, sellerId }]
          : [{ id: change, sellerId }],
    }));
    const tx = {
      client: { query: state.query },
    } as unknown as SellerTransaction;
    const event = {
      id: "evt_Synthetic",
      type: "customer.subscription.pending_update_expired",
      data: {
        object: {
          id: "sub_Synthetic",
          metadata: {
            purpose: "seller_subscription",
            billing_intent_id: origin,
          },
        },
      },
    } as unknown as Parameters<typeof receiveBillingEvent>[1];
    const binding = {
      platformAccount: "acct_Synthetic",
      livemode: false,
      environment: "test",
      applicationId: "t72-synthetic",
    } as PaymentBindings;
    await receiveBillingEvent(tx, event, binding);
    await receiveBillingEvent(tx, event, binding);
    const [a, b, c, d] = state.queued.mock.calls.map((x) => x[0]);
    expect(a.resourceId).toBe(origin);
    expect(b.resourceId).toBe(change);
    expect(a.operationKey).not.toBe(b.operationKey);
    expect(c.operationKey).toBe(a.operationKey);
    expect(d.operationKey).toBe(b.operationKey);
  });
  it("a signed pending-update signal preserves the immutable invoice correlation without releasing money state", async () => {
    const f = fixture();
    state.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes("to_regclass")
        ? [{ ready: true }]
        : sql.includes("SELECT DISTINCT")
          ? [{ id: randomUUID(), sellerId: f.row.sellerId }]
          : sql.startsWith("SELECT id,seller_id")
            ? [{ id: f.row.id, sellerId: f.row.sellerId }]
            : [],
    }));
    const event = {
      id: "evt_SyntheticBound",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_Synthetic",
          customer: "cus_Synthetic",
          latest_invoice: "in_Synthetic",
          metadata: {
            purpose: "seller_subscription",
            billing_intent_id: randomUUID(),
          },
          pending_update: { metadata: { billing_change_intent_id: f.row.id } },
        },
      },
    } as unknown as Parameters<typeof receiveBillingEvent>[1];
    const binding = {
      platformAccount: "acct_Synthetic",
      livemode: false,
      environment: "test",
      applicationId: "t72-synthetic",
    } as PaymentBindings;
    await receiveBillingEvent(f.tx, event, binding);
    const capture = state.query.mock.calls.find(([sql]) =>
      String(sql).startsWith(
        "UPDATE treido.billing_intents i SET change_invoice_id",
      ),
    );
    expect(capture?.[1].slice(0, 2)).toEqual([f.row.id, "in_Synthetic"]);
    expect(capture?.[0]).not.toContain("state=");
    expect(f.row.state).toBe("ready");
  });
});
