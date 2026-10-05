import { expect } from "vitest";
import { randomUUID } from "node:crypto";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { changeClosure } from "../../apps/web/src/features/account-closure/commands.server";
import { actorKey } from "../../apps/web/src/features/account-closure/storage.server";
import type { ClosureJobContext } from "../../apps/web/src/features/account-closure/jobs.server";
import { executeJob } from "../../apps/web/src/server/jobs/execution.server";
import { jobColumns, type ClosureJobRow } from "../../apps/web/src/server/jobs/outbox.server";
import { openListingConversation } from "../../apps/web/src/features/messaging/participants.server";
import { createPublicationFixture } from "../../apps/web/tests/fixtures/publication-flow";
import { PLANS } from "../../apps/web/src/features/seller-billing/model";
import { readSavedSearches } from "../../apps/web/src/features/saved-searches/queries.server";
import { changeSavedSearch } from "../../apps/web/src/features/saved-searches/commands.server";
import { reviewedCriteria } from "../../apps/web/src/features/saved-searches/model";
import { parseToolIntent } from "../../apps/web/src/features/shopping-tools/intent";
import { aftercareLocalTransport, createAftercareFixture, installAftercareAdapters, aftercareNamespace } from "./aftercare-fixture";
import { createLifecycleActor, createLifecycleRegistry, createLifecyclePlan, ensureLifecycleContract } from "./lifecycle-fixture";
import type { ExecutorFixtureContext } from "./executor-completion-fixture";
import type { AdaptedClosureFixture, AdaptedClosureFixtureName } from "./closure-adapted-cases";

type Actor = Awaited<ReturnType<typeof createLifecycleActor>>;
type Registry = Awaited<ReturnType<typeof createLifecycleRegistry>>;
type Paid = Awaited<ReturnType<typeof createAftercareFixture>>;
const synthetic = { bg: "Синтетичен изолиран тест", en: "Synthetic isolated test" };

async function paidEvidence(context: ExecutorFixtureContext, owner: Actor, merchant = false, unpaid = false) {
  const local = aftercareLocalTransport();
  context.registerCleanup(installAftercareAdapters(local));
  return createAftercareFixture(context, local, { ...(merchant ? { merchant: owner, sellerKind: "personal" } : { buyer: owner }), paidEvidence: !unpaid });
}
async function report(context: ExecutorFixtureContext, owner: Actor, paid: Paid, state: "open" | "reviewed") {
  await context.admin.query("INSERT INTO treido.reports(id,reporter_id,resource_kind,resource_id,reason,details,request_id,input_hash,state) VALUES($1,$2,'listing',$3,'other','SYNTHETIC retained report',$4,$5,$6)", [randomUUID(), owner.userId, paid.listingId, randomUUID(), inputHash({ fixture: "retained-report" }), state]);
}
async function sharedBusiness(context: ExecutorFixtureContext, owner: Actor, paid: Paid) {
  await context.admin.query("INSERT INTO treido.seller_memberships(seller_id,user_id,role,status,grants) VALUES($1,$2,'owner','active','[]'::jsonb)", [paid.sellerId, owner.userId]);
  expect((await context.admin.query("SELECT count(*)::int AS n FROM treido.seller_memberships WHERE seller_id=$1 AND role='owner' AND status='active'", [paid.sellerId])).rows[0].n).toBe(2);
}
async function currentLifecyclePolicy(context: ExecutorFixtureContext) {
  const rows = (await context.admin.query<{ id: string; environment: string; application_id: string }>(`SELECT p.id,p.environment,p.application_id FROM treido.order_aftercare_lifecycle_policies p WHERE p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL
    AND EXISTS(SELECT 1 FROM treido.account_lifecycle_bindings b WHERE b.environment=p.environment AND b.application_id=p.application_id AND b.aftercare_lifecycle_version=p.version AND b.closure_enabled AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL)`)).rows;
  if (rows.length !== 1) throw Error("Actual original lifecycle namespace is not singular");
  return rows[0];
}
async function installNoRestoration(context: ExecutorFixtureContext) {
  const prior = await currentLifecyclePolicy(context), id = randomUUID(), namespace = "t61-no-restore-" + randomUUID();
  // Monotonic revocation and a NEW explicitly false isolated policy. Never
  // rewrite approval/policy contents or resurrect the prior immutable registry.
  await context.admin.query("UPDATE treido.order_aftercare_lifecycle_policies SET revoked_at=clock_timestamp() WHERE id=$1", [prior.id]);
  await context.admin.query("INSERT INTO treido.order_aftercare_lifecycle_policies(id,version,environment,application_id,preserves_accepted_evidence,legal_holds_reviewed,allow_restore_restriction,retention_description,approved_at,approval_reference) VALUES($1,'order-aftercare-v1','test',$2,true,true,false,$3::jsonb,clock_timestamp(),'SYNTHETIC no-restoration native fixture')", [id, namespace, JSON.stringify(synthetic)]);
  await context.admin.query("INSERT INTO treido.account_lifecycle_bindings(id,environment,application_id,clerk_instance_id,clerk_mode,assistant_lifecycle_version,aftercare_lifecycle_version,security_enabled,closure_enabled,approved_at) VALUES($1,'test',$2,'ins_T61Native','test','assistant-input-v1','order-aftercare-v1',true,true,clock_timestamp())", [randomUUID(), namespace]);
  context.registerCleanup(async () => {
    await context.admin.query("UPDATE treido.order_aftercare_lifecycle_policies SET revoked_at=clock_timestamp() WHERE id=$1", [id]);
    await ensureLifecycleContract(context);
  });
}

