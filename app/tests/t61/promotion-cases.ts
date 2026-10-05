import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import { createBusinessSeller } from "../../apps/web/src/features/sellers/persistence.server";
import { readPromotions } from "../../apps/web/src/features/promotions/queries.server";
import { executePromotion, recoverPromotion } from "../../apps/web/src/features/promotions/commands.server";
import type { ToolListing } from "../../apps/web/src/features/shopping-tools/model";
import { createPublicationFixture } from "../../apps/web/tests/fixtures/publication-flow";
import { publishListing } from "../../apps/web/src/features/selling/publish.server";
import type { PromotionPaymentBridge } from "../../apps/web/src/features/promotions/payment-bridge.server";
import type { Terms } from "../../apps/web/src/features/promotions/model";
import { changeInventory } from "../../apps/web/src/features/inventory/commands.server";
import { readPublicInventory } from "../../apps/web/src/features/inventory/queries.server";
import { currentEligible } from "../../apps/web/src/features/promotions/eligibility.server";
import { readPublicDiscovery } from "../../apps/web/src/features/catalog/public-discovery.server";
import { giftCatalogue } from "../../apps/web/src/features/gift-finder/catalogue.server";
import { parseGiftBrief } from "../../apps/web/src/features/gift-finder/model";

/** Isolated cases await original proposal/helper freeze and canonical adoption.
 * No provider or actual approval/paid policy is created. Synthetic capacity-policy
 * fixtures stay exclusively in the caller's owned local database. A throwing
 * provider adapter makes any attempted external effect fail the case.
 */
