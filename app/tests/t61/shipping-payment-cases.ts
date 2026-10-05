import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inTransaction } from "../../apps/web/src/server/db/database";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import { createPayableQuote, readPayableQuote } from "../../apps/web/src/features/payments/quotes.server";
import { changePaidOrder } from "../../apps/web/src/features/payments/orders.server";
import { executeShippingCommand, recoverShippingRequest } from "../../apps/web/src/features/order-shipping/commands.server";
import { readShippingContext, readShippingReview } from "../../apps/web/src/features/order-shipping/queries.server";
import { expireUnboundShippingInput, readShippingLifecycleFacts } from "../../apps/web/src/features/order-shipping/lifecycle.server";
import { readRefundIntent } from "../../apps/web/src/features/order-aftercare/refund-storage.server";
import { readObligations } from "../../apps/web/src/features/account-closure/obligations.server";
import type { createShippingPaymentFixture, ShippingFixtureOptions } from "./shipping-payment-fixture";
type Fixture = Awaited<ReturnType<typeof createShippingPaymentFixture>>;
type Get = (kind: "cart" | "offer", options?: ShippingFixtureOptions) => Promise<Fixture>;
const accepted = async (f: Fixture) => f.accept(await f.prepare());
const paid = async (f: Fixture) => { const input = await accepted(f), quote = await f.createQuote(input.choice), order = await f.pay(quote.id); return { input, quote, order }; };
const evidence = async (f: Fixture, choiceId: string) => (await f.admin.query<{ value: unknown }>(
  "SELECT jsonb_build_object('choice',to_jsonb(c),'recipient',to_jsonb(r),'receipts',(SELECT jsonb_agg(to_jsonb(receipt) ORDER BY request_id) FROM treido.order_shipping_receipts receipt WHERE choice_id=c.id)) AS value FROM treido.order_shipping_choices c JOIN treido.order_shipping_recipients r ON r.choice_id=c.id WHERE c.id=$1", [choiceId],
)).rows[0].value;

/** Registered original canonical cases; next native callbacks remain UNRUN. Synthetic
 * registry/SDK fixtures remain distinct from real provider approval. The finite
 * tests allow90s because the actual native policy minimum is60s; timestamps and
 * existing global resource/bootstrap/check guards stay unchanged. */