async function billingHold(context: ExecutorFixtureContext, owner: Actor, invoice: boolean) {
  const sellerId = owner.sellerId;
  if (!sellerId) throw Error("Actual personal seller missing");
  const catalogue = randomUUID(), customer = randomUUID(), intent = randomUUID(), suffix = randomUUID().replaceAll("-", ""), account = "acct_T61" + suffix;
  await context.admin.query("INSERT INTO treido.billing_catalogue(id,plan_id,version,seller_kind,platform_account,livemode,environment,application_id,product_id,price_id,amount_minor,currency,limits,terms,terms_version,tax_policy,change_configuration,portal_configuration,approved_at) VALUES($1,'personal_pro',1,'personal',$2,false,'test','t61-closure','prod_T61','price_T61',2499,'EUR',$3::jsonb,$4::jsonb,'SYNTHETIC','automatic','bpc_T61','bpc_T61',clock_timestamp())", [catalogue, account, JSON.stringify(PLANS.personal_pro.limits), JSON.stringify(synthetic)]);
  await context.admin.query("INSERT INTO treido.billing_customers(id,seller_id,platform_account,livemode,environment,application_id,provider_id,approved_at) VALUES($1,$2,$3,false,'test','t61-closure','cus_T61',clock_timestamp())", [customer, sellerId, account]);
  await context.admin.query("INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,expires_at,state) VALUES($1,$2,$3,$4,$5,'checkout',$6,$7,'price_T61','{}'::jsonb,$5,$8,'SYNTHETIC',clock_timestamp()+interval '1 hour',$9)", [intent, sellerId, owner.userId, randomUUID(), inputHash({}), catalogue, customer, "t61-closure:" + intent, invoice ? "complete" : "reconciling"]);
  if (invoice) {
    const subscription = randomUUID();
    await context.admin.query("INSERT INTO treido.billing_subscriptions(id,seller_id,customer_binding_id,provider_id,origin_intent_id,catalogue_id,item_id,state) VALUES($1,$2,$3,'sub_T61',$4,$5,'si_T61','active')", [subscription, sellerId, customer, intent, catalogue]);
    await context.admin.query("INSERT INTO treido.billing_invoice_observations(id,subscription_id,provider_id,fact_hash,status,amount_minor,currency,paid) VALUES($1,$2,'in_T61',$3,'open',2499,'EUR',false)", [randomUUID(), subscription, inputHash({ fixture: "unpaid-invoice" })]);
  }
}
async function promotionHold(context: ExecutorFixtureContext, owner: Actor, kind: "promotionAttempts" | "promotionReservations" | "promotionRemedies") {
  const paid = await paidEvidence(context, owner, true), campaign = randomUUID(), policy = randomUUID(), capacity = randomUUID(), review = randomUUID(), attempt = randomUUID();
  const account = "acct_T61" + randomUUID().replaceAll("-", ""), terms = { productId: "category_spotlight_7d_v1", version: 1, currency: "EUR", totalMinor: 12900, tax: "inclusive", automaticRenewal: false, text: synthetic, approvalReference: "SYNTHETIC native hold" };
  await context.admin.query("INSERT INTO treido.promotion_products(id,product_id,version,terms,platform_account,environment,application_id,livemode,approved_at) VALUES($1,'category_spotlight_7d_v1',1,$2::jsonb,$3,'test','t61-closure',false,clock_timestamp())", [policy, JSON.stringify(terms), account]);
  await context.admin.query("INSERT INTO treido.promotion_capacity(id,product_policy_id,country,category_id,seller_kind,slots,waitlist_limit,approved_at) VALUES($1,$2,'BG','cat:electronics/phones','personal',1,1,clock_timestamp())", [capacity, policy]);
  await context.admin.query("INSERT INTO treido.promotion_campaigns(id,seller_id,listing_id,product_id,revision,state) VALUES($1,$2,$3,'category_spotlight_7d_v1',1,'reconciling')", [campaign, paid.sellerId, paid.listingId]);
  const revision = (await context.admin.query<{ revision: number }>("SELECT revision FROM treido.listings WHERE id=$1", [paid.listingId])).rows[0].revision;
  await context.admin.query("INSERT INTO treido.promotion_reviews(id,seller_id,campaign_id,campaign_revision,listing_revision,category_id,country,product_policy_id,capacity_id,terms,terms_hash,expires_at) VALUES($1,$2,$3,1,$4,'cat:electronics/phones','BG',$5,$6,$7::jsonb,$8,clock_timestamp()+interval '15 minutes')", [review, paid.sellerId, campaign, revision, policy, capacity, JSON.stringify(terms), inputHash(terms)]);
  const intent = { purpose: "promotion", attemptId: attempt, sellerId: paid.sellerId, campaignId: campaign, currency: "EUR", totalMinor: 12900, platformAccount: account, livemode: false, language: "en", checkoutExpiresAt: new Date(Date.now() + 1200000).toISOString() };
  await context.admin.query("INSERT INTO treido.promotion_attempts(id,seller_id,campaign_id,review_id,intent,state,platform_account,livemode) VALUES($1,$2,$3,$4,$5::jsonb,'reconciling',$6,false)", [attempt, paid.sellerId, campaign, review, JSON.stringify(intent), account]);
  if (kind === "promotionReservations") await context.admin.query("INSERT INTO treido.promotion_reservations(campaign_id,capacity_id,status,expires_at) VALUES($1,$2,'reserved',clock_timestamp()+interval '1 hour')", [campaign, capacity]);
  if (kind === "promotionRemedies") {
    await context.admin.query("INSERT INTO treido.promotion_purchases(campaign_id,seller_id,attempt_id,review_id,terms) VALUES($1,$2,$3,$4,$5::jsonb)", [campaign, paid.sellerId, attempt, review, JSON.stringify(terms)]);
    await context.admin.query("INSERT INTO treido.promotion_remedy_reviews(campaign_id,kind,maximum_minor,reason) VALUES($1,'full_refund_review',12900,'platform_failure')", [campaign]);
  }
}