export function definePromotionPersistenceCases(get: () => {
  database: SellerDatabase; admin: Pool; runtime: Pool; facts: ToolListing[];
  identities: [VerifiedIdentity, VerifiedIdentity]; userIds: [string, string]; sellerId: string;
}) {
  describe("T61 promotions on actual isolated PostgreSQL without commercial approval", () => {
    let secondSeller: string;
    let promotionListing: string;
    it("read is side-effect free; exact duplicate draft race stores one campaign/event/receipt", async () => {
      const { database, admin, identities, sellerId, facts } = get();
      const view = await readPromotions(database, identities[0], sellerId);
      expect(view.paymentAvailable).toBe(false);
      expect(view.campaigns).toEqual([]);
      // Earlier tool fixtures deliberately have unknown inventory. Promotion
      // requires current available stock; create its separate publication with
      // genuine inventory commands before publishing, without changing them.
      expect(await readPublicInventory(database, facts[0].card.id)).toMatchObject({ mode: "unknown", state: "unknown", skus: [] });
      const client = await admin.connect();
      try {
        const fixture = await createPublicationFixture({ database, admin: client, owner: identities[0] }, "business", sellerId);
        const stocked = await changeInventory(database, identities[0], { sellerId, listingId: fixture.draft.id, requestId: randomUUID(), expectedRevision: 0, operation: { kind: "setup", mode: "unique", onHand: 1, sellerSku: "T61 promotion unique fixture" } });
        await publishListing(database, identities[0], { ...fixture.input, expectedRevision: stocked.listingRevision });
        promotionListing = fixture.draft.id;
      } finally { client.release(); }
      expect(await readPublicInventory(database, promotionListing)).toMatchObject({ mode: "unique", state: "available" });
      expect(await inTransaction(database, tx => currentEligible(tx, sellerId, promotionListing))).toMatchObject({ id: promotionListing });
      const campaignId = randomUUID(), command = { actorKey: view.actorKey, sellerId, requestId: randomUUID(), campaignId, expectedRevision: 0, action: "save", listingId: promotionListing, productId: "category_spotlight_7d_v1" };
      const outcomes = await Promise.all([executePromotion(database, identities[0], command, null), executePromotion(database, identities[0], command, null)]);
      expect(outcomes[0]).toEqual(outcomes[1]);
      const counts = (await admin.query("SELECT (SELECT count(*)::int FROM treido.promotion_campaigns WHERE id=$1) AS campaigns,(SELECT count(*)::int FROM treido.promotion_events WHERE campaign_id=$1) AS events,(SELECT count(*)::int FROM treido.promotion_receipts WHERE request_id=$2) AS receipts", [campaignId, command.requestId])).rows[0];
      expect(counts).toEqual({ campaigns: 1, events: 1, receipts: 1 });
      expect(await recoverPromotion(database, identities[0], command)).toEqual(outcomes[0]);
      await expect(executePromotion(database, identities[0], { ...command, productId: "home_spotlight_7d_v1" }, null)).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("unapproved review never permits purchase, payment intent, capacity reservation or paid success", async () => {
      const { database, admin, identities, sellerId } = get(), actor = identities[0];
      const view = await readPromotions(database, actor, sellerId), campaign = view.campaigns[0];
      const reviewed = await executePromotion(database, actor, { actorKey: view.actorKey, sellerId, campaignId: campaign.id, expectedRevision: campaign.revision, requestId: randomUUID(), action: "review", reason: "Synthetic explicit review" }, null);
      const current = await readPromotions(database, actor, sellerId), review = current.campaigns[0].review!;
      expect(review).toMatchObject({ terms: null, saleAvailable: false, capacity: "unavailable" });
      await expect(executePromotion(database, actor, { actorKey: view.actorKey, sellerId, campaignId: campaign.id, expectedRevision: reviewed.revision, requestId: randomUUID(), action: "purchase", reviewId: review.id, termsHash: review.termsHash, acknowledged: true, language: "bg" }, null)).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      const counts = (await admin.query("SELECT (SELECT count(*)::int FROM treido.promotion_attempts) AS attempts,(SELECT count(*)::int FROM treido.promotion_reservations) AS reservations,(SELECT count(*)::int FROM treido.promotion_purchases) AS purchases")).rows[0];
      expect(counts).toEqual({ attempts: 0, reservations: 0, purchases: 0 });
      expect((await readPromotions(database, actor, sellerId)).campaigns[0].revision).toBe(reviewed.revision);
    });
    it("two-business foreign scope is denied; marketing delegation does not imply billing and revocation is current", async () => {
      const { database, admin, identities, userIds, sellerId } = get();
      const otherSeller = await createBusinessSeller(database, identities[1], { name: "Synthetic T61 second business", requestId: randomUUID() });
      secondSeller = otherSeller;
      await expect(readPromotions(database, identities[0], otherSeller)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(readPromotions(database, identities[1], sellerId)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await admin.query("INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'member','[\"marketing.manage\"]'::jsonb)", [sellerId, userIds[1]]);
      try {
        const view = await readPromotions(database, identities[1], sellerId), campaign = view.campaigns[0];
        expect(view.canBill).toBe(false);
        await expect(executePromotion(database, identities[1], { actorKey: view.actorKey, sellerId, campaignId: campaign.id, expectedRevision: campaign.revision, requestId: randomUUID(), action: "purchase", reviewId: campaign.review!.id, termsHash: campaign.review!.termsHash, acknowledged: true, language: "bg" }, null)).rejects.toMatchObject({ code: "FORBIDDEN" });
        await admin.query("UPDATE treido.seller_memberships SET status='revoked',revision=revision+1 WHERE seller_id=$1 AND user_id=$2", [sellerId, userIds[1]]);
        await expect(readPromotions(database, identities[1], sellerId)).rejects.toMatchObject({ code: "FORBIDDEN" });
      } finally {
        // Retain the revoked fixture membership as evidence; never remove accounts or history.
        await admin.query("UPDATE treido.seller_memberships SET status='revoked' WHERE seller_id=$1 AND user_id=$2", [sellerId, userIds[1]]);
      }
    });
    it("runtime cannot approve or change registry data; actual same-ID locks work and unused identities stay immutable", async () => {
      const { admin, runtime } = get();
      // Synthetic local approvals only. The target product has no capacity,
      // review or purchase reference, so a changed ID cannot merely fail an FK.
      const productId = randomUUID(), capacityParent = randomUUID(), capacityId = randomUUID(), measurementId = randomUUID();
      const terms: Terms = { productId: "category_spotlight_7d_v1", version: 1, totalMinor: 399, currency: "EUR", durationSeconds: 604800,
        tax: "inclusive", automaticRenewal: false, cancellation: "seller_stop_no_automatic_refund", neverStartedRemedy: "full_refund_review",
        interruptedRemedy: "prorated_review", text: { bg: "СИНТЕТИЧНИ ТЕСТОВИ УСЛОВИЯ", en: "SYNTHETIC REGISTRY GUARD FIXTURE" }, approvalReference: "T61 FIXTURE ONLY, NO ACTUAL APPROVAL" };
      for (const [id, application] of [[productId, "t61-unused-registry-fixture"], [capacityParent, "t61-capacity-parent-fixture"]]) {
        await admin.query("INSERT INTO treido.promotion_products(id,product_id,version,terms,platform_account,environment,application_id,livemode,approved_at) VALUES($1,$2,1,$3::jsonb,'acct_T61GuardFixture','test',$4,false,clock_timestamp())", [id, terms.productId, JSON.stringify(terms), application]);
      }
      await admin.query("INSERT INTO treido.promotion_capacity(id,product_policy_id,country,category_id,seller_kind,slots,waitlist_limit,approved_at) VALUES($1,$2,'BG','cat:electronics/phones','business',1,0,clock_timestamp())", [capacityId, capacityParent]);
      await admin.query(`INSERT INTO treido.promotion_measurement_policies
        (id,version,policy_version,environment,application_id,retention_days,consent_rule,event_definition,text,approval_reference,approved_at)
        VALUES($1,1,'visible-v1','test','app_t61_unused_guard_fixture',7,'explicit_promotion_measurement_opt_in',
        '{"ratio":0.5,"continuousMilliseconds":1000,"foreground":true,"click":"product_anchor"}'::jsonb,
        '{"bg":"СИНТЕТИЧНА ПОЛИТИКА","en":"SYNTHETIC UNUSED GUARD FIXTURE"}'::jsonb,
        'T61 ISOLATED FIXTURE ONLY; NO REAL APPROVAL',clock_timestamp())`, [measurementId]);
      const references = (await admin.query(`SELECT
        (SELECT count(*)::int FROM treido.promotion_capacity WHERE product_policy_id=$1) AS capacities,
        (SELECT count(*)::int FROM treido.promotion_reviews WHERE product_policy_id=$1 OR capacity_id=$2) AS reviews,
        (SELECT count(*)::int FROM treido.promotion_measurement_choices WHERE policy_id=$3) AS choices`, [productId, capacityId, measurementId])).rows[0];
      expect(references).toEqual({ capacities: 0, reviews: 0, choices: 0 });
      for (const [table, id] of [["promotion_products", productId], ["promotion_capacity", capacityId], ["promotion_measurement_policies", measurementId]]) {
        expect((await runtime.query(`UPDATE treido.${table} SET id=id WHERE id=$1 RETURNING id`, [id])).rows).toEqual([{ id }]);
        const client = await runtime.connect();
        try {
          await client.query("BEGIN");
          expect((await client.query(`SELECT id FROM treido.${table} WHERE id=$1 FOR SHARE`, [id])).rows).toEqual([{ id }]);
          await client.query("COMMIT");
        } finally { await client.query("ROLLBACK"); client.release(); }
        const changedId = randomUUID();
        await expect(runtime.query(`UPDATE treido.${table} SET id=$2 WHERE id=$1`, [id, changedId])).rejects.toMatchObject({ code: "23514" });
        expect((await admin.query(`SELECT id FROM treido.${table} WHERE id=ANY($1::uuid[])`, [[id, changedId]])).rows).toEqual([{ id }]);
        await expect(runtime.query(`INSERT INTO treido.${table} SELECT * FROM treido.${table} WHERE id=$1`, [id])).rejects.toMatchObject({ code: "42501" });
        await expect(runtime.query(`DELETE FROM treido.${table} WHERE id=$1`, [id])).rejects.toMatchObject({ code: "42501" });
        await expect(runtime.query(`UPDATE treido.${table} SET revoked_at=clock_timestamp() WHERE id=$1`, [id])).rejects.toMatchObject({ code: "42501" });
        const revoked = (await admin.query(`UPDATE treido.${table} SET revoked_at=clock_timestamp() WHERE id=$1 RETURNING revoked_at`, [id])).rows[0].revoked_at;
        await expect(admin.query(`UPDATE treido.${table} SET revoked_at=NULL WHERE id=$1`, [id])).rejects.toMatchObject({ code: "23514" });
        await expect(admin.query(`UPDATE treido.${table} SET revoked_at=revoked_at+interval '1 second' WHERE id=$1`, [id])).rejects.toMatchObject({ code: "23514" });
        expect((await admin.query(`SELECT revoked_at FROM treido.${table} WHERE id=$1`, [id])).rows[0].revoked_at).toEqual(revoked);
        expect((await runtime.query(`UPDATE treido.${table} SET id=id WHERE id=$1 RETURNING id`, [id])).rows).toEqual([{ id }]);
      }
      await expect(admin.query("UPDATE treido.promotion_products SET version=2,terms=jsonb_set(terms,'{version}','2'::jsonb) WHERE id=$1", [productId])).rejects.toMatchObject({ code: "23514" });
      await expect(admin.query("UPDATE treido.promotion_capacity SET slots=2 WHERE id=$1", [capacityId])).rejects.toMatchObject({ code: "23514" });
      await expect(admin.query("UPDATE treido.promotion_measurement_policies SET version=2,retention_days=8 WHERE id=$1", [measurementId])).rejects.toMatchObject({ code: "23514" });
      expect((await admin.query("SELECT version,(terms->>'version')::int AS terms_version FROM treido.promotion_products WHERE id=$1", [productId])).rows[0]).toEqual({ version: 1, terms_version: 1 });
      expect((await admin.query("SELECT slots FROM treido.promotion_capacity WHERE id=$1", [capacityId])).rows[0]).toEqual({ slots: 1 });
      expect((await admin.query("SELECT version,retention_days FROM treido.promotion_measurement_policies WHERE id=$1", [measurementId])).rows[0]).toEqual({ version: 1, retention_days: 7 });
      await expect(runtime.query("UPDATE treido.promotion_products SET approved_at=clock_timestamp()")).rejects.toMatchObject({ code: "42501" });
      await expect(runtime.query("UPDATE treido.promotion_reviews SET terms='{}'::jsonb")).rejects.toMatchObject({ code: "42501" });
      await expect(runtime.query("UPDATE treido.promotion_receipts SET acknowledgment='{}'::jsonb")).rejects.toMatchObject({ code: "42501" });
      await expect(runtime.query("UPDATE treido.promotion_measurement_choices SET allowed=false")).rejects.toMatchObject({ code: "42501" });
    });
    it("two different businesses cannot oversubscribe one capacity slot; uncertain cancellation retains reservation", async () => {
      const { database, admin, identities, sellerId, userIds } = get();
      const client = await admin.connect();
      let secondListing: string;
      try {
        const fixture = await createPublicationFixture({ database, admin: client, owner: identities[1] }, "business", secondSeller);
        const stocked = await changeInventory(database, identities[1], { sellerId: secondSeller, listingId: fixture.draft.id, requestId: randomUUID(), expectedRevision: 0, operation: { kind: "setup", mode: "stocked", onHand: 1, sellerSku: "T61 stocked available fixture" } });
        const defined = await changeInventory(database, identities[1], { sellerId: secondSeller, listingId: fixture.draft.id, requestId: randomUUID(), expectedRevision: stocked.revision, operation: { kind: "variant", skuId: stocked.skuId, sellerSku: "T61 available red fixture", options: { Color: "Red" }, priceMinor: 12900 } });
        const variant = await changeInventory(database, identities[1], { sellerId: secondSeller, listingId: fixture.draft.id, requestId: randomUUID(), expectedRevision: defined.revision, operation: { kind: "variant", skuId: null, sellerSku: "T61 zero variant fixture", options: { Color: "Blue" }, priceMinor: 9900, onHand: 0 } });
        await publishListing(database, identities[1], { ...fixture.input, expectedRevision: variant.listingRevision });
        secondListing = fixture.draft.id;
      } finally { client.release(); }
      const available = await readPublicInventory(database, secondListing);
      expect(available).toMatchObject({ mode: "stocked", state: "available" });
      expect(available!.skus.map(sku => sku.available).sort()).toEqual([0, 1]);
      const organic = await readPublicDiscovery(database, { category: "cat:electronics/phones", seller: "business", maxPrice: "100", currency: "EUR" }, { key: Buffer.alloc(32, 61), sellerId: secondSeller, limit: 5 });
      const strict = await inTransaction(database, tx => giftCatalogue(tx, userIds[1], parseGiftBrief({ version: 1, occasion: "birthday", age: "adult", neededBy: null, criteria: "category=cat%3Aelectronics%2Fphones&maxPrice=100&currency=EUR" }), null, [secondListing]));
      expect(strict.items.some(item => item.card.id === secondListing)).toBe(false);
      // Diagnostic only: the owner decides any existing organic-price contract
      // repair. Never claim hard-price acceptance from a mocked query or merely
      // from the promotion-mode repair. This captures actual original adapters.
      const observed = organic.items.find(item => item.id === secondListing);
      await writeFile(resolve(import.meta.dirname, "../../../.qa/t61", "stocked-price-observation-" + randomUUID() + ".json"), JSON.stringify({ fixtureScope: "synthetic isolated native database only", listingId: secondListing,
        stock: available, maxPriceMinor: 10000, organicIncludesListing: !!observed, organicPriceMinor: observed?.price.amount ?? null,
        strictAvailableVariantIncludesListing: strict.items.some(item => item.card.id === secondListing),
        scope: "Actual original organic catalogue versus strict T52/Gift available-variant hard-price observation; not paid-display/production acceptance." }, null, 2));
      expect(await inTransaction(database, tx => currentEligible(tx, secondSeller, secondListing))).toMatchObject({ id: secondListing });
      const terms: Terms = { productId: "category_spotlight_7d_v1", version: 1, totalMinor: 399, currency: "EUR", durationSeconds: 604800,
        tax: "inclusive", automaticRenewal: false, cancellation: "seller_stop_no_automatic_refund", neverStartedRemedy: "full_refund_review",
        interruptedRemedy: "prorated_review", text: { bg: "СИНТЕТИЧНИ ТЕСТОВИ УСЛОВИЯ", en: "SYNTHETIC ISOLATED TEST TERMS" }, approvalReference: "T61 FIXTURE ONLY, NO ACTUAL APPROVAL" };
      let providerCalls = 0;
      const bridge: PromotionPaymentBridge = { binding: { platformAccount: "acct_T61Synthetic", environment: "test", applicationId: "treido-t61-isolated", livemode: false },
        create: async () => { providerCalls++; throw Error("T61 provider calls forbidden"); },
        observe: async () => { providerCalls++; throw Error("T61 provider calls forbidden"); } };
      const policyId = randomUUID(), capacityId = randomUUID();
      await admin.query("INSERT INTO treido.promotion_products(id,product_id,version,terms,platform_account,environment,application_id,livemode,approved_at) VALUES($1,$2,1,$3::jsonb,$4,'test',$5,false,clock_timestamp())", [policyId, terms.productId, JSON.stringify(terms), bridge.binding.platformAccount, bridge.binding.applicationId]);
      await admin.query("INSERT INTO treido.promotion_capacity(id,product_policy_id,country,category_id,seller_kind,slots,waitlist_limit,approved_at) VALUES($1,$2,'BG','cat:electronics/phones','business',1,0,clock_timestamp())", [capacityId, policyId]);
      const sellerIds = [sellerId, secondSeller], listingIds = [promotionListing, secondListing];
      // Fake provider-shaped mappings live only in this owned database; the
      // throwing adapter below proves no external create/observe call occurs.
      await admin.query("INSERT INTO treido.promotion_payment_bindings(id,product_policy_id,platform_account,livemode,environment,application_id,purpose,product_id,price_id,approved_at) VALUES($1,$2,$3,false,'test',$4,'promotion','prod_T61PromotionFixture','price_T61PromotionFixture',clock_timestamp())", [randomUUID(), policyId, bridge.binding.platformAccount, bridge.binding.applicationId]);
      for (let i = 0; i < sellerIds.length; i++) {
        await admin.query("INSERT INTO treido.promotion_customer_bindings(id,seller_id,platform_account,livemode,environment,application_id,purpose,provider_id,approved_at) VALUES($1,$2,$3,false,'test',$4,'promotion',$5,clock_timestamp())", [randomUUID(), sellerIds[i], bridge.binding.platformAccount, bridge.binding.applicationId, "cus_T61PromotionFixture" + i]);
      }
      const commands = [];
      for (let i = 0; i < 2; i++) {
        const view = await readPromotions(database, identities[i], sellerIds[i]), campaignId = randomUUID();
        const saved = await executePromotion(database, identities[i], { actorKey: view.actorKey, sellerId: sellerIds[i], campaignId, expectedRevision: 0, requestId: randomUUID(), action: "save", listingId: listingIds[i], productId: terms.productId }, bridge);
        const reviewed = await executePromotion(database, identities[i], { actorKey: view.actorKey, sellerId: sellerIds[i], campaignId, expectedRevision: saved.revision, requestId: randomUUID(), action: "review", reason: "Synthetic capacity fixture" }, bridge);
        const review = (await admin.query("SELECT terms_hash AS hash FROM treido.promotion_reviews WHERE id=$1", [reviewed.reviewId])).rows[0];
        commands.push({ actorKey: view.actorKey, sellerId: sellerIds[i], campaignId, expectedRevision: reviewed.revision, requestId: randomUUID(), action: "purchase", reviewId: reviewed.reviewId, termsHash: review.hash, acknowledged: true, language: i === 0 ? "bg" : "en" });
      }
      const outcomes = await Promise.allSettled(commands.map((command, i) => executePromotion(database, identities[i], command, bridge)));
      expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect((outcomes.find(result => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "QUOTA_EXCEEDED" });
      const winner = outcomes.findIndex(result => result.status === "fulfilled"), result = (outcomes[winner] as PromiseFulfilledResult<Awaited<ReturnType<typeof executePromotion>>>).value;
      expect(result.state).toBe("awaiting_payment");
      const frozen = (await admin.query("SELECT a.intent,a.created_at,r.expires_at FROM treido.promotion_attempts a JOIN treido.promotion_reservations r ON r.campaign_id=a.campaign_id WHERE a.id=$1", [result.attemptId])).rows[0];
      expect(frozen.intent.language).toBe(commands[winner].language);
      expect(frozen.expires_at.toISOString()).toBe(frozen.intent.checkoutExpiresAt);
      expect(Date.parse(frozen.intent.checkoutExpiresAt) - frozen.created_at.getTime()).toBeGreaterThan(44 * 60 * 1000);
      expect(Date.parse(frozen.intent.checkoutExpiresAt) - frozen.created_at.getTime()).toBeLessThanOrEqual(45 * 60 * 1000);
      expect((await admin.query("SELECT count(*)::int AS n FROM treido.promotion_reservations WHERE capacity_id=$1 AND status='reserved'", [capacityId])).rows[0].n).toBe(1);
      expect(await executePromotion(database, identities[winner], commands[winner], bridge)).toEqual(result);
      expect((await admin.query("SELECT expires_at FROM treido.promotion_reservations WHERE campaign_id=$1", [commands[winner].campaignId])).rows[0].expires_at).toEqual(frozen.expires_at);
      // Explicit isolated lifecycle fixture: a potentially emitted effect has
      // been claimed. A never-attempted prepared cancellation is safely terminal
      // and must not be mislabelled uncertain. No provider adapter is invoked.
      expect((await get().runtime.query("UPDATE treido.promotion_attempts SET state='creating' WHERE id=$1 AND state='prepared' RETURNING id", [result.attemptId])).rowCount).toBe(1);
      const cancelled = await executePromotion(database, identities[winner], { actorKey: commands[winner].actorKey, sellerId: sellerIds[winner], campaignId: commands[winner].campaignId, expectedRevision: result.revision, requestId: randomUUID(), action: "cancel", reason: "Synthetic cancellation during uncertainty" }, bridge);
      expect(cancelled.state).toBe("reconciling");
      expect((await admin.query("SELECT status FROM treido.promotion_reservations WHERE campaign_id=$1", [commands[winner].campaignId])).rows[0].status).toBe("reserved");
      expect(providerCalls).toBe(0);
    });
  });
}
