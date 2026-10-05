import { beforeEach, describe, expect, it, vi } from "vitest";
// The focused configuration and ordinary unit suite share the actual web server marker.
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
import { randomUUID } from "node:crypto";
import Stripe from "../../apps/web/node_modules/stripe/esm/stripe.esm.node.js";
import {
  pendingChange,
  changeResolution,
  parseBillingRecovery,
} from "../../apps/web/src/features/seller-billing/recovery-model";
import {
  invoiceReview,
  matchingChangeInvoice,
  subscriptionReview,
} from "../../apps/web/src/features/seller-billing/change-provider.server";
import { manageBillingRecovery } from "../../apps/web/src/features/seller-billing/recovery.server";
import {
  publicIntent,
  executeBillingIntent,
  type BillingIntent,
} from "../../apps/web/src/features/seller-billing/commands.server";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { PLANS } from "../../apps/web/src/features/seller-billing/model";
import { readSellerBilling } from "../../apps/web/src/features/seller-billing/queries.server";
import * as billingProvider from "../../apps/web/src/features/seller-billing/provider.server";
import { SellerError } from "../../apps/web/src/features/sellers/errors";
import type { SellerDatabase } from "../../apps/web/src/server/db/database";

const mocks = vi.hoisted(() => ({
  recent: true,
  provider: null as unknown,
  query: vi.fn(),
  queued: vi.fn(),
}));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: () => mocks.recent,
}));
vi.mock("../../apps/web/src/server/db/database", () => ({
  inTransaction: (_db: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: mocks.query } }),
}));
vi.mock("../../apps/web/src/server/jobs/outbox.server", () => ({
  enqueueJob: (...args: unknown[]) => mocks.queued(...args),
}));
vi.mock("../../apps/web/src/features/sellers/free-catalogue.server", () => ({
  readFreeCatalogueLimits: () => ({
    ...PLANS.business_free.limits,
    planId: "business_free",
    planVersion: 1,
    paidUntil: null,
    draftCount: 0,
  }),
}));
vi.mock("../../apps/web/src/features/catalog/public-discovery.server", () => ({
  publicDiscoveryKey: () => Buffer.from("a".repeat(64), "hex"),
}));
vi.mock("../../apps/web/src/features/payments/bindings.server", () => ({
  paymentBindings: () => ({
    platformAccount: "acct_Synthetic",
    livemode: false,
    environment: "test",
    applicationId: "t72-synthetic",
  }),
  verifiedStripe: () => mocks.provider,
}));
vi.mock(
  "../../apps/web/src/features/seller-billing/provider.server",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    subscriptionBindings: () => ({
      platformAccount: "acct_Synthetic",
      livemode: false,
      environment: "test",
      applicationId: "t72-synthetic",
    }),
    qualifiedBillingProvider: () => mocks.provider,
  }),
);
const identity = { subject: "user_T72Synthetic" },
  actor = randomUUID(),
  seller = randomUUID(),
  catalogue = randomUUID(),
  customer = randomUUID();
