import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { startLaunchCluster } from "./native-fixture.mjs";
import {
  createDatabase,
  inTransaction,
} from "../../apps/web/src/server/db/database";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { PLANS } from "../../apps/web/src/features/seller-billing/model";
import { processBillingObservation } from "../../apps/web/src/features/seller-billing/jobs.server";
import type { EffectContext } from "../../apps/web/src/server/jobs/execution.server";

vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
const adapters = vi.hoisted(() => ({ provider: null as unknown }));
vi.mock("../../apps/web/src/features/payments/bindings.server", () => ({
  paymentBindings: () => ({
    platformAccount: "acct_LegacySynthetic",
    livemode: false,
    environment: "test",
    applicationId: "billing-legacy-synthetic",
  }),
  verifiedStripe: () => adapters.provider,
}));
let native: Awaited<ReturnType<typeof startLaunchCluster>>;
let database: ReturnType<typeof createDatabase>;
let catalogueVersion = 0;
beforeAll(async () => {
  vi.stubGlobal("fetch", () => {
    throw Error("External requests forbidden in legacy recovery tests");
  });
  native = await startLaunchCluster({
    evidenceDirectory: resolve("../.qa/launch-commerce-20261005/native"),
  });
  database = createDatabase(native.runtime);
}, 90000);
afterAll(async () => {
  await native?.stop();
  vi.unstubAllGlobals();
});

