import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
import type { Client } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { SellerDatabase } from "../../server/db/database";
import { assertFixtureHeadroom } from "../../../../../tests/t72/native-fixture-support.mjs";

vi.mock("server-only", () => ({}));
const harness = vi.hoisted(() => ({
  query: vi.fn(),
  enqueue: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (_database: unknown, work: (tx: unknown) => unknown) => {
    await harness.query("BEGIN");
    try {
      const value = await work({ client: { query: harness.query } });
      await harness.query("COMMIT");
      return value;
    } catch (error) {
      await harness.query("ROLLBACK");
      throw error;
    }
  },
}));
vi.mock("../../server/jobs/outbox.server", () => ({
  enqueueJob: (...args: unknown[]) => harness.enqueue(...args),
}));
vi.mock("../../server/jobs/config.server", () => ({
  requireJobBindings: () => ({ applicationId: "terminal-refund-synthetic" }),
}));
import { terminalFullRefundSql } from "./terminal-refund.server";
import { schedulePaymentRepair } from "./jobs.server";

const ids = {
  buyer: randomUUID(),
  seller: randomUUID(),
  quote: randomUUID(),
  attempt: randomUUID(),
  order: randomUUID(),
  refund: randomUUID(),
  allocation: randomUUID(),
};
const evidence = resolve(
  process.env.TREIDO_DATABASE_EVIDENCE_ROOT ??
    "../.qa/f15-f27-terminal-refund-native",
);
let cluster: EmbeddedPostgres;
let client: Client;
let directory: string;
let pgCtl: string;
let started = false;
const execute = (file: string, args: string[]) =>
  new Promise<void>((done, fail) => {
    const child = spawn(file, args, { stdio: "ignore", windowsHide: true });
    child.once("error", fail);
    child.once("exit", (code) =>
      code === 0
        ? done()
        : fail(new Error(`Owned PostgreSQL control failed: ${code}`)),
    );
  });

