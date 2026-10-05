import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import console from "node:console";
import { startLaunchCluster } from "./native-fixture.mjs";
import { createDatabase } from "../../apps/web/src/server/db/database";
import { manageBillingRecovery } from "../../apps/web/src/features/seller-billing/recovery.server";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";

// Actual PostgreSQL/use case/authority/outbox. Only verified session evidence and
// the provider transport are explicit synthetic adapters; no provider credentials.
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
const adapters = vi.hoisted(() => ({
  recent: true,
  provider: null as unknown,
}));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: () => adapters.recent,
}));
vi.mock("../../apps/web/src/features/payments/bindings.server", () => ({
  paymentBindings: () => ({
    platformAccount: "acct_CrashSynthetic",
    livemode: false,
    environment: "test",
    applicationId: "billing-crash-synthetic",
  }),
  verifiedStripe: () => adapters.provider,
}));

let native: Awaited<ReturnType<typeof startLaunchCluster>>;
let database: ReturnType<typeof createDatabase>;
const catalogue = randomUUID();
beforeAll(async () => {
  vi.stubGlobal("fetch", () => {
    throw Error("Real provider transport forbidden");
  });
  native = await startLaunchCluster();
  database = createDatabase(native.runtime);
  await native.admin.query(
    `INSERT INTO treido.billing_catalogue(id,plan_id,version,seller_kind,platform_account,livemode,environment,application_id,product_id,price_id,amount_minor,currency,terms,limits,terms_version,tax_policy,change_configuration,portal_configuration,approved_at)
     VALUES($1,'business_pro',1,'business','acct_CrashSynthetic',false,'test','billing-crash-synthetic','prod_CrashSynthetic','price_CrashSynthetic',2499,'EUR','{"bg":"Synthetic","en":"Synthetic"}','{}','synthetic','automatic','bpc_CrashSynthetic','bpc_CrashSynthetic',clock_timestamp())`,
    [catalogue],
  );
  console.log("Owned native billing crash fixture:", native.state.directory);
}, 90000);
afterAll(async () => {
  try {
    await native?.stop();
  } finally {
    vi.unstubAllGlobals();
  }
  // Match the fixture's finite 60s pg_ctl shutdown plus its 12s query bound
  // and pool-drain margin. A measured Windows checkpoint took 11.1s.
}, 75000);
beforeEach(() => {
  adapters.recent = true;
});

