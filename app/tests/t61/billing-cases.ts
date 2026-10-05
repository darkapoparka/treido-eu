import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import { readSellerEntitlements } from "../../apps/web/src/features/seller-billing/storage.server";
import { PLANS } from "../../apps/web/src/features/seller-billing/model";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";

/** Deferred until T60 freezes its original schema/helper and canonical adoption.
 * Fake provider IDs and policy/interval fixtures exist only in owned native DB.
 * No Stripe adapter, provider entity, real approval, customer or charge is created.
 */
export function defineBillingPersistenceCases(get: () => {
  database: SellerDatabase; admin: Pool; runtime: Pool; sellerId: string; userIds: [string, string];
}) {
  describe("T61 billing interval and immutable storage on isolated PostgreSQL", () => {
    const read = () => inTransaction(get().database, async tx => {
      await tx.client.query("SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR SHARE", [get().sellerId]);
      return readSellerEntitlements(tx, get().sellerId, "business");
    });
    let intentId: string;
    it("empty billing storage preserves Free base rights and creates no subscription", async () => {
      expect(await read()).toMatchObject({ ...PLANS.business_free.limits, planId: "business_free", planVersion: 1, paidUntil: null });
      expect((await get().admin.query("SELECT count(*)::int AS n FROM treido.billing_subscriptions")).rows[0].n).toBe(0);
    });
    it("database time rejects expired interval, current interval grants typed limits, immutable revocation removes only paid rights", async () => {
      const { admin, sellerId, userIds } = get();
      const keys = ["TREIDO_STRIPE_MODE", "TREIDO_STRIPE_PLATFORM_ACCOUNT", "TREIDO_STRIPE_APPLICATION_ID", "TREIDO_ENV"];
      const before = keys.map(key => process.env[key]);
      const binding = { mode: "test", account: "acct_T61BillingSynthetic", application: "treido-t61-isolated", environment: "test" };
      const rows = [binding.mode, binding.account, binding.application, binding.environment];
      keys.forEach((key, i) => { process.env[key] = rows[i]; });
      try {
        const catalogueId = randomUUID(), customerId = randomUUID(), subscriptionId = randomUUID();
        intentId = randomUUID();
        await admin.query("INSERT INTO treido.billing_catalogue(id,plan_id,version,seller_kind,platform_account,livemode,environment,application_id,product_id,price_id,amount_minor,currency,limits,terms,terms_version,tax_policy,change_configuration,portal_configuration,approved_at) VALUES($1,'business_pro',1,'business',$2,false,'test',$3,'prod_T61Synthetic','price_T61Synthetic',2499,'EUR',$4::jsonb,$5::jsonb,'T61 SYNTHETIC TERMS ONLY','automatic','bpc_T61Synthetic','bpc_T61Synthetic',clock_timestamp())", [catalogueId, binding.account, binding.application, JSON.stringify(PLANS.business_pro.limits), JSON.stringify({ bg: "СИНТЕТИЧНИ ТЕСТОВИ УСЛОВИЯ", en: "SYNTHETIC ISOLATED TEST TERMS" })]);
        await admin.query("INSERT INTO treido.billing_customers(id,seller_id,platform_account,livemode,environment,application_id,provider_id,approved_at) VALUES($1,$2,$3,false,'test',$4,'cus_T61Synthetic',clock_timestamp())", [customerId, sellerId, binding.account, binding.application]);
        await admin.query("INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,expires_at,state) VALUES($1,$2,$3,$4,$5,'checkout',$6,$7,'price_T61Synthetic','{}'::jsonb,$5,$8,'T61 ISOLATED FIXTURE',clock_timestamp()+interval '1 hour','complete')", [intentId, sellerId, userIds[0], randomUUID(), inputHash({}), catalogueId, customerId, "t61-fixture:" + intentId]);
        await admin.query("INSERT INTO treido.billing_subscriptions(id,seller_id,customer_binding_id,provider_id,origin_intent_id,catalogue_id,item_id,state) VALUES($1,$2,$3,'sub_T61Synthetic',$4,$5,'si_T61Synthetic','active')", [subscriptionId, sellerId, customerId, intentId, catalogueId]);
        const counts = async () => (await admin.query("SELECT (SELECT count(*)::int FROM treido.seller_accounts) AS sellers,(SELECT count(*)::int FROM treido.listings) AS listings,(SELECT count(*)::int FROM treido.listing_drafts) AS drafts,(SELECT count(*)::int FROM treido.seller_memberships) AS memberships")).rows[0];
        const preserved = await counts();
        await admin.query("INSERT INTO treido.billing_paid_intervals(id,subscription_id,catalogue_id,invoice_id,line_id,starts_at,ends_at,evidence_hash) VALUES($1,$2,$3,'in_T61Expired','il_T61Expired',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour',$4)", [randomUUID(), subscriptionId, catalogueId, inputHash({ fixture: "expired" })]);
        expect((await read()).planId).toBe("business_free");
        await admin.query("INSERT INTO treido.billing_paid_intervals(id,subscription_id,catalogue_id,invoice_id,line_id,starts_at,ends_at,evidence_hash) VALUES($1,$2,$3,'in_T61Current','il_T61Current',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',$4)", [randomUUID(), subscriptionId, catalogueId, inputHash({ fixture: "current" })]);
        expect(await read()).toMatchObject({ ...PLANS.business_pro.limits, planId: "business_pro", planVersion: 1 });
        await admin.query("INSERT INTO treido.billing_revocations(subscription_id,invoice_id,reason) VALUES($1,'in_T61Current','reversed')", [subscriptionId]);
        expect(await read()).toMatchObject({ ...PLANS.business_free.limits, planId: "business_free", paidUntil: null });
        expect(await counts()).toEqual(preserved);
      } finally { keys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i]; }); }
    });
    it("runtime cannot approve a plan or rewrite immutable interval evidence; intent trigger rejects changed parameters", async () => {
      const { runtime, admin } = get();
      await expect(runtime.query("UPDATE treido.billing_catalogue SET approved_at=clock_timestamp()")).rejects.toMatchObject({ code: "42501" });
      await expect(runtime.query("UPDATE treido.billing_paid_intervals SET evidence_hash=repeat('a',64)")).rejects.toMatchObject({ code: "42501" });
      await expect(admin.query("UPDATE treido.billing_intents SET parameters='{\"changed\":true}'::jsonb WHERE id=$1", [intentId])).rejects.toThrow("Immutable billing intent");
      expect((await admin.query("SELECT parameters FROM treido.billing_intents WHERE id=$1", [intentId])).rows[0].parameters).toEqual({});
    });
  });
}