async function addHold(context: ExecutorFixtureContext, owner: Actor, rules: Registry, hold: string) {
  if (hold === "billingIntents" || hold === "billingInvoices") return billingHold(context, owner, hold === "billingInvoices");
  if (hold === "promotionAttempts" || hold === "promotionReservations" || hold === "promotionRemedies") return promotionHold(context, owner, hold);
  if (hold === "sessionEffects") {
    const target = { sessionId: "SYNTHETIC-original-security-session" };
    await context.admin.query("INSERT INTO treido.account_lifecycle_effects(id,user_id,binding_id,subject,kind,target,target_hash,operation_key,due_at) VALUES($1,$2,$3,$4,'session.revoke',$5::jsonb,$6,$7,clock_timestamp())", [randomUUID(), owner.userId, rules.bindingId, owner.identity.subject, JSON.stringify(target), inputHash(target), randomUUID()]);
    return;
  }
  if (hold === "legalHolds") {
    const policy = await currentLifecyclePolicy(context);
    await context.admin.query("INSERT INTO treido.order_aftercare_legal_holds(id,user_id,environment,application_id,approved_at,approval_reference) VALUES($1,$2,$3,$4,clock_timestamp(),'SYNTHETIC owned legal hold')", [randomUUID(), owner.userId, policy.environment, policy.application_id]); return;
  }
  if (hold === "assistantRuns") {
    const policy = randomUUID(), run = randomUUID(), applicationId = "app_T61" + randomUUID().replaceAll("-", "");
    await context.admin.query("INSERT INTO treido.assistant_runtime_policies(id,application_id,environment,purpose,config,approved_at) VALUES($1,$3,'test','shopping-input-v1',$2::jsonb,clock_timestamp())", [policy, JSON.stringify({ version: 1, budgetCurrency: "USD" }), applicationId]);
    await context.admin.query("INSERT INTO treido.assistant_runs(id,user_id,mode,policy_id,input_hash,state,expires_at) VALUES($1,$2,'text',$3,$4,'unknown',clock_timestamp()+interval '1 hour')", [run, owner.userId, policy, inputHash({ fixture: "unknown-original-run" })]);
    await context.admin.query("INSERT INTO treido.assistant_run_reservations(run_id,user_id,application_id,environment,reserved_minor,currency,status) VALUES($1,$2,$3,'test',7,'USD','unknown')", [run, owner.userId, applicationId]); return;
  }
  if (hold === "soleBusinessOwners" || hold === "mediaWriters") {
    const client = await context.admin.connect();
    try { await createPublicationFixture({ database: context.database, admin: client, owner: owner.identity }, hold === "soleBusinessOwners" ? "business" : "personal", hold === "mediaWriters" ? owner.sellerId ?? undefined : undefined); }
    finally { client.release(); } return;
  }
  const paid = await paidEvidence(context, owner, false, hold === "allocations" || hold === "payments");
  if (hold === "allocations" || hold === "payments") return;
  if (hold === "orders") { await context.admin.query("UPDATE treido.paid_orders SET payment_state='disputed' WHERE id=$1", [paid.orderId]); return; }
  if (hold === "refunds") {
    await context.admin.query("INSERT INTO treido.payment_refunds(id,order_id,attempt_id,seller_id,actor_id,reason,recent_auth_verified_at,operation_key,parameters,parameter_hash,state) VALUES($1,$2,$3,$4,$5,'SYNTHETIC unresolved original refund',clock_timestamp(),$6,'{}'::jsonb,$7,'reconciling')", [randomUUID(), paid.orderId, paid.attemptId, paid.sellerId, paid.merchant.userId, "t61-closure-refund:" + randomUUID(), inputHash({})]); return;
  }
  if (hold === "cases") return report(context, owner, paid, "open");
  if (hold === "offers") {
    const { id: thread } = await openListingConversation(context.database, owner.identity, paid.listingId);
    await context.admin.query("INSERT INTO treido.listing_offers(id,thread_id,seller_id,listing_id,buyer_id,proposer_id,proposer_side,publication_revision,sku_id,quantity,unit_price_minor,currency,expires_at,sequence) SELECT $1,$2,$3,$4,$5,$5,'buyer',publication_revision,$6,1,12900,'EUR',clock_timestamp()+interval '1 hour',1 FROM treido.inventory_publication_skus WHERE seller_id=$3 AND listing_id=$4 AND sku_id=$6 ORDER BY publication_revision DESC LIMIT 1", [randomUUID(), thread, paid.sellerId, paid.listingId, owner.userId, paid.skuId]); return;
  }
  throw Error("No actual relational closure hold fixture: " + hold);
}

