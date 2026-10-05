import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { inTransaction } from "../../apps/web/src/server/db/database";
import * as backend from "../../apps/web/src/server/config/backend-bindings.server";
import * as jobs from "../../apps/web/src/server/jobs/config.server";
import { executeJob } from "../../apps/web/src/server/jobs/execution.server";
import { jobColumns, type SellerJobRow } from "../../apps/web/src/server/jobs/outbox.server";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import { changePaidOrder } from "../../apps/web/src/features/payments/orders.server";
import { prepareOrderRefund, executeOrderRefund } from "../../apps/web/src/features/order-aftercare/refund-commands.server";
import { readRefundIntent } from "../../apps/web/src/features/order-aftercare/refund-storage.server";
import { processOrderRefund } from "../../apps/web/src/features/order-aftercare/jobs.server";
import { executeOrderCase } from "../../apps/web/src/features/order-aftercare/cases.server";
import { authorizeAftercareOperator } from "../../apps/web/src/features/order-aftercare/operators.server";
import { submitOrderFeedback } from "../../apps/web/src/features/order-feedback/commands.server";
import { moderateOrderFeedback } from "../../apps/web/src/features/order-feedback/moderation.server";
import { readPublicOrderFeedback } from "../../apps/web/src/features/order-feedback/queries.server";
import { feedbackEligible } from "../../apps/web/src/features/order-feedback/storage.server";
import { aftercareActor, aftercareNamespace, aftercareLocalTransport, createAftercareFixture, withAftercareAdapters, type AftercareNativeContext } from "./aftercare-fixture";

/** Registered in remediation.integration.ts; execution remains held. Original source/SQL/jobs run only after reviewed
 * canonical adoption and ONE all-owner freeze. Every provider response, policy,
 * prior payment and recent-auth proof is an explicit isolated fixture. No real
 * approved financial service, transport, closure or paid reputation is claimed. */