// The production actor fingerprint uses identity subject; obtain the actual function.
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
const command = (row: BillingIntent, operation = "abandon") => ({
  sellerId: seller,
  actorKey: libraryActorKey(identity),
  intentId: row.id,
  requestId: randomUUID(),
  expectedRevision: row.revision,
  operation,
});
const metadata = {
  seller_id: seller,
  purpose: "seller_subscription",
  application_id: "t72-synthetic",
  environment: "test",
};
const plan = {
  id: catalogue,
  planId: "business_pro",
  version: 2,
  kind: "business",
  priceId: "price_Target",
  productId: "prod_Synthetic",
  amountMinor: 2499,
  limits: PLANS.business_pro.limits,
  terms: { bg: "Тест", en: "Test" },
  termsVersion: "synthetic-v2",
};
const base = (): BillingIntent => ({
  id: randomUUID(),
  sellerId: seller,
  actorId: actor,
  requestId: randomUUID(),
  inputHash: "a".repeat(64),
  operation: "change",
  catalogueId: catalogue,
  customerBindingId: customer,
  subscriptionId: "sub_Synthetic",
  parameters: {
    payment_behavior: "pending_if_incomplete",
    proration_behavior: "always_invoice",
    proration_date: 1900000000,
    items: [{ id: "si_Synthetic", price: "price_Target", quantity: 1 }],
  },
  expectedPriceId: "price_Old",
  parameterHash: "",
  idempotencyKey: "t72-synthetic:" + randomUUID(),
  expiresAt: new Date("2020-01-01"),
  state: "ready",
  providerId: "sub_Synthetic",
  hostedUrl: "https://invoice.stripe.com/i/synthetic",
  result: null,
  firstAttemptAt: new Date(),
  revision: 3,
  changeInvoiceId: "in_Synthetic",
});
function databaseFixture(row: BillingIntent) {
  const receipts = new Map<string, Record<string, unknown>>();
  const access = { allowed: true };
  mocks.query.mockImplementation(
    async (sql: string, values: unknown[] = []) => {
      const result = (rows: unknown[]) => ({ rows, rowCount: rows.length });
      if (sql.includes("FROM treido.users"))
        return result([{ id: actor, status: "active" }]);
      if (sql.includes("FROM treido.seller_accounts"))
        return result([
          {
            id: seller,
            kind: "business",
            name: "Synthetic",
            status: "active",
            revision: 1,
          },
        ]);
      if (sql.includes("FROM treido.seller_memberships"))
        return result([
          {
            userId: actor,
            sellerId: seller,
            role: "owner",
            status: access.allowed ? "active" : "revoked",
            grants: [],
          },
        ]);
      if (sql.includes("to_regclass")) return result([{ ready: true }]);
      if (
        sql.includes("FROM treido.seller_usage") ||
        sql.includes("lock_billing_registry")
      )
        return result([{ seller_id: seller }]);
      if (sql.includes("FROM treido.billing_customers"))
        return result([{ id: customer, providerId: "cus_Synthetic" }]);
      if (sql.includes("FROM treido.billing_catalogue")) return result([plan]);
      if (sql.startsWith("SELECT count(*)")) return result([{ count: "0" }]);
      if (sql.startsWith("SELECT") && sql.includes("billing_recovery_requests"))
        return result(
          values.length === 3
            ? [receipts.get(values[2] as string)].filter(Boolean)
            : [...receipts.values()].filter((x) => x.state !== "complete"),
        );
      if (sql.startsWith("INSERT INTO treido.billing_recovery_requests")) {
        const record = {
          id: values[0],
          intentId: values[1],
          inputHash: values[5],
          operation: values[6],
          invoiceId: values[8],
          idempotencyKey: values[9],
          state: values[10],
        };
        receipts.set(values[4] as string, record);
        return result([record]);
      }
      if (sql.startsWith("UPDATE treido.billing_recovery_requests")) {
        for (const r of receipts.values())
          if (r.id === values[0])
            r.state = sql.includes("state='creating'")
              ? "creating"
              : "reconciling";
        return result([]);
      }
      if (sql.startsWith("UPDATE treido.billing_intents")) {
        if (sql.includes("state='expired'")) {
          if (row.firstAttemptAt) throw Error("Attempted local expiry");
          row.state = "expired";
          row.revision++;
        } else if (sql.includes("state='creating'")) {
          row.state = "creating";
          row.firstAttemptAt = new Date();
          row.revision++;
        } else if (sql.includes("state='reconciling'")) {
          row.state = "reconciling";
          row.revision++;
        } else {
          row.providerId = values[1] as string;
          row.hostedUrl = values[2] as string;
          row.result ??= values[3] as BillingIntent["result"];
          row.state = values[4] as string;
          row.changeInvoiceId = values[5] as string;
          row.revision++;
        }
        return result([{ ...row }]);
      }
      if (sql.includes("FROM treido.billing_intents"))
        return result([{ ...row }]);
      throw Error("Unexpected synthetic SQL: " + sql);
    },
  );
  row.parameterHash = inputHash(row.parameters);
  return { database: {} as SellerDatabase, access, receipts };
}
function providerFixture(status = "open", failVoid = false) {
  const writes: { path: string; key: string | null; body: URLSearchParams }[] =
    [];
  const invoice = {
    id: "in_Synthetic",
    object: "invoice",
    livemode: false,
    customer: "cus_Synthetic",
    currency: "eur",
    billing_reason: "subscription_update",
    collection_method: "charge_automatically",
    status,
    parent: { subscription_details: { subscription: "sub_Synthetic" } },
  };
  const sub = {
    id: "sub_Synthetic",
    object: "subscription",
    customer: "cus_Synthetic",
    livemode: false,
    metadata,
    latest_invoice: "in_Synthetic",
    pending_update: status === "open" ? { expires_at: 2000000000 } : null,
  };
  const stripe = new Stripe("SYNTHETIC-LOCAL-ONLY", {
    apiVersion: "2026-09-30.endive",
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname !== "api.stripe.com")
        throw Error("Synthetic transport only");
      if (init?.method === "POST") {
        writes.push({
          path: url.pathname,
          key: new Headers(init.headers).get("Idempotency-Key"),
          body: new URLSearchParams(String(init.body)),
        });
        if (failVoid) throw Error("Synthetic lost acknowledgement");
        invoice.status = "void";
        sub.pending_update = null;
      }
      return Response.json(url.pathname.includes("invoices") ? invoice : sub, {
        headers: { "request-id": "req_Synthetic" },
      });
    }),
  });
  mocks.provider = stripe;
  return { writes, invoice, sub };
}
beforeEach(() => {
  mocks.recent = true;
  mocks.query.mockReset();
  mocks.queued.mockReset();
});
describe("T72 synthetic billing recovery commands and official SDK transport", () => {
  it("provider configuration being unavailable keeps existing legacy recovery controls visible without a provider URL", async () => {
    const row = base();
    row.parameters = { flow_data: { type: "subscription_update_confirm" } };
    const f = databaseFixture(row),
      previous = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation((sql: string, values: unknown[]) =>
      sql.includes("FROM treido.listings")
        ? { rows: [{ active: "0", seats: "1", variants: "0" }], rowCount: 1 }
        : previous(sql, values),
    );
    vi.spyOn(billingProvider, "subscriptionBindings").mockImplementationOnce(
      () => {
        throw new SellerError("NOT_AVAILABLE");
      },
    );
    const view = await readSellerBilling(f.database, identity, seller);
    expect(view.available).toBe(false);
    expect(view.intents).toHaveLength(1);
    expect(view.intents[0]).toMatchObject({ recovery: "legacy", url: null });
  });
  it("voids only the original invoice/key after an explicit current-owner command, then awaits authoritative reconciliation", async () => {
    const row = base(),
      f = databaseFixture(row),
      p = providerFixture(),
      c = command(row);
    const result = await manageBillingRecovery(f.database, identity, c);
    expect(p.writes).toHaveLength(1);
    expect(p.writes[0].path).toBe("/v1/invoices/in_Synthetic/void");
    expect(p.writes[0].key).toBe("seller-billing-recovery:" + result.receiptId);
    expect(row.state).toBe("ready");
    expect(result.state).toBe("reconciling");
    await manageBillingRecovery(f.database, identity, c);
    expect(p.writes).toHaveLength(1);
  });
  it("lost cancellation acknowledgement permits an explicit retry of only the same invoice and key, preserving the pending-money slot", async () => {
    const row = base(),
      f = databaseFixture(row),
      p = providerFixture("open", true),
      c = command(row);
    await manageBillingRecovery(f.database, identity, c);
    await manageBillingRecovery(f.database, identity, c);
    expect(p.writes).toHaveLength(2);
    expect(p.writes[1].key).toBe(p.writes[0].key);
    expect(p.writes[1].path).toBe(p.writes[0].path);
    expect(row.state).toBe("ready");
  });
  it("payment winning cancellation cannot be voided or locally expired", async () => {
    const row = base(),
      f = databaseFixture(row),
      p = providerFixture("paid");
    await manageBillingRecovery(f.database, identity, command(row));
    expect(p.writes).toHaveLength(0);
    expect(row.state).toBe("ready");
  });
  it("abandoning a never-attempted prepared command releases safely without any provider call", async () => {
    const row = base();
    row.state = "prepared";
    row.firstAttemptAt = null;
    row.changeInvoiceId = null;
    const f = databaseFixture(row),
      p = providerFixture();
    await manageBillingRecovery(f.database, identity, command(row));
    expect(row.state).toBe("expired");
    expect(p.writes).toHaveLength(0);
  });
  it("hidden expired legacy URL remains blocked and has a real persisted escalation reference", async () => {
    const row = base();
    row.parameters = { flow_data: { type: "subscription_update_confirm" } };
    row.changeInvoiceId = null;
    const f = databaseFixture(row),
      p = providerFixture();
    expect(publicIntent(row)).toMatchObject({ url: null, recovery: "legacy" });
    await expect(
      manageBillingRecovery(f.database, identity, command(row)),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    const result = await manageBillingRecovery(
      f.database,
      identity,
      command(row, "escalate"),
    );
    expect(result.state).toBe("complete");
    expect(f.receipts.size).toBe(1);
    expect(row.state).toBe("ready");
    expect(p.writes).toHaveLength(0);
  });
  it("revoked membership, old auth, stale revision and changed request payload fail before provider writes", async () => {
    const row = base(),
      f = databaseFixture(row),
      p = providerFixture(),
      c = command(row, "observe");
    mocks.recent = false;
    await expect(
      manageBillingRecovery(f.database, identity, c),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.recent = true;
    f.access.allowed = false;
    await expect(
      manageBillingRecovery(f.database, identity, c),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    f.access.allowed = true;
    await expect(
      manageBillingRecovery(f.database, identity, {
        ...c,
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await manageBillingRecovery(f.database, identity, c);
    await expect(
      manageBillingRecovery(f.database, identity, {
        ...c,
        operation: "escalate",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(p.writes).toHaveLength(0);
  });
  it("does not replay an uncertain plan-update POST or create a legacy money portal", async () => {
    const row = base();
    row.state = "reconciling";
    const f = databaseFixture(row),
      p = providerFixture();
    await executeBillingIntent(f.database, identity, row);
    expect(p.writes).toHaveLength(0);
    row.state = "prepared";
    row.parameters = { flow_data: { type: "subscription_update_confirm" } };
    row.parameterHash = inputHash(row.parameters);
    await expect(
      executeBillingIntent(f.database, identity, row),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(p.writes).toHaveLength(0);
  });
  it("executes only the accepted frozen update through Stripe23 and refuses changed invoice money before the update", async () => {
    const row = base();
    row.state = "prepared";
    row.firstAttemptAt = null;
    row.changeInvoiceId = null;
    row.expiresAt = new Date(Date.now() + 600000);
    row.hostedUrl = null;
    const sub = {
      id: "sub_Synthetic",
      object: "subscription",
      customer: "cus_Synthetic",
      livemode: false,
      metadata,
      status: "active",
      collection_method: "charge_automatically",
      trial_end: null,
      schedule: null,
      pending_update: null,
      pause_collection: null,
      cancel_at_period_end: false,
      automatic_tax: { enabled: true },
      currency: "eur",
      discounts: [],
      latest_invoice: "in_Previous",
      default_payment_method: "pm_Synthetic",
      default_source: null,
      items: {
        has_more: false,
        data: [
          {
            id: "si_Synthetic",
            price: { id: "price_Old" },
            quantity: 1,
            current_period_start: 1899000000,
            current_period_end: 1901000000,
          },
        ],
      },
    };
    const invoice = {
      id: "in_Synthetic",
      object: "invoice",
      customer: "cus_Synthetic",
      livemode: false,
      currency: "eur",
      billing_reason: "subscription_update",
      collection_method: "charge_automatically",
      status: "open",
      hosted_invoice_url: "https://invoice.stripe.com/i/synthetic",
      amount_due: 120,
      total: 120,
      subtotal: 100,
      starting_balance: 0,
      total_taxes: [{ amount: 20 }],
      total_discount_amounts: [],
      automatic_tax: { status: "complete" },
      lines: { has_more: false, data: [] },
      parent: { subscription_details: { subscription: "sub_Synthetic" } },
    };
    row.result = {
      ...invoiceReview(invoice as unknown as Stripe.Invoice),
      prorationDate: 1900000000,
      previousPrice: "price_Old",
      subscriptionHash: subscriptionReview(
        sub as unknown as Stripe.Subscription,
      ),
      reviewHash: "a".repeat(64),
    };
    const f = databaseFixture(row),
      writes: { path: string; form: URLSearchParams; key: string | null }[] =
        [];
    let changed = true;
    mocks.provider = new Stripe("SYNTHETIC-LOCAL-ONLY", {
      apiVersion: "2026-09-30.endive",
      maxNetworkRetries: 0,
      httpClient: Stripe.createFetchHttpClient(async (input, init) => {
        const url = new URL(String(input)),
          post = init?.method === "POST";
        if (post)
          writes.push({
            path: url.pathname,
            form: new URLSearchParams(String(init?.body)),
            key: new Headers(init?.headers).get("Idempotency-Key"),
          });
        let value: unknown;
        if (url.pathname === "/v1/invoices/create_preview")
          value = { ...invoice, amount_due: changed ? 121 : 120 };
        else if (url.pathname === "/v1/subscriptions/sub_Synthetic")
          value = post
            ? {
                ...sub,
                latest_invoice: invoice,
                pending_update: { expires_at: 1901000000 },
              }
            : sub;
        else if (url.pathname === "/v1/customers/cus_Synthetic")
          value = {
            id: "cus_Synthetic",
            balance: 0,
            invoice_settings: { default_payment_method: "pm_Synthetic" },
            default_source: null,
          };
        else if (url.pathname === "/v1/payment_methods/pm_Synthetic")
          value = {
            id: "pm_Synthetic",
            type: "card",
            customer: "cus_Synthetic",
            livemode: false,
          };
        else if (url.pathname === "/v1/invoices/in_Synthetic") value = invoice;
        else if (url.pathname === "/v1/invoices")
          value = { object: "list", data: [], has_more: false };
        else throw Error("Unexpected synthetic request: " + url.pathname);
        return Response.json(value, {
          headers: { "request-id": "req_Synthetic" },
        });
      }),
    });
    await expect(
      executeBillingIntent(f.database, identity, row),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(writes.filter((x) => x.path.includes("subscriptions"))).toHaveLength(
      0,
    );
    changed = false;
    const result = await executeBillingIntent(f.database, identity, row);
    const update = writes.filter((x) => x.path.includes("subscriptions"));
    expect(update).toHaveLength(1);
    expect(update[0].form.get("payment_behavior")).toBe(
      "pending_if_incomplete",
    );
    expect(update[0].form.get("proration_date")).toBe("1900000000");
    expect(update[0].form.get("items[0][price]")).toBe("price_Target");
    expect(update[0].key).toBe(row.idempotencyKey);
    expect(result.url).toBe("https://invoice.stripe.com/i/synthetic");
    expect(row.changeInvoiceId).toBe("in_Synthetic");
    await executeBillingIntent(f.database, identity, row);
    expect(writes.filter((x) => x.path.includes("subscriptions"))).toHaveLength(
      1,
    );
  });
});
describe("authoritative release and invoice review", () => {
  const facts = {
    legacy: false,
    subscriptionTerminal: false,
    hasPendingUpdate: false,
    targetApplied: false,
    invoiceStatus: "void",
    invoiceMatches: true,
  };
  it("only confirmed void allows replacement; old late payment, pending or foreign evidence cannot release", () => {
    expect(changeResolution(facts)).toBe("expired");
    for (const extra of [
      { legacy: true },
      { invoiceMatches: false },
      { hasPendingUpdate: true },
      { invoiceStatus: "open" },
      { invoiceStatus: "paid" },
    ])
      expect(changeResolution({ ...facts, ...extra })).toBeNull();
    expect(
      changeResolution({
        ...facts,
        invoiceStatus: "paid",
        targetApplied: true,
      }),
    ).toBe("complete");
    expect(
      changeResolution({ ...facts, legacy: true, subscriptionTerminal: true }),
    ).toBe("expired");
  });
  it("requires exact customer/subscription/mode and bounded current command", () => {
    expect(parseBillingRecovery(command(base()))).toBeTruthy();
    expect(
      parseBillingRecovery({ ...command(base()), timerExpired: true }),
    ).toBeNull();
    expect(
      pendingChange({
        payment_behavior: "allow_incomplete",
        proration_behavior: "always_invoice",
      }),
    ).toBe(false);
    expect(
      matchingChangeInvoice(
        { customer: "cus_other" } as Stripe.Invoice,
        "cus_Synthetic",
        "sub_Synthetic",
        false,
      ),
    ).toBe(false);
  });
  it("freezes integer money and line/tax facts independently of preview IDs, refuses unknown tax/pagination", () => {
    const invoice = {
      id: "upcoming_one",
      currency: "eur",
      amount_due: 120,
      total: 120,
      subtotal: 100,
      starting_balance: 0,
      total_taxes: [{ amount: 20 }],
      total_discount_amounts: [],
      automatic_tax: { status: "complete" },
      lines: { has_more: false, data: [] },
    } as unknown as Stripe.Invoice;
    expect(invoiceReview(invoice)).toEqual(
      invoiceReview({ ...invoice, id: "upcoming_two" }),
    );
    expect(invoiceReview({ ...invoice, amount_due: 121 }).invoiceHash).not.toBe(
      invoiceReview(invoice).invoiceHash,
    );
    expect(() => invoiceReview({ ...invoice, amount_due: 1.2 })).toThrow();
    expect(() =>
      invoiceReview({
        ...invoice,
        lines: { ...invoice.lines, has_more: true },
      }),
    ).toThrow();
  });
});