async function lease(context: ExecutorFixtureContext, job: ClosureJobRow) {
  let arrived!: (job: ClosureJobContext) => void;
  const arrival = new Promise<ClosureJobContext>(resolve => { arrived = resolve; });
  const interrupted = new Error("SYNTHETIC owned helper-boundary lease released");
  let release!: () => void;
  const barrier = new Promise<never>((_, reject) => { release = () => reject(interrupted); });
  const execution = executeJob(context.database, { jobId: job.id, sellerId: null, buyerId: job.buyerId, generation: job.generation, schemaVersion: 1, ...aftercareNamespace }, aftercareNamespace, randomUUID(), {
    "account.closure": async current => { arrived(current); return barrier; },
  });
  const outcome = execution.then(result => ({ completed: true as const, result }), (error: unknown) => ({ completed: false as const, error }));
  const original = await Promise.race([arrival, outcome.then(result => { if (result.completed) throw Error("Original closure lease ended before the boundary barrier"); throw result.error; })]);
  context.registerCleanup(async () => {
    release(); const result = await outcome;
    if (result.completed) throw Error("Helper-boundary lease unexpectedly completed without its original processor");
    expect(result.error).toBe(interrupted);
  });
  return original;
}

/** Fresh actual native relations for every original owner case. The lease-only
 * barrier is a direct SQL-helper fixture, distinct from the25 original-processor
 * executor regressions. It never emits a session/provider effect or completion. */
