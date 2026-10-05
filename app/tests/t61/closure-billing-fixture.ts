import { expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import Stripe from "../../apps/web/node_modules/stripe/esm/stripe.esm.node.js";
import * as payment from "../../apps/web/src/features/payments/bindings.server";
import { PLANS } from "../../apps/web/src/features/seller-billing/model";
import { actorKey, approvedBinding, readClosurePlan } from "../../apps/web/src/features/account-closure/storage.server";
import { changeClosure } from "../../apps/web/src/features/account-closure/commands.server";
// T61 exact-clock regression: exercise the original producer and unchanged queue guard.
import { createPlanEffects } from "../../apps/web/src/features/account-closure/planning.server";
// End T61 exact-clock regression.
import { processClosureJob } from "../../apps/web/src/features/account-closure/jobs.server";
import { inTransaction } from "../../apps/web/src/server/db/database";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { executeJob } from "../../apps/web/src/server/jobs/execution.server";
import { createLifecycleActor, createLifecycleRegistry, createLifecyclePlan } from "./lifecycle-fixture";
import { aftercareNamespace } from "./aftercare-fixture";
import type { ExecutorFixtureContext } from "./executor-completion-fixture";

export async function runRetiredPersonalBillingClosure(context: ExecutorFixtureContext & {
  recordAdapterCounters: (label: string, read: () => Record<string, number>) => void;
}) {
  const { database, admin } = context, owner = await createLifecycleActor(context, true), foreign = await createLifecycleActor(context);
  const rules = await createLifecycleRegistry(context), catalogue = randomUUID(), customer = randomUUID(), intent = randomUUID(), subscription = randomUUID(), bindingId = randomUUID();
  const suffix = subscription.replaceAll("-", ""), priceId = "price_T61" + suffix, customerId = "cus_T61" + suffix, subscriptionId = "sub_T61" + suffix;
  const binding: payment.PaymentBindings = { ...aftercareNamespace, platformAccount: "acct_T61Platform", livemode: false,
    origin: "http://127.0.0.1", publishableKey: "SYNTHETIC-LOCAL-ONLY", collectionEnabled: false };
  await admin.query("INSERT INTO treido.billing_catalogue(id,plan_id,version,seller_kind,platform_account,livemode,environment,application_id,product_id,price_id,amount_minor,currency,terms,limits,terms_version,tax_policy,change_configuration,portal_configuration,approved_at,revoked_at) VALUES($1,'personal_pro',1,'personal',$2,false,'test',$3,$4,$5,1000,'EUR',$6::jsonb,$7::jsonb,'t61','automatic',$8,$9,clock_timestamp()-interval '1 day',clock_timestamp())", [catalogue, binding.platformAccount, binding.applicationId, "prod_T61" + suffix, priceId, JSON.stringify({ bg: "Синтетични условия", en: "Synthetic terms" }), JSON.stringify(PLANS.personal_pro.limits), "bpc_T61Change" + suffix, "bpc_T61Portal" + suffix]);
  await admin.query("INSERT INTO treido.billing_customers(id,seller_id,platform_account,livemode,environment,application_id,provider_id,approved_at) VALUES($1,$2,$3,false,'test',$4,$5,clock_timestamp())", [customer, owner.sellerId, binding.platformAccount, binding.applicationId, customerId]);
  await admin.query("INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,expires_at,state) VALUES($1,$2,$3,$4,$5,'checkout',$6,$7,$8,'{}'::jsonb,$9,$10,'2026-09-30.endive',clock_timestamp()+interval '1 hour','complete')", [intent, owner.sellerId, owner.userId, randomUUID(), inputHash({ intent }), catalogue, customer, priceId, inputHash({}), "t61-retired-cancel:" + intent]);
  await admin.query("INSERT INTO treido.billing_subscriptions(id,seller_id,customer_binding_id,provider_id,origin_intent_id,catalogue_id,item_id,state) VALUES($1,$2,$3,$4,$5,$6,$7,'active')", [subscription, owner.sellerId, customer, subscriptionId, intent, catalogue, "si_T61" + suffix]);
  await admin.query("INSERT INTO treido.account_lifecycle_bindings(id,environment,application_id,clerk_instance_id,clerk_mode,assistant_lifecycle_version,aftercare_lifecycle_version,stripe_account,stripe_livemode,stripe_application_id,security_enabled,closure_enabled,approved_at) VALUES($1,'test','app_T61Native','app_T61Native','test','assistant-input-v1','order-aftercare-v1',$2,false,$3,true,true,clock_timestamp())", [bindingId, binding.platformAccount, binding.applicationId]);
  const mappedBinding = await inTransaction(database, tx => approvedBinding(tx, bindingId));
  const projection = (await database.pool.query("SELECT * FROM treido.account_read_personal_closure_subscriptions($1)", [owner.userId])).rows;
  expect(projection).toEqual([{ seller_id: owner.sellerId, subscription_id: subscriptionId, customer_binding_id: customer, catalogue_id: catalogue, expected_price_id: priceId }]);
  expect((await database.pool.query("SELECT * FROM treido.account_read_personal_closure_subscriptions($1)", [foreign.userId])).rows).toEqual([]);
  const metadata = { seller_id: owner.sellerId!, purpose: "seller_subscription", ...{ application_id: binding.applicationId, environment: binding.environment } };
  let cancelled = false, posts = 0, gets = 0;
  const localFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url), method = init?.method ?? "GET";
    if (url.hostname !== "api.stripe.com") throw Error("Unexpected synthetic billing host");
    if (method === "POST") {
      if (url.pathname !== "/v1/subscriptions/" + subscriptionId) throw Error("Unexpected synthetic billing mutation");
      const form = new URLSearchParams(String(init?.body ?? ""));
      if (form.get("cancel_at_period_end") !== "true" || form.get("proration_behavior") !== "none") throw Error("Original cancellation parameters changed");
      posts++; cancelled = true;
    } else if (method === "GET") gets++; else throw Error("Unexpected synthetic billing method");
    const value = url.pathname === "/v1/customers/" + customerId
      ? { id: customerId, object: "customer", livemode: false, metadata }
      : url.pathname === "/v1/subscriptions/" + subscriptionId
        ? { id: subscriptionId, object: "subscription", livemode: false, customer: customerId, metadata, status: "active", cancel_at_period_end: cancelled, items: { object: "list", data: [{ id: "si_T61" + suffix, price: { id: priceId } }], has_more: false } }
        : undefined;
    if (!value) throw Error("Unexpected synthetic historical price/tax/portal request");
    return Response.json(value, { headers: { "request-id": "req_T61Synthetic", "stripe-version": "2026-09-30.endive" } });
  };
  const stripe = new Stripe("SYNTHETIC-LOCAL-TRANSPORT-ONLY", { apiVersion: "2026-09-30.endive", maxNetworkRetries: 0, httpClient: Stripe.createFetchHttpClient(localFetch) });
  vi.spyOn(payment, "paymentBindings").mockReturnValue(binding);
  vi.spyOn(payment, "verifiedStripe").mockResolvedValue(stripe);
  context.recordAdapterCounters("retired-personal-closure-local-sdk", () => ({ posts, gets }));
  const plan = await createLifecyclePlan(context, owner, { ...rules, bindingId, binding: mappedBinding });
  const reviewed = await inTransaction(database, tx => readClosurePlan(tx, owner.userId, plan.id, false));
  expect(reviewed.payload.targets).toEqual([{ kind: "billing.stop-renewal", target: { sellerId: owner.sellerId, subscriptionId, customerBindingId: customer, catalogueId: catalogue, expectedPriceId: priceId }, dueSeconds: 0 }]);
  // T61 exact-clock regression: an unaccepted real plan has no usable clock anchor.
  await expect(inTransaction(database, tx => createPlanEffects(tx, plan.id, owner.userId, reviewed.payload))).rejects.toMatchObject({ code: "23502" });
  expect((await admin.query("SELECT id FROM treido.account_lifecycle_effects WHERE plan_id=$1", [plan.id])).rowCount).toBe(0);
  // End T61 exact-clock regression.
  await changeClosure(database, owner.identity, { version: 1, actorKey: actorKey(owner.identity), requestId: randomUUID(), expectedRevision: 0, operation: { kind: "confirm", planId: plan.id, planHash: plan.hash, acknowledged: true } });
  // T61 exact-clock regression: the genuine zero-delay target retains raw accepted_at.
  expect((await admin.query("SELECT e.due_at=p.accepted_at AS same_clock FROM treido.account_lifecycle_effects e JOIN treido.account_execution_plans p ON p.id=e.plan_id WHERE e.plan_id=$1 AND e.kind='billing.stop-renewal'", [plan.id])).rows).toEqual([{ same_clock: true }]);
  for (const anchor of [{ planId: plan.id, userId: foreign.userId }, { planId: randomUUID(), userId: owner.userId }])
    await expect(inTransaction(database, tx => createPlanEffects(tx, anchor.planId, anchor.userId, reviewed.payload))).rejects.toMatchObject({ code: "23502" });
  const delayedTarget = { ...reviewed.payload.targets[0], target: { ...reviewed.payload.targets[0].target, expectedPriceId: "price_T61UnacceptedTarget" }, dueSeconds: 5 };
  await expect(inTransaction(database, async tx => {
    await createPlanEffects(tx, plan.id, owner.userId, { ...reviewed.payload, targets: [delayedTarget] });
    expect((await tx.client.query("SELECT e.due_at=p.accepted_at+make_interval(secs=>5) AS same_clock FROM treido.account_lifecycle_effects e JOIN treido.account_execution_plans p ON p.id=e.plan_id WHERE e.plan_id=$1 AND e.target_hash=$2", [plan.id, inputHash(delayedTarget.target)])).rows).toEqual([{ same_clock: true }]);
    // This target was never accepted: original frozen-target guard rolls it back.
    await tx.client.query("SELECT treido.account_enqueue_closure($1::uuid)", [plan.id]);
  })).rejects.toMatchObject({ code: "23514" });
  expect((await admin.query("SELECT kind,target FROM treido.account_lifecycle_effects WHERE plan_id=$1", [plan.id])).rows).toEqual([{ kind: "billing.stop-renewal", target: reviewed.payload.targets[0].target }]);
  // End T61 exact-clock regression.
  const job = (await admin.query("SELECT id,buyer_id,generation FROM treido.outbox_jobs WHERE kind='account.closure' AND resource_id=$1", [plan.id])).rows[0];
  const outcome = await executeJob(database, { jobId: job.id, sellerId: null, buyerId: job.buyer_id, generation: job.generation, schemaVersion: 1, ...aftercareNamespace }, aftercareNamespace, randomUUID(), { "account.closure": lease => processClosureJob(database, lease) });
  expect(outcome.status).toBe("completed"); expect(posts).toBe(1); expect(gets).toBeGreaterThan(0);
  expect((await admin.query("SELECT state,kind FROM treido.account_lifecycle_effects WHERE plan_id=$1", [plan.id])).rows).toEqual([{ state: "confirmed", kind: "billing.stop-renewal" }]);
  expect((await admin.query("SELECT status FROM treido.users WHERE id=$1", [owner.userId])).rows[0].status).toBe("closed");
  expect((await admin.query("SELECT revoked_at IS NOT NULL AS retired FROM treido.billing_catalogue WHERE id=$1", [catalogue])).rows[0].retired).toBe(true);
}