async function fixture(
  state: "creating" | "reconciling" | "complete" | null = "creating",
) {
  const actor = randomUUID(),
    seller = randomUUID(),
    customer = randomUUID(),
    preview = randomUUID(),
    intent = randomUUID(),
    receipt = randomUUID();
  const suffix = intent.replaceAll("-", "");
  const identity = { subject: "user_CrashSynthetic" + suffix };
  const invoiceId = "in_Crash" + suffix,
    subscriptionId = "sub_Crash" + suffix,
    customerId = "cus_Crash" + suffix;
  const parameters = {
    payment_behavior: "pending_if_incomplete",
    proration_behavior: "always_invoice",
  };
  await native.admin.query(
    "INSERT INTO treido.users(id,clerk_subject) VALUES($1,$2)",
    [actor, identity.subject],
  );
  await native.admin.query(
    "INSERT INTO treido.seller_accounts(id,kind,name,created_by) VALUES($1,'business','Synthetic crash fixture',$2)",
    [seller, actor],
  );
  await native.admin.query(
    "INSERT INTO treido.seller_memberships(seller_id,user_id,role) VALUES($1,$2,'owner')",
    [seller, actor],
  );
  await native.admin.query(
    "INSERT INTO treido.seller_usage(seller_id,plan_id) VALUES($1,'business_free')",
    [seller],
  );
  await native.admin.query(
    "INSERT INTO treido.billing_customers(id,seller_id,platform_account,livemode,environment,application_id,provider_id,approved_at) VALUES($1,$2,'acct_CrashSynthetic',false,'test','billing-crash-synthetic',$3,clock_timestamp())",
    [customer, seller, customerId],
  );
  await native.admin.query(
    `INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,subscription_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,expires_at,state)
    VALUES($1,$2,$3,$4,repeat('a',64),'preview',$5,$6,$7,'price_CrashSynthetic','{}',repeat('b',64),$8,'2026-09-30.endive',clock_timestamp()+interval '1 hour','complete')`,
    [
      preview,
      seller,
      actor,
      randomUUID(),
      catalogue,
      customer,
      subscriptionId,
      "synthetic-preview:" + preview,
    ],
  );
  await native.admin.query(
    `INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,subscription_id,preview_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,created_at,expires_at,state,first_attempt_at,change_invoice_id)
    VALUES($1,$2,$3,$4,repeat('a',64),'change',$5,$6,$7,$8,'price_CrashSynthetic',$9,$10,$11,'2026-09-30.endive',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour','ready',clock_timestamp()-interval '2 hours',$12)`,
    [
      intent,
      seller,
      actor,
      randomUUID(),
      catalogue,
      customer,
      subscriptionId,
      preview,
      parameters,
      inputHash(parameters),
      "synthetic-change:" + intent,
      invoiceId,
    ],
  );
  const command = {
    sellerId: seller,
    actorKey: libraryActorKey(identity),
    intentId: intent,
    requestId: randomUUID(),
    expectedRevision: 0,
    operation: "abandon" as const,
  };
  if (state)
    await native.admin.query(
      `INSERT INTO treido.billing_recovery_requests(id,intent_id,seller_id,actor_id,request_id,input_hash,operation,expected_revision,invoice_id,idempotency_key,state,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,'abandon',0,$7,$8,$9,clock_timestamp()-interval '3 minutes')`,
      [
        receipt,
        intent,
        seller,
        actor,
        command.requestId,
        inputHash(command),
        invoiceId,
        "seller-billing-recovery:" + receipt,
        state,
      ],
    );
  const read = async () =>
    (
      await native.admin.query(
        `SELECT r.*,r.updated_at::text AS token FROM treido.billing_recovery_requests r WHERE request_id=$1`,
        [command.requestId],
      )
    ).rows[0];
  const expire = () =>
    native.admin.query(
      "UPDATE treido.billing_recovery_requests SET updated_at=clock_timestamp()-interval '3 minutes' WHERE request_id=$1",
      [command.requestId],
    );
  const snapshot = async () =>
    (
      await native.admin.query(
        "SELECT to_jsonb(i) AS data FROM treido.billing_intents i WHERE id=$1",
        [intent],
      )
    ).rows[0].data;
  const jobs = async () =>
    (
      await native.admin.query(
        "SELECT count(*)::integer AS count FROM treido.outbox_jobs WHERE resource_id=$1",
        [intent],
      )
    ).rows[0].count;
  const run = () => manageBillingRecovery(database, identity, command);
  return {
    actor,
    seller,
    customer,
    identity,
    intent,
    receipt,
    invoiceId,
    subscriptionId,
    customerId,
    command,
    read,
    expire,
    snapshot,
    jobs,
    run,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function provider(f: Fixture) {
  const invoice = {
    id: f.invoiceId,
    livemode: false,
    customer: f.customerId,
    currency: "eur",
    billing_reason: "subscription_update",
    collection_method: "charge_automatically",
    status: "open",
    parent: { subscription_details: { subscription: f.subscriptionId } },
  };
  const sub = {
    id: f.subscriptionId,
    livemode: false,
    customer: f.customerId,
    metadata: {
      purpose: "seller_subscription",
      seller_id: f.seller,
      application_id: "billing-crash-synthetic",
      environment: "test",
    },
    latest_invoice: f.invoiceId,
    pending_update: { expires_at: 2000000000 } as object | null,
  };
  const reads: string[] = [],
    writes: { invoice: string; body: unknown; key: string }[] = [];
  const hooks = { read: async () => {}, void: async () => {} };
  const stripe = {
    invoices: {
      retrieve: vi.fn(async (id: string) => {
        reads.push(id);
        await hooks.read();
        return { ...invoice };
      }),
      voidInvoice: vi.fn(
        async (
          id: string,
          body: unknown,
          options: { idempotencyKey: string },
        ) => {
          writes.push({ invoice: id, body, key: options.idempotencyKey });
          await hooks.void();
          invoice.status = "void";
          sub.pending_update = null;
          return { ...invoice };
        },
      ),
      pay: vi.fn(() => {
        throw Error("pay forbidden");
      }),
      create: vi.fn(() => {
        throw Error("create forbidden");
      }),
    },
    subscriptions: {
      retrieve: vi.fn(async (id: string) => {
        reads.push(id);
        return { ...sub };
      }),
      update: vi.fn(() => {
        throw Error("update forbidden");
      }),
    },
    billingPortal: {
      sessions: {
        create: vi.fn(() => {
          throw Error("portal forbidden");
        }),
      },
    },
  };
  adapters.provider = stripe;
  const onlyCancellation = () => {
    expect(stripe.invoices.pay).not.toHaveBeenCalled();
    expect(stripe.invoices.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    expect(
      writes.every(
        (w) =>
          w.invoice === f.invoiceId &&
          w.key === "seller-billing-recovery:" + f.receipt &&
          JSON.stringify(w.body) === "{}",
      ),
    ).toBe(true);
  };
  return { invoice, sub, reads, writes, hooks, onlyCancellation };
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

describe("T73 manageBillingRecovery crash recovery on native PostgreSQL", () => {
  it("reclaims a crash-like old creating receipt without changing any original identity or pending money", async () => {
    const f = await fixture(),
      p = provider(f),
      before = await f.read(),
      intent = await f.snapshot();
    const result = await f.run(),
      after = await f.read();
    expect(result).toMatchObject({
      receiptId: f.receipt,
      state: "reconciling",
    });
    const {
      token: beforeToken,
      updated_at: beforeDate,
      state: beforeState,
      ...frozen
    } = before;
    expect(after).toMatchObject(frozen);
    expect(after.token).not.toBe(beforeToken);
    expect(beforeDate).toBeInstanceOf(Date);
    expect(beforeState).toBe("creating");
    expect(p.writes).toHaveLength(1);
    expect(await f.snapshot()).toEqual(intent);
    expect(await f.jobs()).toBe(1);
    // A new request is still blocked by the original pending recovery, even after timeout.
    await expect(
      manageBillingRecovery(database, f.identity, {
        ...f.command,
        requestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    p.onlyCancellation();
  });
  it("serializes concurrent stale retries into one exact current claim and one POST", async () => {
    const f = await fixture(),
      p = provider(f),
      g = gate();
    p.hooks.read = g.hold;
    const first = f.run();
    try {
      await g.ready;
      const claimed = await f.read();
      const repeats = await Promise.all([f.run(), f.run(), f.run()]);
      expect(repeats.map((r) => r.state)).toEqual([
        "creating",
        "creating",
        "creating",
      ]);
      expect((await f.read()).token).toBe(claimed.token);
      expect(p.reads).toEqual([f.invoiceId]);
      expect(p.writes).toHaveLength(0);
    } finally {
      g.release();
    }
    expect((await first).state).toBe("reconciling");
    expect(p.writes).toHaveLength(1);
    p.onlyCancellation();
  });
  it("a premature creating replay does no provider I/O or enqueue", async () => {
    const f = await fixture(),
      p = provider(f);
    await native.admin.query(
      "UPDATE treido.billing_recovery_requests SET updated_at=clock_timestamp() WHERE id=$1",
      [f.receipt],
    );
    const before = await f.read();
    expect((await f.run()).state).toBe("creating");
    expect(await f.read()).toEqual(before);
    expect(p.reads).toHaveLength(0);
    expect(p.writes).toHaveLength(0);
    expect(await f.jobs()).toBe(0);
  });
  it("does not revive a terminal receipt or retry a terminal intent", async () => {
    const f = await fixture("complete"),
      p = provider(f),
      before = await f.read();
    expect((await f.run()).state).toBe("complete");
    expect(await f.read()).toEqual(before);
    const other = await fixture();
    await native.admin.query(
      "UPDATE treido.billing_intents SET state='complete' WHERE id=$1",
      [other.intent],
    );
    expect((await other.run()).state).toBe("creating");
    expect(p.reads).toHaveLength(0);
    expect(await other.jobs()).toBe(0);
  });
  it("late reads from an expired attempt cannot POST or acknowledge a replacement claim", async () => {
    const f = await fixture(),
      p = provider(f),
      oldGate = gate(),
      newGate = gate();
    let reads = 0;
    p.hooks.read = () => (++reads === 1 ? oldGate.hold() : newGate.hold());
    const old = f.run();
    let replacement: ReturnType<typeof f.run> | undefined;
    try {
      await oldGate.ready;
      const oldToken = (await f.read()).token;
      await f.expire();
      replacement = f.run();
      await newGate.ready;
      const current = await f.read();
      expect(current.token).not.toBe(oldToken);
      oldGate.release();
      expect((await old).state).toBe("creating");
      expect(await f.read()).toEqual(current);
      expect(p.writes).toHaveLength(0);
      expect(await f.jobs()).toBe(0);
    } finally {
      oldGate.release();
      newGate.release();
    }
    expect((await replacement!).state).toBe("reconciling");
    expect(p.writes).toHaveLength(1);
    p.onlyCancellation();
  });
  it("a lost old void response cannot overwrite a new active claim or enqueue it", async () => {
    const f = await fixture(),
      p = provider(f),
      oldGate = gate(),
      newGate = gate();
    p.hooks.void = oldGate.hold;
    const old = f.run();
    let replacement: ReturnType<typeof f.run> | undefined;
    try {
      await oldGate.ready;
      await f.expire();
      p.hooks.read = newGate.hold;
      replacement = f.run();
      await newGate.ready;
      const current = await f.read();
      oldGate.release();
      expect((await old).state).toBe("creating");
      expect(await f.read()).toEqual(current);
      expect(await f.jobs()).toBe(0);
    } finally {
      oldGate.release();
      newGate.release();
    }
    expect((await replacement!).state).toBe("reconciling");
    // The original invoice was already voided; the replacement re-reads it.
    expect(p.writes).toHaveLength(1);
    p.onlyCancellation();
  });
  it("a late attempt returns authoritative completion without resurrecting it", async () => {
    const f = await fixture(),
      p = provider(f),
      g = gate();
    p.hooks.void = g.hold;
    const attempt = f.run();
    try {
      await g.ready;
      await native.admin.query(
        "UPDATE treido.billing_intents SET state='complete' WHERE id=$1",
        [f.intent],
      );
      await native.admin.query(
        "UPDATE treido.billing_recovery_requests SET state='complete',updated_at=clock_timestamp() WHERE id=$1",
        [f.receipt],
      );
    } finally {
      g.release();
    }
    expect(await attempt).toMatchObject({
      state: "complete",
      intent: { state: "complete" },
    });
    expect((await f.read()).state).toBe("complete");
    expect(await f.jobs()).toBe(0);
  });
  it("revoked membership during external reads prevents void; every deliberate replay reauthorizes", async () => {
    const f = await fixture(),
      p = provider(f);
    p.hooks.read = async () => {
      await native.admin.query(
        "UPDATE treido.seller_memberships SET status='revoked' WHERE seller_id=$1 AND user_id=$2",
        [f.seller, f.actor],
      );
    };
    expect((await f.run()).state).toBe("reconciling");
    expect(p.writes).toHaveLength(0);
    const before = await f.read();
    await expect(f.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await f.read()).toEqual(before);
  });
  it("expired verified recent auth during reads prevents POST and a deliberate retry", async () => {
    const f = await fixture(),
      p = provider(f);
    p.hooks.read = async () => {
      adapters.recent = false;
    };
    await f.run();
    expect(p.writes).toHaveLength(0);
    await expect(f.run()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("a revoked customer binding during reads prevents void", async () => {
    const f = await fixture(),
      p = provider(f);
    p.hooks.read = async () => {
      await native.admin.query(
        "UPDATE treido.billing_customers SET revoked_at=clock_timestamp() WHERE id=$1",
        [f.customer],
      );
    };
    await f.run();
    expect(p.writes).toHaveLength(0);
  });
  it("an uncertain void retries only the identical original invoice/body/key", async () => {
    const f = await fixture(),
      p = provider(f),
      before = await f.snapshot();
    p.hooks.void = async () => {
      throw Error("Synthetic lost acknowledgement before observed effect");
    };
    await f.run();
    await f.run();
    expect(p.writes).toHaveLength(2);
    expect(p.writes[1]).toEqual(p.writes[0]);
    expect(p.reads).toEqual([
      f.invoiceId,
      f.subscriptionId,
      f.invoiceId,
      f.subscriptionId,
    ]);
    expect(await f.snapshot()).toEqual(before);
    p.onlyCancellation();
  });
  it("lost response after successful void re-reads the original and sends no second POST", async () => {
    const f = await fixture(),
      p = provider(f),
      before = await f.snapshot();
    p.hooks.void = async () => {
      p.invoice.status = "void";
      p.sub.pending_update = null;
      throw Error("Synthetic accepted void with lost response");
    };
    await f.run();
    await f.run();
    expect(p.writes).toHaveLength(1);
    expect(p.reads).toHaveLength(4);
    expect(await f.snapshot()).toEqual(before);
    expect((await f.read()).state).toBe("reconciling");
    p.onlyCancellation();
  });
  it.each([
    "paid",
    "foreign-invoice",
    "other-pending-invoice",
    "no-pending-update",
  ])(
    "refuses %s provider evidence even beyond the provider-key retention window",
    async (reason) => {
      const f = await fixture(),
        p = provider(f),
        before = await f.snapshot();
      await native.admin.query(
        "UPDATE treido.billing_recovery_requests SET updated_at=clock_timestamp()-interval '2 days' WHERE id=$1",
        [f.receipt],
      );
      if (reason === "paid") p.invoice.status = "paid";
      if (reason === "foreign-invoice") p.invoice.id = "in_Foreign";
      if (reason === "other-pending-invoice") p.sub.latest_invoice = "in_Other";
      if (reason === "no-pending-update") p.sub.pending_update = null;
      await f.run();
      expect(p.writes).toHaveLength(0);
      expect(await f.snapshot()).toEqual(before);
      p.onlyCancellation();
    },
  );
  it("native timestamp tokens reject a JS-Date-collapsed generation without changing the pending receipt", async () => {
    const f = await fixture();
    await native.admin.query(
      "UPDATE treido.billing_recovery_requests SET updated_at=date_trunc('milliseconds',clock_timestamp())+interval '123 microseconds' WHERE id=$1",
      [f.receipt],
    );
    const first = await f.read();
    await native.admin.query(
      "UPDATE treido.billing_recovery_requests SET updated_at=updated_at+interval '1 microsecond' WHERE id=$1",
      [f.receipt],
    );
    const second = await f.read();
    expect(first.updated_at.getTime()).toBe(second.updated_at.getTime());
    expect(first.token).not.toBe(second.token);
    const stale = await native.runtime.query(
      "UPDATE treido.billing_recovery_requests SET state='reconciling' WHERE id=$1 AND state='creating' AND updated_at::text=$2 RETURNING id",
      [f.receipt, first.token],
    );
    expect(stale.rowCount).toBe(0);
    expect(await f.read()).toEqual(second);
  });
  it("claims a new deliberate receipt and returns a truthful acknowledgement", async () => {
    const f = await fixture(null),
      p = provider(f),
      before = await f.snapshot();
    const result = await f.run();
    expect(result.state).toBe("reconciling");
    expect((await f.read()).token).toEqual(expect.any(String));
    expect(p.writes).toEqual([
      {
        invoice: f.invoiceId,
        body: {},
        key: "seller-billing-recovery:" + result.receiptId,
      },
    ]);
    expect(await f.snapshot()).toEqual(before);
  });
});