export function defineShippingPaymentCases(get: Get) {
  describe("native original canonical shipping quote and order pipeline", () => {
    for (const kind of ["cart", "offer"] as const) {
      it(`${kind}: original quote freezes literal components and original source/allocation/deadline`, async () => {
        const f = await get(kind), input = await accepted(f);
        const original = kind === "offer" ? (await f.admin.query("SELECT id,expires_at,expires_at::text AS expiry_exact FROM treido.inventory_allocations WHERE purpose='offer' AND source_id=$1", [f.source.kind === "offer" ? f.source.offerId : null])).rows[0] : null;
        const quote = await f.createQuote(input.choice);
        const row = (await f.admin.query<{ allocation_id: string; expires_at: Date; total_minor: number; delivery_minor: number; buyer_fee_minor: number; application_fee_minor: number }>("SELECT allocation_id,expires_at,total_minor,delivery_minor,buyer_fee_minor,application_fee_minor FROM treido.payable_quotes WHERE id=$1", [quote.id])).rows[0];
        expect(row).toMatchObject({ total_minor: kind === "cart" ? 39400 : 33700, delivery_minor: 700, buyer_fee_minor: 0, application_fee_minor: kind === "cart" ? 387 : 330 });
        const hold = (await f.admin.query("SELECT expires_at,state FROM treido.inventory_allocations WHERE id=$1", [row.allocation_id])).rows[0];
        expect(row.expires_at).toEqual(hold.expires_at);
        expect(hold.state).toBe("active");
        // T61 exact-clock regression: compare PostgreSQL values before Date conversion.
        const exactClock = (await f.admin.query("SELECT q.expires_at=a.expires_at AS same_clock,a.expires_at::text AS allocation_clock FROM treido.payable_quotes q JOIN treido.inventory_allocations a ON a.id=q.allocation_id WHERE q.id=$1", [quote.id])).rows[0];
        expect(exactClock.same_clock).toBe(true);
        if (original) expect(exactClock.allocation_clock).toBe(original.expiry_exact);
        // End T61 exact-clock regression.
        if (original) { expect(row.allocation_id).toBe(original.id); expect(row.expires_at).toEqual(original.expires_at); }
        else expect(row.expires_at.getTime()).toBeGreaterThan(new Date(input.review.expiresAt).getTime());
        const view = await readPayableQuote(f.database, f.buyer.identity, quote.id);
        expect(view).toMatchObject({ merchandiseMinor: kind === "cart" ? 38700 : 33000, shippingMinor: 700, buyerFeeMinor: 0,
          terms: { handover: "shipping", shipping: { costs: { taxMinor: null, taxBasis: "inclusive_unspecified" } }, aftercare: { method: "shipping", policyId: f.financialId, termsHash: f.financialHash } } });
        expect(view.lines).toMatchObject([f.line]);
      });
      it(`${kind}: source replay after policy revocation preserves bound quote, recipient and original hold`, async () => {
        const f = await get(kind), input = await accepted(f), quote = await f.createQuote(input.choice);
        const before = await f.commerceSnapshot(), privateBefore = await evidence(f, input.choice.id);
        await f.revokePolicy();
        const again = await createPayableQuote(f.database, f.buyer.identity, { ...quote.request, requestId: randomUUID() });
        expect(again.id).toBe(quote.id);
        expect(await f.commerceSnapshot()).toEqual(before);
        expect(await evidence(f, input.choice.id)).toEqual(privateBefore);
        expect(f.local.counts().posts).toBe(0);
      });
      it(`${kind}: original beginPayment and original leased observation settle the exact original allocation`, async () => {
        const f = await get(kind), result = await paid(f);
        const state = (await f.admin.query("SELECT a.state,a.resolution_reference,p.provider_id,p.state AS payment_state FROM treido.inventory_allocations a JOIN treido.payable_quotes q ON q.allocation_id=a.id JOIN treido.payment_attempts p ON p.quote_id=q.id WHERE q.id=$1", [result.quote.id])).rows[0];
        expect(state.state).toBe("consumed"); expect(state.payment_state).toBe("paid");
        expect(state.resolution_reference).toBe("stripe:" + state.provider_id);
        expect(f.local.counts().posts).toBe(1);
        await f.runPaymentObservation(result.order.attemptId);
        expect(f.local.counts().posts).toBe(1);
      });
    }
    it("missing policy, missing current retention, unsupported numeric tax and positive buyer fee fail before recipient writes", async () => {
      for (const options of [{ missingPolicy: true }, { missingRetention: true }, { taxBasis: "inclusive_known" as const }, { buyerFeeMinor: 500 }]) {
        const f = await get("cart", options), before = await f.commerceSnapshot();
        expect((await readShippingContext(f.database, f.buyer.identity, f.source, "en")).available).toBe(false);
        await expect(executeShippingCommand(f.database, f.buyer.identity, f.command)).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
        expect(await f.commerceSnapshot()).toEqual(before);
        expect((await f.admin.query("SELECT choice_id FROM treido.order_shipping_recipients WHERE buyer_id=$1", [f.buyer.userId])).rowCount).toBe(0);
        expect(f.local.counts().posts).toBe(0);
      }
    });
    it("double preparation recovers one actual recipient and changed recipient cannot reuse the original request", async () => {
      const f = await get("cart"), before = await f.commerceSnapshot();
      const [a, b] = await Promise.all([f.prepare(), f.prepare()]);
      expect(a.choice.id).toBe(b.choice.id);
      expect(await recoverShippingRequest(f.database, f.buyer.identity, { actorKey: f.command.actorKey, requestId: f.command.requestId })).toMatchObject({ found: true, id: a.choice.id });
      await expect(executeShippingCommand(f.database, f.buyer.identity, { ...a.request, recipient: { ...a.request.recipient, name: "Changed private input" } })).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await f.admin.query("SELECT choice_id FROM treido.order_shipping_recipients WHERE buyer_id=$1", [f.buyer.userId])).rowCount).toBe(1);
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("missing explicit purpose consent cannot create a recipient", async () => {
      const f = await get("cart");
      await expect(executeShippingCommand(f.database, f.buyer.identity, { ...f.command, acknowledgedPurpose: false })).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect((await f.admin.query("SELECT choice_id FROM treido.order_shipping_recipients WHERE buyer_id=$1", [f.buyer.userId])).rowCount).toBe(0);
    });
    it("foreign review ID and stale acceptance revision fail on original authority", async () => {
      const f = await get("cart"), prepared = await f.prepare();
      await expect(readShippingReview(f.database, f.foreign.identity, prepared.choice.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(executeShippingCommand(f.database, f.buyer.identity, { action: "accept", actorKey: f.command.actorKey, requestId: randomUUID(), choice: { ...prepared.choice, revision: 99 } })).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("current tariff revocation prevents first acceptance without rewriting frozen costs", async () => {
      const f = await get("cart"), prepared = await f.prepare(), before = await evidence(f, prepared.choice.id);
      await f.admin.query("UPDATE treido.order_shipping_rates SET revoked_at=clock_timestamp() WHERE id=$1", [f.rateId]);
      await expect(f.accept(prepared)).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      expect(await evidence(f, prepared.choice.id)).toEqual(before);
    });
    it("tariff insufficient for the original new hold rejects and rolls back the whole quote transaction", async () => {
      const f = await get("cart", { shortTariff: true }), input = await accepted(f), before = await f.commerceSnapshot();
      await expect(f.createQuote(input.choice)).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("original reviewed language and accepted financial hash cannot change at quote binding", async () => {
      const f = await get("cart"), input = await accepted(f), before = await f.commerceSnapshot();
      await expect(createPayableQuote(f.database, f.buyer.identity, { ...f.quoteCommand(input.choice), language: "bg" })).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      await expect(createPayableQuote(f.database, f.buyer.identity, { ...f.quoteCommand(input.choice), aftercare: { policyId: f.financialId, version: 1, termsHash: "0".repeat(64), acknowledged: true } })).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("a fresh object with the same subject lacks actual registered recent proof for shipping quote", async () => {
      const f = await get("cart"), input = await accepted(f), before = await f.commerceSnapshot();
      await expect(createPayableQuote(f.database, { subject: f.buyer.identity.subject }, f.quoteCommand(input.choice))).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("shipping paid orders reject all three legacy pickup/full-refund server actions without another POST", async () => {
      const f = await get("cart"), result = await paid(f), before = await f.commerceSnapshot();
      for (const action of ["ready", "collected", "refund"] as const) {
        const identity = action === "collected" ? f.buyer.identity : f.merchant.identity;
        await expect(changePaidOrder(f.database, identity, { actorKey: libraryActorKey(identity), requestId: randomUUID(), id: result.order.orderId,
          sellerId: action === "collected" ? null : f.sellerId, expectedRevision: result.order.revision, action, reason: action === "refund" ? "Synthetic original request" : "" })).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      }
      expect(await f.commerceSnapshot()).toEqual(before);
      expect(f.local.counts().posts).toBe(1);
      expect((await f.admin.query("SELECT id FROM treido.payment_refunds WHERE order_id=$1", [result.order.orderId])).rowCount).toBe(0);
    });
    it("shipping-only reservation uses literal700 component and original full-charge7 fee share without a fake SKU", async () => {
      const f = await get("cart"), result = await paid(f);
      const refund = await f.refund(result.order.orderId, true, false, result.order.revision);
      const row = await inTransaction(f.database, tx => readRefundIntent(tx, refund.intentId!));
      expect(row).toMatchObject({ amountMinor: 700, feeMinor: 7, state: "prepared", firstAttemptAt: null });
      expect((await f.admin.query("SELECT amount_minor,fee_minor,tax_basis,fulfilment_stage,fulfilment_revision FROM treido.order_refund_shipping_components WHERE intent_id=$1", [refund.intentId])).rows).toEqual([{ amount_minor: 700, fee_minor: 7, tax_basis: "inclusive_unspecified", fulfilment_stage: "before_dispatch", fulfilment_revision: 0 }]);
      expect((await f.admin.query("SELECT sku_id FROM treido.order_refund_lines WHERE intent_id=$1", [refund.intentId])).rowCount).toBe(0);
      await expect(f.refund(result.order.orderId, true, false, result.order.revision)).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("uncertain whole-charge refund keeps original SKU and shipping reservations, then original GET settles without another POST", async () => {
      const f = await get("cart"), result = await paid(f), refund = await f.refund(result.order.orderId, true, true, result.order.revision);
      expect(await inTransaction(f.database, tx => readRefundIntent(tx, refund.intentId!))).toMatchObject({ amountMinor: 39400, feeMinor: 387 });
      await f.emitRefund(result.order.orderId, refund.intentId!, refund.revision);
      const original = await inTransaction(f.database, tx => readRefundIntent(tx, refund.intentId!));
      expect(original).toMatchObject({ state: "reconciling", amountMinor: 39400, feeMinor: 387 });
      expect(original.firstAttemptAt).not.toBeNull();
      await expect(f.refund(result.order.orderId, true, true, 1)).rejects.toMatchObject({ code: "CONFLICT" });
      const before = f.local.counts().posts;
      await f.reconcileRefund(refund.intentId!);
      const settled = await inTransaction(f.database, tx => readRefundIntent(tx, refund.intentId!));
      expect(settled).toMatchObject({ state: "succeeded", providerStatus: "succeeded", settlementState: "verified", amountMinor: 39400, feeMinor: 387, operationKey: original.operationKey, expiresAt: original.expiresAt, firstAttemptAt: original.firstAttemptAt });
      expect(f.local.counts().posts).toBe(before);
    });
    it("authoritative dispatch locks the accepted nonrefundable shipping component", async () => {
      const f = await get("cart"), result = await paid(f), fulfilled = await f.fulfil(result.order.orderId);
      await expect(f.refund(result.order.orderId, true, false, fulfilled.revision)).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      expect((await f.admin.query("SELECT id FROM treido.order_refund_intents WHERE order_id=$1", [result.order.orderId])).rowCount).toBe(0);
    });
    it("original due unbound cleanup rejects wrong token, rolls apply back on fault, then completes with real lease", async () => {
      const f = await get("cart"), input = await f.prepare(), before = await evidence(f, input.choice.id), fault = Error("T61 owned post-apply rollback fault");
      await expect(f.runFinite(input.choice.id, "shipping.input-expiry", async (job, tx) => {
        if (job.kind !== "shipping.input-expiry") throw Error("Wrong real original lease");
        await expect(expireUnboundShippingInput(tx, { ...job, executionToken: randomUUID() })).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect((await tx.client.query("SELECT value FROM treido.order_shipping_recipients WHERE choice_id=$1", [input.choice.id])).rows[0].value).not.toBeNull();
      }, fault)).rejects.toBe(fault);
      expect(await evidence(f, input.choice.id)).toEqual(before);
      expect((await f.runFinite(input.choice.id, "shipping.input-expiry")).status).toBe("completed");
      expect((await f.admin.query("SELECT value FROM treido.order_shipping_recipients WHERE choice_id=$1", [input.choice.id])).rows[0].value).toBeNull();
      expect(f.local.counts().posts).toBe(0);
    }, 90000);
    it("original due accepted cleanup keeps immutable paid quote/history and clears only genuinely resolved private evidence", async () => {
      const f = await get("cart"), result = await paid(f);
      expect((await inTransaction(f.database, tx => readObligations(tx, f.buyer.userId))).orders).toBe(1);
      await expect(inTransaction(f.database, tx => tx.client.query("SELECT treido.account_assert_clear($1::uuid)", [f.buyer.userId]))).rejects.toMatchObject({ code: "55000" });
      await f.fulfil(result.order.orderId, async () => {
        expect((await inTransaction(f.database, tx => readObligations(tx, f.buyer.userId))).orders).toBe(1);
        await expect(inTransaction(f.database, tx => tx.client.query("SELECT treido.account_assert_clear($1::uuid)", [f.buyer.userId]))).rejects.toMatchObject({ code: "55000" });
      });
      const before = await f.commerceSnapshot();
      expect((await f.runFinite(result.input.choice.id, "shipping.recipient-expiry")).status).toBe("completed");
      expect((await f.admin.query("SELECT value FROM treido.order_shipping_recipients WHERE choice_id=$1", [result.input.choice.id])).rows[0].value).toBeNull();
      expect(await f.commerceSnapshot()).toEqual(before);
      expect(await inTransaction(f.database, tx => readShippingLifecycleFacts(tx, f.buyer.userId))).toEqual({ unboundPrivateInputs: 0, unconfirmedShipping: 0, unresolvedRefunds: 0, retainedAcceptedRecipients: 0 });
      expect((await f.admin.query("SELECT id FROM treido.order_shipping_choices WHERE id=$1 AND state='bound' AND quote_id=$2", [result.input.choice.id, result.quote.id])).rowCount).toBe(1);
      // The actual core closure function must recognize authoritative delivery;
      // checking only the shipping/aftercare helper would miss the pickup count.
      const facts = await inTransaction(f.database, tx => readObligations(tx, f.buyer.userId));
      expect(facts).toMatchObject({ orders: 0, cases: 0, legalHolds: 0 });
      for (const count of Object.values(facts)) expect(count).toBe(0);
      await inTransaction(f.database, tx => tx.client.query("SELECT treido.account_assert_clear($1::uuid)", [f.buyer.userId]));
      const legacy = (await f.admin.query<{ revision: number; fulfilment_state: string; payment_state: string; settlement_state: string }>(
        "SELECT revision,fulfilment_state,payment_state,settlement_state FROM treido.paid_orders WHERE id=$1", [result.order.orderId])).rows[0];
      expect(legacy).toMatchObject({ fulfilment_state: "pending", payment_state: "paid", settlement_state: "transferred" });
      await expect(changePaidOrder(f.database, f.buyer.identity, { actorKey: libraryActorKey(f.buyer.identity), requestId: randomUUID(),
        id: result.order.orderId, sellerId: null, expectedRevision: legacy.revision, action: "collected", reason: "" })).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      expect((await f.admin.query("SELECT fulfilment_state FROM treido.paid_orders WHERE id=$1", [result.order.orderId])).rows[0].fulfilment_state).toBe("pending");
    }, 90000);
    it("resolved original component refund and due cleanup cannot evade exact mapped shipping legal holds", async () => {
      const f = await get("cart"), result = await paid(f);
      const refund = await f.refund(result.order.orderId, true, true, result.order.revision);
      await f.emitRefund(result.order.orderId, refund.intentId!, refund.revision);
      const uncertain = await inTransaction(f.database, tx => readObligations(tx, f.buyer.userId));
      expect(uncertain.orders).toBe(1);
      expect(uncertain.cases).toBeGreaterThan(0);
      await expect(inTransaction(f.database, tx => tx.client.query("SELECT treido.account_assert_clear($1::uuid)", [f.buyer.userId]))).rejects.toMatchObject({ code: "55000" });
      await f.reconcileRefund(refund.intentId!);
      expect(await inTransaction(f.database, tx => readRefundIntent(tx, refund.intentId!))).toMatchObject({
        state: "succeeded", providerStatus: "succeeded", settlementState: "verified", amountMinor: 39400, feeMinor: 387,
      });
      expect((await f.runFinite(result.input.choice.id, "shipping.recipient-expiry")).status).toBe("completed");
      const read = (userId = f.buyer.userId) => inTransaction(f.database, tx => readObligations(tx, userId));
      const clear = () => inTransaction(f.database, tx => tx.client.query("SELECT treido.account_assert_clear($1::uuid)", [f.buyer.userId]));
      const before = await read();
      for (const count of Object.values(before)) expect(count).toBe(0);
      await clear();
      expect(f.scope.applicationId).not.toBe("app_T61Native");
      const active = [randomUUID(), randomUUID()];
      // Isolated immutable fixture approvals target the exact real paid order
      // and buyer in its actual mapped shipping payment namespace.
      for (const [id, userId, orderId, application, future, revoked] of [
        [active[0], null, result.order.orderId, f.scope.applicationId, false, false],
        [active[1], f.buyer.userId, null, f.scope.applicationId, false, false],
        [randomUUID(), f.buyer.userId, null, "unrelated-t61", false, false],
        [randomUUID(), f.buyer.userId, null, f.scope.applicationId, true, false],
        [randomUUID(), f.buyer.userId, null, f.scope.applicationId, false, true],
      ] as const) {
        await f.admin.query(`INSERT INTO treido.order_aftercare_legal_holds(id,user_id,order_id,environment,application_id,approved_at,approval_reference,revoked_at)
          VALUES($1,$2,$3,'test',$4,clock_timestamp()+make_interval(secs=>$5),'SYNTHETIC OWNED SHIPPING CLOSURE HOLD',CASE WHEN $6 THEN clock_timestamp() ELSE NULL END)`,
        [id, userId, orderId, application, future ? 86400 : -1, revoked]);
      }
      expect(await read()).toEqual({ ...before, legalHolds: 2 });
      expect((await read(f.merchant.userId)).legalHolds).toBe(1);
      expect((await read(f.foreign.userId)).legalHolds).toBe(0);
      await expect(clear()).rejects.toMatchObject({ code: "55000" });
      await f.admin.query("UPDATE treido.order_aftercare_legal_holds SET revoked_at=clock_timestamp() WHERE id=ANY($1::uuid[]) AND revoked_at IS NULL", [active]);
      expect(await read()).toEqual(before);
      await clear();
      expect(f.local.counts().posts).toBe(2);
    }, 90000);
  });
}