async function fixture() {
  const actor = randomUUID(),
    seller = randomUUID(),
    customer = randomUUID(),
    catalogue = randomUUID(),
    origin = randomUUID(),
    preview = randomUUID(),
    intent = randomUUID(),
    subscription = randomUUID();
  const suffix = intent.replaceAll("-", ""),
    customerId = "cus_Legacy" + suffix,
    subscriptionId = "sub_Legacy" + suffix,
    priceId = "price_Legacy" + suffix;
  await native.admin.query(
    "INSERT INTO treido.users(id,clerk_subject) VALUES($1,$2)",
    [actor, "user_Legacy" + suffix],
  );
  await native.admin.query(
    "INSERT INTO treido.seller_accounts(id,kind,name,created_by) VALUES($1,'business','Synthetic legacy recovery',$2)",
    [seller, actor],
  );
  await native.admin.query(
    "INSERT INTO treido.seller_usage(seller_id,plan_id) VALUES($1,'business_free')",
    [seller],
  );
  await native.admin.query(
    `INSERT INTO treido.billing_catalogue(id,plan_id,version,seller_kind,platform_account,livemode,environment,application_id,product_id,price_id,amount_minor,currency,terms,limits,terms_version,tax_policy,change_configuration,portal_configuration,approved_at)
     VALUES($1,'business_pro',$5,'business','acct_LegacySynthetic',false,'test','billing-legacy-synthetic',$2,$3,2499,'EUR','{"bg":"Synthetic only","en":"Synthetic only"}',$4,'synthetic','automatic','bpc_LegacySynthetic','bpc_LegacySynthetic',clock_timestamp())`,
    [
      catalogue,
      "prod_Legacy" + suffix,
      priceId,
      PLANS.business_pro.limits,
      ++catalogueVersion,
    ],
  );
  await native.admin.query(
    "INSERT INTO treido.billing_customers(id,seller_id,platform_account,livemode,environment,application_id,provider_id,approved_at) VALUES($1,$2,'acct_LegacySynthetic',false,'test','billing-legacy-synthetic',$3,clock_timestamp())",
    [customer, seller, customerId],
  );
  for (const [id, operation] of [
    [origin, "checkout"],
    [preview, "preview"],
  ])
    await native.admin.query(
      `INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,subscription_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,expires_at,state)
       VALUES($1,$2,$3,$4,repeat('a',64),$5,$6,$7,$8,$9,'{}',$10,$11,'2026-09-30.endive',clock_timestamp()+interval '1 hour','complete')`,
      [
        id,
        seller,
        actor,
        randomUUID(),
        operation,
        catalogue,
        customer,
        subscriptionId,
        priceId,
        inputHash({}),
        "synthetic-legacy:" + id,
      ],
    );
  const parameters = {
    customer: customerId,
    configuration: "bpc_LegacySynthetic",
    flow_data: {
      type: "subscription_update_confirm",
      subscription_update_confirm: { subscription: subscriptionId },
    },
  };
  await native.admin.query(
    `INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,subscription_id,preview_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,created_at,expires_at,state,first_attempt_at)
     VALUES($1,$2,$3,$4,repeat('a',64),'change',$5,$6,$7,$8,$9,$10,$11,$12,'2026-09-30.endive',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour','reconciling',clock_timestamp()-interval '2 hours')`,
    [
      intent,
      seller,
      actor,
      randomUUID(),
      catalogue,
      customer,
      subscriptionId,
      preview,
      priceId,
      parameters,
      inputHash(parameters),
      "synthetic-legacy:" + intent,
    ],
  );
  await native.admin.query(
    "INSERT INTO treido.billing_subscriptions(id,seller_id,customer_binding_id,provider_id,origin_intent_id,catalogue_id,item_id,state) VALUES($1,$2,$3,$4,$5,$6,'si_LegacySynthetic','active')",
    [subscription, seller, customer, subscriptionId, origin, catalogue],
  );
  const calls: string[] = [];
  let status = "active";
  adapters.provider = {
    subscriptions: {
      retrieve: async (id: string) => {
        calls.push("subscription.read:" + id);
        expect(id).toBe(subscriptionId);
        return {
          id,
          customer: customerId,
          livemode: false,
          status,
          metadata: {
            purpose: "seller_subscription",
            seller_id: seller,
            application_id: "billing-legacy-synthetic",
            environment: "test",
            billing_intent_id: origin,
          },
          items: {
            has_more: false,
            data: [
              {
                id: "si_LegacySynthetic",
                quantity: 1,
                price: { id: priceId },
                current_period_end: 2100000000,
              },
            ],
          },
          collection_method: "charge_automatically",
          trial_end: null,
          schedule: null,
          pending_update: null,
          pause_collection: null,
          cancel_at_period_end: false,
        };
      },
      update: async () => {
        throw Error("Unexpected subscription update");
      },
      cancel: async () => {
        throw Error("Unexpected immediate cancellation");
      },
    },
    invoices: {
      list: async () => {
        calls.push("invoice.read");
        return { data: [], has_more: false };
      },
    },
    billingPortal: {
      sessions: {
        create: async () => {
          throw Error("Unexpected replacement portal");
        },
      },
    },
  };
  const job = {
    id: randomUUID(),
    kind: "billing.reconcile",
    sellerId: seller,
    resourceId: intent,
    authority: "service",
    actorId: null,
    generation: 1,
    executionToken: randomUUID(),
  } as EffectContext;
  const prepare = () => processBillingObservation(database, job);
  const apply = async (effect: Awaited<ReturnType<typeof prepare>>) =>
    inTransaction(database, async (tx) => {
      await effect.lock?.(tx);
      await effect.apply?.(tx);
    });
  const read = async () =>
    (
      await native.admin.query(
        "SELECT i.state,s.state AS subscription_state,s.retired_at IS NOT NULL AS retired FROM treido.billing_intents i JOIN treido.billing_subscriptions s ON s.customer_binding_id=i.customer_binding_id WHERE i.id=$1",
        [intent],
      )
    ).rows[0];
  return {
    calls,
    prepare,
    apply,
    read,
    setStatus: (next: string) => {
      status = next;
    },
  };
}
describe("legacy portal guard with authoritative original subscription reads", () => {
  it("a hidden expired portal and unchanged active subscription preserve the money guard", async () => {
    const f = await fixture();
    await f.apply(await f.prepare());
    expect(await f.read()).toMatchObject({
      state: "reconciling",
      subscription_state: "active",
      retired: false,
    });
    expect(f.calls).toHaveLength(2);
  });
  for (const terminal of ["canceled", "incomplete_expired"])
    it(`the original ${terminal} subscription retires the legacy guard without provider writes`, async () => {
      const f = await fixture();
      f.setStatus(terminal);
      await f.apply(await f.prepare());
      expect(await f.read()).toMatchObject({
        state: "expired",
        subscription_state: terminal,
        retired: true,
      });
      expect(f.calls).toHaveLength(2);
    });
  it("a newer observation prevents an older terminal result from retiring the guard", async () => {
    const f = await fixture();
    f.setStatus("canceled");
    const older = await f.prepare();
    f.setStatus("active");
    await f.apply(await f.prepare());
    await f.apply(older);
    expect(await f.read()).toMatchObject({
      state: "reconciling",
      subscription_state: "active",
      retired: false,
    });
  });
});
