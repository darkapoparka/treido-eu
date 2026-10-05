import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { manageBillingRecovery } from "../../apps/web/src/features/seller-billing/recovery.server";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import type { SellerDatabase } from "../../apps/web/src/server/db/database";
import type { BillingIntent } from "../../apps/web/src/features/seller-billing/commands.server";

vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
const adapters = vi.hoisted(() => ({
  recent: true,
  provider: null as unknown,
  transaction: vi.fn(),
  enqueue: vi.fn(),
}));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: () => adapters.recent,
}));
vi.mock("../../apps/web/src/server/db/database", () => ({
  inTransaction: (...args: unknown[]) => adapters.transaction(...args),
}));
vi.mock("../../apps/web/src/server/jobs/outbox.server", () => ({
  enqueueJob: (...args: unknown[]) => adapters.enqueue(...args),
}));
vi.mock("../../apps/web/src/features/catalog/public-discovery.server", () => ({
  publicDiscoveryKey: () => Buffer.from("a".repeat(64), "hex"),
}));
vi.mock("../../apps/web/src/features/payments/bindings.server", () => ({
  paymentBindings: () => ({
    platformAccount: "acct_Crash",
    livemode: false,
    environment: "test",
    applicationId: "crash-synthetic",
  }),
  verifiedStripe: () => adapters.provider,
}));
beforeEach(() => {
  adapters.recent = true;
  adapters.enqueue.mockReset();
});
type Receipt = {
  id: string;
  intentId: string;
  inputHash: string;
  operation: string;
  invoiceId: string | null;
  idempotencyKey: string;
  state: string;
  at: bigint;
};
function fixture(state = "creating") {
  const seller = randomUUID(),
    actor = randomUUID(),
    customer = randomUUID();
  const identity = { subject: "user_CrashSynthetic" };
  const row: BillingIntent = {
    id: randomUUID(),
    sellerId: seller,
    actorId: actor,
    requestId: randomUUID(),
    inputHash: "a".repeat(64),
    operation: "change",
    catalogueId: randomUUID(),
    customerBindingId: customer,
    subscriptionId: "sub_Crash",
    parameters: {
      payment_behavior: "pending_if_incomplete",
      proration_behavior: "always_invoice",
    },
    expectedPriceId: "price_Crash",
    parameterHash: "",
    idempotencyKey: "original-change",
    expiresAt: new Date("2020-01-01"),
    state: "ready",
    providerId: "sub_Crash",
    hostedUrl: null,
    firstAttemptAt: new Date("2020-01-01"),
    revision: 3,
    changeInvoiceId: "in_Crash",
    result: null,
  };
  row.parameterHash = inputHash(row.parameters);
  const command = {
    sellerId: seller,
    actorKey: libraryActorKey(identity),
    intentId: row.id,
    requestId: randomUUID(),
    expectedRevision: 3,
    operation: "abandon" as const,
  };
  // Transaction adapter models serialized database locks and a microsecond clock.
  // The separate native suite verifies the actual SQL/types/constraints.
  let now = 1_000_000_000n,
    serial = Promise.resolve();
  const receipt: Receipt = {
    id: randomUUID(),
    intentId: row.id,
    inputHash: inputHash(command),
    operation: "abandon",
    invoiceId: "in_Crash",
    idempotencyKey: "original-void-key",
    state,
    at: now - 180_000_000n,
  };
  const access = { active: true, approved: true };
  const expired = () => receipt.at <= now - 120_000_000n;
  const projected = () => ({
    ...receipt,
    claimToken: String(receipt.at),
    claimExpired: expired(),
  });
  const result = (rows: unknown[]) => ({ rows, rowCount: rows.length });
  const query = async (sql: string, values: unknown[] = []) => {
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
          status: access.active ? "active" : "revoked",
          grants: [],
        },
      ]);
    if (sql.includes("FROM treido.seller_usage"))
      return result([{ seller_id: seller }]);
    if (sql.includes("to_regclass")) return result([{ ready: true }]);
    if (sql.includes("lock_billing_registry")) {
      if (!access.approved) throw Error("Synthetic revoked customer");
      return result([{}]);
    }
    if (sql.includes("FROM treido.billing_customers"))
      return result(
        access.approved ? [{ id: customer, providerId: "cus_Crash" }] : [],
      );
    if (sql.startsWith("SELECT r.id")) {
      const active =
        values[0] === receipt.id &&
        values[1] === row.id &&
        values[2] === seller &&
        values[3] === receipt.invoiceId &&
        values[4] === String(receipt.at) &&
        values[5] === receipt.inputHash &&
        values[6] === receipt.idempotencyKey &&
        values[7] === row.subscriptionId &&
        values[8] === customer &&
        values[9] === row.parameterHash &&
        receipt.state === "creating" &&
        !expired() &&
        row.operation === "change" &&
        row.changeInvoiceId === receipt.invoiceId &&
        ["creating", "ready", "reconciling"].includes(row.state);
      return result(active ? [{ id: receipt.id }] : []);
    }
    if (sql.startsWith("UPDATE treido.billing_recovery_requests")) {
      const claiming = sql.includes("SET state='creating'");
      const eligible = claiming
        ? receipt.state === "reconciling" ||
          (receipt.state === "creating" && expired())
        : receipt.state === "creating" && !expired();
      if (
        values[0] !== receipt.id ||
        values[1] !== String(receipt.at) ||
        !eligible
      )
        return result([]);
      receipt.state = claiming ? "creating" : "reconciling";
      receipt.at = ++now;
      return result([{ id: receipt.id }]);
    }
    if (sql.includes("FROM treido.billing_recovery_requests"))
      return result(values[2] === command.requestId ? [projected()] : []);
    if (sql.includes("FROM treido.billing_intents"))
      return result([{ ...row }]);
    throw Error("Unexpected synthetic SQL: " + sql);
  };
  adapters.transaction.mockImplementation((_db, work) => {
    const operation = serial.then(() => work({ client: { query } }));
    serial = operation.then(
      () => {},
      () => {},
    );
    return operation;
  });
  const invoice = {
    id: "in_Crash",
    status: "open",
    customer: "cus_Crash",
    currency: "eur",
    livemode: false,
    billing_reason: "subscription_update",
    collection_method: "charge_automatically",
    parent: { subscription_details: { subscription: "sub_Crash" } },
  };
  const sub = {
    id: "sub_Crash",
    customer: "cus_Crash",
    livemode: false,
    metadata: {
      purpose: "seller_subscription",
      seller_id: seller,
      application_id: "crash-synthetic",
      environment: "test",
    },
    latest_invoice: "in_Crash",
    pending_update: {} as object | null,
  };
  const reads: string[] = [],
    writes: unknown[] = [];
  const hooks = { read: async () => {}, void: async () => {} };
  adapters.provider = {
    invoices: {
      retrieve: async (id: string) => {
        reads.push(id);
        await hooks.read();
        return { ...invoice };
      },
      voidInvoice: async (...args: unknown[]) => {
        writes.push(args);
        await hooks.void();
        invoice.status = "void";
        sub.pending_update = null;
      },
    },
    subscriptions: {
      retrieve: async (id: string) => {
        reads.push(id);
        return { ...sub };
      },
    },
  };
  return {
    receipt,
    row,
    command,
    access,
    invoice,
    sub,
    hooks,
    reads,
    writes,
    run: () => manageBillingRecovery({} as SellerDatabase, identity, command),
    expire: () => {
      now += 121_000_000n;
    },
    fresh: () => {
      receipt.at = ++now;
    },
    token: () => projected().claimToken,
  };
}
function gate() {
  let release!: () => void, entered!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  return {
    ready,
    release,
    hold: async () => {
      entered();
      await wait;
    },
  };
}
describe("T73 actual recovery use case with explicit clock/transaction/provider adapters", () => {
  it("reclaims an old creating receipt with its original request/hash/invoice/key and never releases money", async () => {
    const f = fixture(),
      before = { ...f.receipt },
      row = { ...f.row };
    expect(await f.run()).toMatchObject({
      receiptId: before.id,
      state: "reconciling",
    });
    expect(f.receipt).toMatchObject({
      ...before,
      state: "reconciling",
      at: f.receipt.at,
    });
    expect(f.receipt.at).toBeGreaterThan(before.at);
    expect(f.writes).toEqual([
      ["in_Crash", {}, { idempotencyKey: before.idempotencyKey }],
    ]);
    expect(f.row).toEqual(row);
    expect(adapters.enqueue).toHaveBeenCalledTimes(1);
  });
  it("concurrent retries share one claim; premature replay performs no I/O", async () => {
    const f = fixture(),
      g = gate();
    f.hooks.read = g.hold;
    const first = f.run();
    try {
      await g.ready;
      const token = f.token();
      const repeats = await Promise.all([f.run(), f.run()]);
      expect(repeats.map((r) => r.state)).toEqual(["creating", "creating"]);
      expect(f.token()).toBe(token);
      expect(f.reads).toEqual(["in_Crash"]);
    } finally {
      g.release();
    }
    expect((await first).state).toBe("reconciling");
    expect(f.writes).toHaveLength(1);
  });
  it.each(["creating", "complete"])(
    "replays %s without I/O when no claim is available",
    async (state) => {
      const f = fixture(state);
      f.fresh();
      const before = { ...f.receipt };
      expect((await f.run()).state).toBe(state);
      expect(f.receipt).toEqual(before);
      expect(f.reads).toHaveLength(0);
      expect(f.writes).toHaveLength(0);
      expect(adapters.enqueue).not.toHaveBeenCalled();
    },
  );
  it("old delayed reads cannot void, acknowledge or enqueue a replacement attempt", async () => {
    const f = fixture(),
      oldGate = gate(),
      newGate = gate();
    let count = 0;
    f.hooks.read = () => (++count === 1 ? oldGate.hold() : newGate.hold());
    const old = f.run();
    let replacement: ReturnType<typeof f.run> | undefined;
    try {
      await oldGate.ready;
      const oldToken = f.token();
      f.expire();
      replacement = f.run();
      await newGate.ready;
      const newToken = f.token();
      expect(newToken).not.toBe(oldToken);
      oldGate.release();
      expect((await old).state).toBe("creating");
      expect(f.token()).toBe(newToken);
      expect(f.writes).toHaveLength(0);
      expect(adapters.enqueue).not.toHaveBeenCalled();
    } finally {
      oldGate.release();
      newGate.release();
    }
    expect((await replacement!).state).toBe("reconciling");
    expect(f.writes).toHaveLength(1);
  });
  it("old delayed POST completion cannot acknowledge or enqueue the current claim", async () => {
    const f = fixture(),
      oldGate = gate(),
      newGate = gate();
    f.hooks.void = oldGate.hold;
    const old = f.run();
    let replacement: ReturnType<typeof f.run> | undefined;
    try {
      await oldGate.ready;
      f.expire();
      f.hooks.read = newGate.hold;
      replacement = f.run();
      await newGate.ready;
      const newToken = f.token();
      oldGate.release();
      expect((await old).state).toBe("creating");
      expect(f.token()).toBe(newToken);
      expect(adapters.enqueue).not.toHaveBeenCalled();
    } finally {
      oldGate.release();
      newGate.release();
    }
    expect((await replacement!).state).toBe("reconciling");
    expect(f.writes).toHaveLength(1);
  });
  it("completion during a void is returned truthfully and cannot resurrect or enqueue", async () => {
    const f = fixture();
    f.hooks.void = async () => {
      f.receipt.state = "complete";
      f.fresh();
      f.row.state = "complete";
    };
    expect(await f.run()).toMatchObject({
      state: "complete",
      intent: { state: "complete" },
    });
    expect(adapters.enqueue).not.toHaveBeenCalled();
  });
  it("an expired current attempt without replacement cannot POST or acknowledge", async () => {
    const f = fixture();
    f.hooks.read = async () => {
      f.expire();
    };
    expect((await f.run()).state).toBe("creating");
    expect(f.writes).toHaveLength(0);
    expect(adapters.enqueue).not.toHaveBeenCalled();
  });
  it.each(["membership", "recent-auth", "customer"])(
    "rechecks revoked %s after provider reads and on retry",
    async (reason) => {
      const f = fixture();
      f.hooks.read = async () => {
        if (reason === "membership") f.access.active = false;
        if (reason === "recent-auth") adapters.recent = false;
        if (reason === "customer") f.access.approved = false;
      };
      await f.run();
      expect(f.writes).toHaveLength(0);
      if (reason !== "customer")
        await expect(f.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    },
  );
  it("lost void acknowledgement permits only same-invoice/body/key retry and keeps money pending", async () => {
    const f = fixture(),
      before = { ...f.row };
    f.hooks.void = async () => {
      throw Error("Synthetic lost result");
    };
    await f.run();
    await f.run();
    expect(f.writes).toHaveLength(2);
    expect(f.writes[1]).toEqual(f.writes[0]);
    expect(f.writes[0]).toEqual([
      "in_Crash",
      {},
      { idempotencyKey: "original-void-key" },
    ]);
    expect(f.reads).toEqual(["in_Crash", "sub_Crash", "in_Crash", "sub_Crash"]);
    expect(f.row).toEqual(before);
  });
  it("lost response after successful void re-reads original immutable state without another POST", async () => {
    const f = fixture();
    f.hooks.void = async () => {
      f.invoice.status = "void";
      f.sub.pending_update = null;
      throw Error("Lost response after effect");
    };
    await f.run();
    await f.run();
    expect(f.writes).toHaveLength(1);
    expect(f.reads).toHaveLength(4);
    expect(f.row.state).toBe("ready");
  });
  it.each([
    "paid",
    "foreign-invoice",
    "foreign-pending",
    "missing-pending",
    "terminal-intent",
  ])("cannot void %s even for an expired claim", async (reason) => {
    const f = fixture();
    if (reason === "paid") f.invoice.status = "paid";
    if (reason === "foreign-invoice") f.invoice.id = "in_Foreign";
    if (reason === "foreign-pending") f.sub.latest_invoice = "in_Other";
    if (reason === "missing-pending") f.sub.pending_update = null;
    if (reason === "terminal-intent") f.row.state = "complete";
    await f.run();
    expect(f.writes).toHaveLength(0);
  });
  it("rejects changed immutable command input before reclaiming or reading", async () => {
    const f = fixture(),
      before = { ...f.receipt };
    f.command.expectedRevision++;
    await expect(f.run()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.receipt).toEqual(before);
    expect(f.reads).toHaveLength(0);
  });
});