beforeAll(async () => {
  if (process.version !== "v24.20.0") throw Error("Pinned Node required");
  assertFixtureHeadroom(evidence);
  await mkdir(evidence, { recursive: true });
  directory = await mkdtemp(join(evidence, "postgres-"));
  const listener = createServer();
  await new Promise<void>((done, fail) => {
    listener.once("error", fail);
    listener.listen(0, "127.0.0.1", done);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw Error("No owned port");
  const port = address.port;
  await new Promise<void>((done) => listener.close(() => done()));
  if ([6412, 6413, 6418, 6419, 6421, 6422].includes(port))
    throw Error("Protected port");
  cluster = new EmbeddedPostgres({
    databaseDir: directory,
    user: "postgres",
    password: randomBytes(24).toString("hex"),
    port,
    persistent: true,
    authMethod: "scram-sha-256",
    onLog: () => undefined,
    onError: () => undefined,
  });
  const fromEmbedded = createRequire(
    createRequire(import.meta.url).resolve("embedded-postgres"),
  );
  pgCtl = (
    fromEmbedded(
      `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`,
    ) as { pg_ctl: string }
  ).pg_ctl;
  await cluster.initialise();
  await execute(pgCtl, [
    "start",
    "-D",
    directory,
    "-l",
    join(evidence, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -c max_connections=10`,
    "-w",
    "-t",
    "30",
  ]);
  started = true;
  client = cluster.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  // Minimal table projections qualify the actual PostgreSQL predicate and
  // scheduler, not the full migration schema or any provider/account facts.
  await client.query(`CREATE SCHEMA treido;
    CREATE TABLE treido.payment_attempts(id uuid PRIMARY KEY,quote_id uuid,seller_id uuid,platform_account text,livemode boolean,state text,provider_id text,parameters jsonb,reconcile_at timestamptz);
    CREATE TABLE treido.payable_quotes(id uuid PRIMARY KEY,buyer_id uuid,seller_id uuid,allocation_id uuid,platform_account text,livemode boolean,currency text,total_minor integer,application_fee_minor integer,terms_snapshot jsonb);
    CREATE TABLE treido.paid_orders(id uuid PRIMARY KEY,quote_id uuid,attempt_id uuid,buyer_id uuid,seller_id uuid,payment_state text,fulfilment_state text,settlement_state text);
    CREATE TABLE treido.payment_refunds(id uuid PRIMARY KEY,order_id uuid,attempt_id uuid,seller_id uuid,state text,provider_id text,parameters jsonb,reconcile_at timestamptz);
    CREATE TABLE treido.inventory_allocations(id uuid PRIMARY KEY,buyer_id uuid,seller_id uuid,state text,resolution_reference text);
    CREATE TABLE treido.payment_facts(attempt_id uuid,platform_account text,livemode boolean,kind text,object_id text,currency text,amount_minor bigint);
    CREATE TABLE treido.outbox_jobs(kind text,resource_id uuid,state text);
    CREATE ROLE terminal_refund_runtime NOLOGIN;
    GRANT USAGE ON SCHEMA treido TO terminal_refund_runtime;
    GRANT SELECT ON ALL TABLES IN SCHEMA treido TO terminal_refund_runtime;
    GRANT UPDATE ON treido.payment_attempts,treido.payment_refunds TO terminal_refund_runtime;`);
  harness.query.mockImplementation((sql: string, values?: unknown[]) =>
    client.query(sql, values),
  );
}, 90000);

beforeEach(async () => {
  await client.query("RESET ROLE");
  await client.query(
    "TRUNCATE treido.payment_attempts,treido.payable_quotes,treido.paid_orders,treido.payment_refunds,treido.inventory_allocations,treido.payment_facts,treido.outbox_jobs",
  );
  await client.query(
    "INSERT INTO treido.payment_attempts VALUES($1,$2,$3,'acct_Synthetic',false,'quarantined','pi_Synthetic',$4,now()-interval '1 minute')",
    [
      ids.attempt,
      ids.quote,
      ids.seller,
      {
        metadata: {
          application_id: "terminal-refund-synthetic",
          environment: "test",
        },
      },
    ],
  );
  await client.query(
    "INSERT INTO treido.payable_quotes VALUES($1,$2,$3,$4,'acct_Synthetic',false,'EUR',1000,0,$5)",
    [
      ids.quote,
      ids.buyer,
      ids.seller,
      ids.allocation,
      { refundPolicy: "full_fee_and_transfer_reversal" },
    ],
  );
  await client.query(
    "INSERT INTO treido.paid_orders VALUES($1,$2,$3,$4,$5,'refunded','blocked','reversed')",
    [ids.order, ids.quote, ids.attempt, ids.buyer, ids.seller],
  );
  await client.query(
    "INSERT INTO treido.payment_refunds VALUES($1,$2,$3,$4,'succeeded','re_Synthetic',$5,now()-interval '1 minute')",
    [
      ids.refund,
      ids.order,
      ids.attempt,
      ids.seller,
      {
        payment_intent: "pi_Synthetic",
        amount: 1000,
        reverse_transfer: true,
        refund_application_fee: false,
        metadata: {
          refund_id: ids.refund,
          attempt_id: ids.attempt,
          application_id: "terminal-refund-synthetic",
          environment: "test",
        },
      },
    ],
  );
  await client.query(
    "INSERT INTO treido.inventory_allocations VALUES($1,$2,$3,'consumed','stripe:pi_Synthetic')",
    [ids.allocation, ids.buyer, ids.seller],
  );
  for (const [kind, object] of [
    ["charge", "ch_Synthetic"],
    ["transfer", "tr_Synthetic"],
    ["refund", "re_Synthetic"],
    ["transfer_reversal", "trr_Synthetic"],
  ])
    await client.query(
      "INSERT INTO treido.payment_facts VALUES($1,'acct_Synthetic',false,$2,$3,'eur',1000)",
      [ids.attempt, kind, object],
    );
  harness.enqueue.mockReset();
});

afterAll(async () => {
  try {
    await client?.end();
  } finally {
    if (started) {
      await execute(pgCtl, [
        "stop",
        "-D",
        directory,
        "-m",
        "fast",
        "-w",
        "-t",
        "30",
      ]);
      await writeFile(
        join(evidence, "result.json"),
        JSON.stringify({
          ownedClusterStopped: true,
          fullSchemaQualification: false,
          providerQualification: false,
        }) + "\n",
      );
    }
  }
}, 40000);

async function terminal() {
  await client.query("SET ROLE terminal_refund_runtime");
  return (
    (
      await client.query<{ terminal: boolean }>(
        `SELECT ${terminalFullRefundSql} AS terminal FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE q.buyer_id=$1 AND q.seller_id=$2`,
        [ids.buyer, ids.seller],
      )
    ).rows[0]?.terminal ?? false
  );
}
async function expectBlocked() {
  expect(await terminal()).toBe(false);
  expect(await schedulePaymentRepair({} as SellerDatabase)).toEqual({
    attempts: 1,
    refunds: 0,
  });
  expect(harness.enqueue).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      kind: "payment.reconcile",
      resourceId: ids.attempt,
    }),
  );
}

describe("native terminal full refund eligibility and repair", () => {
  it("allows the exact zero-fee refund and retires only its repair scheduling", async () => {
    expect(await terminal()).toBe(true);
    expect(await schedulePaymentRepair({} as SellerDatabase)).toEqual({
      attempts: 0,
      refunds: 0,
    });
    expect(harness.enqueue).not.toHaveBeenCalled();
    expect(
      (await client.query("SELECT state FROM treido.payment_attempts")).rows[0]
        .state,
    ).toBe("quarantined");
  });
  it.each([
    "prepared",
    "creating",
    "pending",
    "reconciling",
    "failed",
    "unknown",
  ])("never treats %s as terminal", async (state) => {
    await client.query(
      "UPDATE treido.payment_refunds SET state=$1,reconcile_at=now()+interval '1 hour'",
      [state],
    );
    await expectBlocked();
  });
  it.each(["charge", "transfer", "refund", "transfer_reversal"])(
    "requires the original %s fact",
    async (kind) => {
      await client.query("DELETE FROM treido.payment_facts WHERE kind=$1", [
        kind,
      ]);
      await expectBlocked();
    },
  );
  it.each([
    "UPDATE treido.payment_facts SET amount_minor=999 WHERE kind='refund'",
    "UPDATE treido.payment_facts SET amount_minor=999 WHERE kind='transfer_reversal'",
    "UPDATE treido.payment_facts SET currency='usd' WHERE kind='refund'",
    "UPDATE treido.payment_facts SET livemode=true WHERE kind='refund'",
    "UPDATE treido.payment_facts SET platform_account='acct_Foreign' WHERE kind='transfer_reversal'",
    "UPDATE treido.payment_facts SET object_id='re_Other' WHERE kind='refund'",
    "UPDATE treido.payment_facts SET attempt_id='00000000-0000-4000-8000-000000000001' WHERE kind='refund'",
    "UPDATE treido.paid_orders SET buyer_id='00000000-0000-4000-8000-000000000001'",
    "UPDATE treido.paid_orders SET seller_id='00000000-0000-4000-8000-000000000001'",
    "UPDATE treido.paid_orders SET quote_id='00000000-0000-4000-8000-000000000001'",
    "UPDATE treido.paid_orders SET payment_state='disputed'",
    "UPDATE treido.paid_orders SET settlement_state='reconciliation'",
    "UPDATE treido.inventory_allocations SET state='reconciliation'",
    "UPDATE treido.payment_refunds SET parameters=jsonb_set(parameters,'{metadata,environment}','\"live\"')",
    "UPDATE treido.payment_refunds SET parameters=jsonb_set(parameters,'{amount}','999')",
    "UPDATE treido.payment_refunds SET parameters=parameters-'metadata'",
  ])("keeps inconsistent proof blocking: %s", async (sql) => {
    await client.query(sql);
    await expectBlocked();
  });
  it("requires the applicable application-fee refund before completion", async () => {
    await client.query(
      "UPDATE treido.payable_quotes SET application_fee_minor=30",
    );
    await client.query(
      "UPDATE treido.payment_refunds SET parameters=jsonb_set(parameters,'{refund_application_fee}','true')",
    );
    expect(await terminal()).toBe(false);
    await client.query("RESET ROLE");
    await client.query(
      "INSERT INTO treido.payment_facts VALUES($1,'acct_Synthetic',false,'application_fee','fee_Synthetic','eur',30)",
      [ids.attempt],
    );
    expect(await terminal()).toBe(false);
    await client.query("RESET ROLE");
    await client.query(
      "INSERT INTO treido.payment_facts VALUES($1,'acct_Synthetic',false,'fee_refund','fr_Synthetic','eur',29)",
      [ids.attempt],
    );
    expect(await terminal()).toBe(false);
    await client.query("RESET ROLE");
    await client.query(
      "UPDATE treido.payment_facts SET amount_minor=30 WHERE kind='fee_refund'",
    );
    expect(await terminal()).toBe(true);
    expect(await schedulePaymentRepair({} as SellerDatabase)).toEqual({
      attempts: 0,
      refunds: 0,
    });
  });
  it("does not exempt a disputed terminal-looking refund", async () => {
    await client.query(
      "INSERT INTO treido.payment_facts VALUES($1,'acct_Synthetic',false,'dispute','dp_Synthetic','eur',1000)",
      [ids.attempt],
    );
    await expectBlocked();
  });
  it.each(["paid", "requires_payment_method", "processing", "reconciling"])(
    "preserves %s observation scheduling",
    async (state) => {
      await client.query("UPDATE treido.payment_attempts SET state=$1", [
        state,
      ]);
      await expectBlocked();
    },
  );
});