export async function createAdaptedClosureFixture(context: ExecutorFixtureContext, name: AdaptedClosureFixtureName): Promise<AdaptedClosureFixture> {
  const owner = await createLifecycleActor(context, true), rules = await createLifecycleRegistry(context, { futurePolicy: name.startsWith("future-policy"), futureBinding: name.startsWith("future-binding") });
  let paid: Paid | undefined;
  if (name === "finish-preserves-evidence" || name === "cancel-before-effects" || name === "cancel-with-new-legacy-hold") {
    paid = await paidEvidence(context, owner); await report(context, owner, paid, "reviewed"); await sharedBusiness(context, owner, paid);
  }
  if (name === "cancel-before-effects") {
    const view = await readSavedSearches(context.database, owner.identity);
    await changeSavedSearch(context.database, owner.identity, { actorKey: view.actorKey, requestId: randomUUID(), expectedRevision: view.revision,
      operation: { kind: "save", name: "SYNTHETIC matching to pause", frequency: 60, enable: true, criteria: reviewedCriteria(parseToolIntent("category=cat%3Aelectronics%2Fphones&currency=EUR", "find-for-me"), "find-for-me") } });
  }
  const withSession = name === "cancel-after-unknown" || name === "unknown-original-effect" || name === "wrong-job-lease" || name.endsWith("-effect");
  const prepared = await createLifecyclePlan(context, owner, rules, withSession ? [{ id: "SYNTHETIC-complete-owned-session-inventory" }] : []);
  const result: AdaptedClosureFixture = { database: context.database, admin: context.admin, userId: owner.userId, planId: prepared.id, planHash: prepared.hash, effectId: null, jobId: null, executionToken: null };
  if (name.startsWith("future-")) return result;
  if (name.startsWith("hold-")) { await addHold(context, owner, rules, name.slice(5)); return result; }
  const unaccepted = name === "inactive-unaccepted-plan" ? await createLifecyclePlan(context, owner, rules) : null;
  await changeClosure(context.database, owner.identity, { version: 1, actorKey: actorKey(owner.identity), requestId: randomUUID(), expectedRevision: 0, operation: { kind: "confirm", planId: prepared.id, planHash: prepared.hash, acknowledged: true } });
  if (unaccepted) return { ...result, planId: unaccepted.id, planHash: unaccepted.hash };
  if (name === "cancel-without-reviewed-restoration") { await installNoRestoration(context); return result; }
  if (name === "cancel-with-new-legacy-hold") {
    if (!paid) throw Error("Original prior paid evidence missing");
    await context.admin.query("UPDATE treido.payment_attempts SET state='quarantined' WHERE id=$1", [paid.attemptId]); return result;
  }
  if (name === "cancel-before-effects" || name === "cancel-after-restriction") return result;
  const job = (await context.admin.query<ClosureJobRow>(`SELECT ${jobColumns} FROM treido.outbox_jobs WHERE kind='account.closure' AND resource_id=$1`, [prepared.id])).rows[0];
  if (!job) throw Error("Original accepted closure did not register its genuine job");
  const originalLease = await lease(context, job);
  result.jobId = originalLease.id; result.executionToken = originalLease.executionToken;
  result.effectId = (await context.admin.query<{ id: string }>("SELECT id FROM treido.account_lifecycle_effects WHERE plan_id=$1 ORDER BY id LIMIT 1", [prepared.id])).rows[0]?.id ?? null;
  if (withSession && !result.effectId) throw Error("Original accepted session target did not create its original effect");
  if (name.startsWith("revoked-")) {
    const table = name.startsWith("revoked-policy") ? "account_closure_policies" : "account_lifecycle_bindings", id = name.startsWith("revoked-policy") ? rules.policyId : rules.bindingId;
    await context.admin.query(`UPDATE treido.${table} SET revoked_at=clock_timestamp() WHERE id=$1`, [id]); return result;
  }
  if (name === "cancel-after-unknown" || name === "unknown-original-effect") {
    const token = randomUUID();
    expect((await context.database.pool.query("SELECT treido.account_claim_effect($1::uuid,$2::uuid,$3::uuid,$4::uuid) AS result", [result.effectId, token, result.jobId, result.executionToken])).rows[0].result).toMatchObject({ claimed: true, execute: true });
    await context.database.pool.query("SELECT treido.account_record_effect($1::uuid,$2::uuid,'unknown',$3,'database')", [result.effectId, token, inputHash({ fixture: "explicit-unknown-no-provider-outcome" })]);
  }
  return result;
}