export function defineAftercareFeedbackPersistenceCases(get: () => AftercareNativeContext) {
  type Fixture = Awaited<ReturnType<typeof createAftercareFixture>>;
  const revision = async (fixture: Fixture) => (await get().admin.query<{ revision: number }>("SELECT revision FROM treido.paid_orders WHERE id=$1", [fixture.orderId])).rows[0].revision;
  const prepare = async (fixture: Fixture, quantity = 1) => prepareOrderRefund(get().database, fixture.merchant.identity, {
    actorKey: libraryActorKey(fixture.merchant.identity), orderId: fixture.orderId, sellerId: fixture.sellerId,
    requestId: randomUUID(), expectedRevision: await revision(fixture), language: "en", action: "prepare_refund", caseId: null,
    reason: "SYNTHETIC owned native refund", selection: "lines", lines: [{ skuId: fixture.skuId, quantity }],
  });
  const executionCommand = (fixture: Fixture, intentId: string) => ({ actorKey: libraryActorKey(fixture.merchant.identity),
    orderId: fixture.orderId, sellerId: fixture.sellerId, requestId: randomUUID(), expectedRevision: 0, language: "en", action: "execute_refund", intentId });
  const observe = async (intentId: string) => {
    const job = (await get().admin.query<SellerJobRow>(`SELECT ${jobColumns} FROM treido.outbox_jobs WHERE resource_id=$1 AND kind='payment.aftercare' ORDER BY created_at DESC LIMIT 1`, [intentId])).rows[0];
    if (!job) throw Error("Original accepted aftercare job missing");
    expect(job).toMatchObject({ authority: "service", actorId: null });
    const event = { jobId: job.id, sellerId: job.sellerId, generation: job.generation, schemaVersion: 1, ...aftercareNamespace };
    return executeJob(get().database, event, aftercareNamespace, randomUUID(), {
      "payment.aftercare": context => processOrderRefund(get().database, context),
    });
  };
  const inventoryEvidence = async (fixture: Fixture) => (await get().admin.query<{ value: unknown }>(
    "SELECT jsonb_build_object('allocation',to_jsonb(a),'sku',to_jsonb(s)) AS value FROM treido.inventory_allocations a JOIN treido.inventory_skus s ON s.id=$2 WHERE a.id=$1", [fixture.allocationId, fixture.skuId])).rows[0].value;
  const feedbackCommand = async (fixture: Fixture) => ({ actorKey: libraryActorKey(fixture.buyer.identity), orderId: fixture.orderId,
    sellerId: null, requestId: randomUUID(), expectedRevision: await revision(fixture), rating: 4, body: "SYNTHETIC public purchase feedback", language: "en",
    policyId: fixture.feedbackId, version: 1, termsHash: fixture.feedbackHash, acknowledged: true });
  const publishFeedback = async (fixture: Fixture) => {
    const submitted = await submitOrderFeedback(get().database, fixture.buyer.identity, await feedbackCommand(fixture));
    const operator = await aftercareActor(get());
    await get().admin.query("INSERT INTO treido.order_aftercare_operator_grants(user_id,capability,environment,application_id,approved_at,approval_reference) VALUES($1,'feedback.moderate','test',$2,clock_timestamp(),'SYNTHETIC OWNED TEST ONLY')", [operator.userId, aftercareNamespace.applicationId]);
    await moderateOrderFeedback(get().database, operator.identity, { actorKey: libraryActorKey(operator.identity), feedbackId: submitted.feedbackId,
      requestId: randomUUID(), expectedRevision: 0, decision: "publish", reason: "SYNTHETIC explicit moderation" });
    return submitted;
  };
  describe("T61 native original-order aftercare and completed-purchase feedback", () => {
    it("later disputed-charge GET reconciles the same original refund while preserving the disputed blocked parent and immutable stock/hold", async () => {
      const local = aftercareLocalTransport();
      await withAftercareAdapters(local, async () => {
        const fixture = await createAftercareFixture(get(), local), inventory = await inventoryEvidence(fixture);
        const prepared = await prepare(fixture);
        if (!prepared.intentId) throw Error("Original refund intent missing");
        const command = executionCommand(fixture, prepared.intentId);
        await executeOrderRefund(get().database, fixture.merchant.identity, command);
        const original = await inTransaction(get().database, tx => readRefundIntent(tx, prepared.intentId!));
        if (!original) throw Error("Original accepted refund missing");
        const charge = local.charges.get(fixture.chargeId);
        if (!charge) throw Error("Original local charge fixture missing");
        expect(local.counts().posts).toBe(1);
        // Explicit prior observed dispute fixture, never a real webhook/provider
        // effect or a mocked refund apply. The original later charge GET carries
        // the same dispute and still validates exact refund/reversal/fee facts.
        await get().admin.query("UPDATE treido.paid_orders SET payment_state='disputed',fulfilment_state='blocked',settlement_state='reconciliation' WHERE id=$1", [fixture.orderId]);
        charge.disputed = true;
        local.succeed(original);
        const counts = local.counts();
        expect((await observe(original.id)).status).toBe("completed");
        const observed = await inTransaction(get().database, tx => readRefundIntent(tx, original.id));
        expect(observed).toMatchObject({ state: "succeeded", providerStatus: "succeeded", settlementState: "verified",
          operationKey: original.operationKey, parameterHash: original.parameterHash, parameters: original.parameters,
          expiresAt: original.expiresAt, firstAttemptAt: original.firstAttemptAt, amountMinor: 12900, feeMinor: 129 });
        expect((await get().admin.query("SELECT payment_state,fulfilment_state,settlement_state FROM treido.paid_orders WHERE id=$1", [fixture.orderId])).rows[0]).toEqual({ payment_state: "disputed", fulfilment_state: "blocked", settlement_state: "reconciliation" });
        expect((await get().admin.query("SELECT refund_fact FROM treido.order_refund_observations WHERE intent_id=$1", [original.id])).rows[0].refund_fact).toMatchObject({ chargeDisputed: true, reversalMinor: 12900, feeRefundedMinor: 129 });
        await expect(prepare(fixture)).rejects.toMatchObject({ code: "CONFLICT" });
        await executeOrderRefund(get().database, fixture.merchant.identity, command);
        expect(local.counts().posts).toBe(1);
        expect(local.counts().gets).toBeGreaterThan(counts.gets);
        expect(await inventoryEvidence(fixture)).toEqual(inventory);
      });
    });
    it("partial-vs-legacy-full race reserves the original balance only once under original allocation/order locks", async () => {
      const local = aftercareLocalTransport();
      await withAftercareAdapters(local, async () => {
        const fixture = await createAftercareFixture(get(), local);
        const result = await Promise.allSettled([
          prepare(fixture),
          changePaidOrder(get().database, fixture.merchant.identity, { actorKey: libraryActorKey(fixture.merchant.identity), id: fixture.orderId,
            sellerId: fixture.sellerId, requestId: randomUUID(), expectedRevision: 0, action: "refund", reason: "SYNTHETIC legacy full refund" }),
        ]);
        expect(result.filter(value => value.status === "fulfilled")).toHaveLength(1);
        expect(result.filter(value => value.status === "rejected")).toHaveLength(1);
        const rejected = result.find(value => value.status === "rejected");
        if (rejected?.status === "rejected") expect(["CONFLICT", "23514"]).toContain(rejected.reason.code);
        const rows = (await get().admin.query<{ partial: number; legacy: number; amount: number; quantity: number }>(
          "SELECT (SELECT count(*)::int FROM treido.order_refund_intents WHERE order_id=$1) AS partial,(SELECT count(*)::int FROM treido.payment_refunds WHERE order_id=$1) AS legacy,coalesce((SELECT sum(amount_minor)::int FROM treido.order_refund_intents WHERE order_id=$1),0) AS amount,coalesce((SELECT sum(l.quantity)::int FROM treido.order_refund_lines l JOIN treido.order_refund_intents r ON r.id=l.intent_id WHERE r.order_id=$1),0) AS quantity", [fixture.orderId])).rows[0];
        expect(rows.partial + rows.legacy).toBe(1);
        expect(rows.partial ? rows.amount : fixture.totalMinor).toBeLessThanOrEqual(fixture.totalMinor);
        expect(rows.quantity).toBeLessThanOrEqual(3); expect(local.counts().posts).toBe(0);
      });
    });
    it("three actual original partial intents conserve all units and cumulative original gross/fees without restock", async () => {
      const local = aftercareLocalTransport();
      await withAftercareAdapters(local, async () => {
        const fixture = await createAftercareFixture(get(), local), stockBefore = await inventoryEvidence(fixture);
        for (let unit = 0; unit < 3; unit++) {
          const prepared = await prepare(fixture); if (!prepared.intentId) throw Error("Original refund intent missing");
          const line = (await get().admin.query("SELECT from_quantity,quantity,amount_minor,fee_minor FROM treido.order_refund_lines WHERE intent_id=$1", [prepared.intentId])).rows[0];
          expect(line).toMatchObject({ from_quantity: unit, quantity: 1, amount_minor: 12900, fee_minor: 129 });
          await executeOrderRefund(get().database, fixture.merchant.identity, executionCommand(fixture, prepared.intentId));
          const row = await inTransaction(get().database, tx => readRefundIntent(tx, prepared.intentId!));
          if (!row) throw Error("Original accepted refund disappeared");
          // Synthetic exact provider GET facts pass the ORIGINAL SDK adapter,
          // metadata/charge/reversal/fee parser and actual leased native apply.
          local.succeed(row);
          expect((await observe(row.id)).status).toBe("completed");
          expect((await get().admin.query("SELECT state,settlement_state FROM treido.order_refund_intents WHERE id=$1", [row.id])).rows[0]).toMatchObject({ state: "succeeded", settlement_state: "verified" });
        }
        const totals = (await get().admin.query("SELECT sum(amount_minor)::int AS amount,sum(fee_minor)::int AS fee FROM treido.order_refund_intents WHERE order_id=$1", [fixture.orderId])).rows[0];
        expect(totals).toEqual({ amount: fixture.totalMinor, fee: fixture.feeMinor });
        expect(await inventoryEvidence(fixture)).toEqual(stockBefore);
        await expect(prepare(fixture)).rejects.toMatchObject({ code: "CONFLICT" });
        expect(local.counts().posts).toBe(3);
      });
    });
    it("uncertain original intent replays without another POST/hold extension/restock; accepted service GET survives later restricted humans", async () => {
      const local = aftercareLocalTransport();
      await withAftercareAdapters(local, async () => {
        const fixture = await createAftercareFixture(get(), local), stockBefore = await inventoryEvidence(fixture), prepared = await prepare(fixture);
        if (!prepared.intentId) throw Error("Original refund intent missing");
        const command = executionCommand(fixture, prepared.intentId), first = await executeOrderRefund(get().database, fixture.merchant.identity, command);
        const intentBefore = (await get().admin.query("SELECT * FROM treido.order_refund_intents WHERE id=$1", [prepared.intentId])).rows[0];
        expect(intentBefore.state).toBe("reconciling"); expect(intentBefore.first_attempt_at).toBeInstanceOf(Date);
        expect(await executeOrderRefund(get().database, fixture.merchant.identity, command)).toEqual(first);
        expect(local.counts().posts).toBe(1);
        expect((await get().admin.query("SELECT * FROM treido.order_refund_intents WHERE id=$1", [prepared.intentId])).rows[0]).toEqual(intentBefore);
        await expect(prepare(fixture)).rejects.toMatchObject({ code: "CONFLICT" });
        // Synthetic later lifecycle restriction fixture, not an actual approved
        // closure or a generic permission to run optional inactive-user work.
        await get().admin.query("UPDATE treido.users SET status='restricted' WHERE id=ANY($1::uuid[])", [[fixture.buyer.userId, fixture.merchant.userId]]);
        await expect(executeOrderCase(get().database, fixture.buyer.identity, { actorKey: libraryActorKey(fixture.buyer.identity), orderId: fixture.orderId, sellerId: null,
          requestId: randomUUID(), expectedRevision: await revision(fixture), language: "en", action: "open", reason: "other", body: "SYNTHETIC new optional request", evidence: [],
          servicePolicyId: fixture.serviceId, servicePolicyVersion: 1, serviceTermsHash: fixture.serviceHash, acknowledged: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect((await observe(prepared.intentId)).status).toBe("completed");
        const after = (await get().admin.query("SELECT state,expires_at,operation_key,parameter_hash FROM treido.order_refund_intents WHERE id=$1", [prepared.intentId])).rows[0];
        expect(after).toMatchObject({ state: "reconciling", expires_at: intentBefore.expires_at, operation_key: intentBefore.operation_key, parameter_hash: intentBefore.parameter_hash });
        expect(local.counts().posts).toBe(1); expect(await inventoryEvidence(fixture)).toEqual(stockBefore);
      });
    });
    it("foreign buyer/seller, finite order-only membership and support-only operator grants grant no refund or moderation authority", async () => {
      const local = aftercareLocalTransport();
      await withAftercareAdapters(local, async () => {
        const fixture = await createAftercareFixture(get(), local), foreign = await aftercareActor(get());
        await expect(submitOrderFeedback(get().database, foreign.identity, { ...await feedbackCommand(fixture), actorKey: libraryActorKey(foreign.identity) })).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(prepareOrderRefund(get().database, foreign.identity, { actorKey: libraryActorKey(foreign.identity), orderId: fixture.orderId, sellerId: fixture.sellerId,
          requestId: randomUUID(), expectedRevision: 0, language: "en", action: "prepare_refund", caseId: null, reason: "SYNTHETIC foreign", selection: "remaining", lines: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
        await get().admin.query("INSERT INTO treido.seller_memberships(seller_id,user_id,role,status,grants) VALUES($1,$2,'member','active',$3::jsonb)", [fixture.sellerId, foreign.userId, JSON.stringify(["order.read", "order.fulfil"])]);
        await expect(prepareOrderRefund(get().database, foreign.identity, { actorKey: libraryActorKey(foreign.identity), orderId: fixture.orderId, sellerId: fixture.sellerId,
          requestId: randomUUID(), expectedRevision: 0, language: "en", action: "prepare_refund", caseId: null, reason: "SYNTHETIC finite grants", selection: "remaining", lines: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
        await get().admin.query("INSERT INTO treido.order_aftercare_operator_grants(user_id,capability,environment,application_id,approved_at,approval_reference) VALUES($1,'cases.read','test',$2,clock_timestamp(),'SYNTHETIC OWNED TEST ONLY')", [foreign.userId, aftercareNamespace.applicationId]);
        await expect(inTransaction(get().database, tx => authorizeAftercareOperator(tx, foreign.identity, "feedback.moderate", true))).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(inTransaction(get().database, tx => authorizeAftercareOperator(tx, foreign.identity, "cases.decide", true))).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect((await get().admin.query("SELECT count(*)::int AS n FROM treido.order_refund_intents WHERE order_id=$1", [fixture.orderId])).rows[0].n).toBe(0);
        expect((await get().admin.query("SELECT count(*)::int AS n FROM treido.order_purchase_feedback WHERE order_id=$1", [fixture.orderId])).rows[0].n).toBe(0);
        expect(local.counts().posts).toBe(0);
      });
    });
    it("only actual eligible submitted and explicitly moderated purchase feedback is public, with anonymous minimal fields", async () => {
      const local = aftercareLocalTransport();
      await withAftercareAdapters(local, async () => {
        const fixture = await createAftercareFixture(get(), local);
        const command = await feedbackCommand(fixture), submitted = await submitOrderFeedback(get().database, fixture.buyer.identity, command);
        expect(await submitOrderFeedback(get().database, fixture.buyer.identity, command)).toEqual(submitted);
        expect((await readPublicOrderFeedback(get().database, fixture.sellerId)).feedback).toEqual([]);
        const operator = await aftercareActor(get());
        await get().admin.query("INSERT INTO treido.order_aftercare_operator_grants(user_id,capability,environment,application_id,approved_at,approval_reference) VALUES($1,'feedback.moderate','test',$2,clock_timestamp(),'SYNTHETIC OWNED TEST ONLY')", [operator.userId, aftercareNamespace.applicationId]);
        await moderateOrderFeedback(get().database, operator.identity, { actorKey: libraryActorKey(operator.identity), feedbackId: submitted.feedbackId, requestId: randomUUID(), expectedRevision: 0, decision: "publish", reason: "SYNTHETIC explicit moderation" });
        const visible = (await readPublicOrderFeedback(get().database, fixture.sellerId)).feedback;
        expect(visible).toHaveLength(1); expect(visible[0]).toMatchObject({ id: submitted.feedbackId, verification: "completed_order", reviewer: "anonymous_buyer" });
        expect(Object.keys(visible[0]).sort()).toEqual(["body", "id", "publishedAt", "rating", "reviewer", "verification"]);
        const text = JSON.stringify(visible);
        for (const privateValue of [fixture.buyer.identity.subject, fixture.buyer.userId, fixture.orderId, fixture.quoteId, fixture.chargeId]) expect(text).not.toContain(privateValue);
      });
    });
    it("a paid order label without exact original charge evidence cannot create or expose purchase feedback", async () => {
      const local = aftercareLocalTransport();
      await withAftercareAdapters(local, async () => {
        const fixture = await createAftercareFixture(get(), local, { chargeEvidence: false });
        expect(await feedbackEligible(get().admin, fixture.orderId)).toBe(false);
        await expect(submitOrderFeedback(get().database, fixture.buyer.identity, await feedbackCommand(fixture))).rejects.toMatchObject({ code: "CONFLICT" });
        expect((await readPublicOrderFeedback(get().database, fixture.sellerId)).feedback).toEqual([]);
      });
    });
    it.each(["not-paid", "not-settled", "not-fulfilled", "open-case", "unknown-refund", "restricted-seller", "hidden-publication", "wrong-app", "wrong-env", "revoked-policy", "revoked-base-policy"] as const)(
      "published historical feedback is hidden when current %s gate fails", async condition => {
        const local = aftercareLocalTransport();
        await withAftercareAdapters(local, async () => {
          const fixture = await createAftercareFixture(get(), local); await publishFeedback(fixture);
          expect((await readPublicOrderFeedback(get().database, fixture.sellerId)).feedback).toHaveLength(1);
          if (condition === "not-paid") await get().admin.query("UPDATE treido.paid_orders SET payment_state='disputed' WHERE id=$1", [fixture.orderId]);
          else if (condition === "not-settled") await get().admin.query("UPDATE treido.paid_orders SET settlement_state='reconciliation' WHERE id=$1", [fixture.orderId]);
          else if (condition === "not-fulfilled") await get().admin.query("UPDATE treido.paid_orders SET fulfilment_state='pending' WHERE id=$1", [fixture.orderId]);
          else if (condition === "open-case") await executeOrderCase(get().database, fixture.buyer.identity, { actorKey: libraryActorKey(fixture.buyer.identity), orderId: fixture.orderId, sellerId: null,
            requestId: randomUUID(), expectedRevision: await revision(fixture), language: "en", action: "open", reason: "other", body: "SYNTHETIC current open case", evidence: [],
            servicePolicyId: fixture.serviceId, servicePolicyVersion: 1, serviceTermsHash: fixture.serviceHash, acknowledged: true });
          else if (condition === "unknown-refund") { const intent = await prepare(fixture); if (!intent.intentId) throw Error("Original intent missing"); await executeOrderRefund(get().database, fixture.merchant.identity, executionCommand(fixture, intent.intentId)); }
          else if (condition === "restricted-seller") await get().admin.query("UPDATE treido.seller_accounts SET status='restricted' WHERE id=$1", [fixture.sellerId]);
          else if (condition === "hidden-publication") await get().admin.query("UPDATE treido.listings SET publication='withdrawn' WHERE id=$1", [fixture.listingId]);
          else if (condition === "wrong-app") vi.mocked(jobs.requireJobBindings).mockReturnValue({ ...jobs.requireJobBindings(), applicationId: "t61-other-app" });
          else if (condition === "wrong-env") vi.mocked(backend.requireBackendBindings).mockReturnValue({ ...backend.requireBackendBindings(), environment: "preview" });
          else if (condition === "revoked-policy") await get().admin.query("UPDATE treido.order_feedback_policies SET revoked_at=clock_timestamp() WHERE id=$1", [fixture.feedbackId]);
          else await get().admin.query("UPDATE treido.payment_policies SET revoked_at=clock_timestamp() WHERE id=$1", [fixture.policyId]);
          expect((await readPublicOrderFeedback(get().database, fixture.sellerId)).feedback).toEqual([]);
          expect((await get().admin.query("SELECT state FROM treido.order_purchase_feedback WHERE order_id=$1", [fixture.orderId])).rows[0].state).toBe("published");
        });
      },
    );
  });
}
