import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type Stripe from "stripe";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { executeOrderCase, recoverOrderAftercare } from "./cases.server";
import { executeOrderRefund } from "./refund-commands.server";
import { changePaidOrder, readPaidOrders } from "../payments/orders.server";
import { prepareOrderRefund } from "./refund-commands.server";
import { readOrderAftercare } from "./queries.server";
import { submitOrderFeedback } from "../order-feedback/commands.server";
import { readPublicOrderFeedback } from "../order-feedback/queries.server";
import {
  applyPaymentObservation,
  paymentFacts,
} from "../payments/settlement.server";
import { attemptColumns, type AttemptRow } from "../payments/attempts.server";
import type { PaymentBindings } from "../payments/bindings.server";
import { processOrderRefund, scheduleOrderRefundRepair } from "./jobs.server";
import { readRefundIntent, type RefundIntent } from "./refund-storage.server";
import * as refundProvider from "./refund-provider.server";
import { jobColumns, type SellerJobRow } from "../../server/jobs/outbox.server";
import type { EffectResult } from "../../server/jobs/execution.server";
export type AftercareFixtureName =
  | "foreign-participant"
  | "case-replay"
  | "stale-case"
  | "no-recent-auth"
  | "legacy-no-partial"
  | "refund-replay"
  | "refund-reserved"
  | "feedback-replay"
  | "public-restricted"
  | "public-withdrawn"
  | "accepted-after-restriction"
  | "first-settlement-inactive"
  | "one-post-unknown"
  | "stale-refund-observation"
  | "late-refund-acknowledgment"
  | "refund-repair-fairness"
  | "active-refund-repair-fairness";
export type AftercareNativeFixture = {
  database: SellerDatabase;
  admin: Pool;
  buyer: VerifiedIdentity;
  merchant: VerifiedIdentity;
  foreign: VerifiedIdentity;
  buyerId: string;
  merchantId: string;
  sellerId: string;
  orderId: string;
  quoteId: string;
  attemptId: string;
  allocationId: string;
  skuId: string;
  orderRevision: number;
  service: { id: string; version: number; termsHash: string };
  feedback: { id: string; version: number; termsHash: string };
  withUnknownProvider: <T>(body: () => Promise<T>) => Promise<T>;
  providerCounts: () => { posts: number; reads: number };
  runRefundJob: (intentId: string) => Promise<void>;
  payment: {
    intent: Stripe.PaymentIntent;
    binding: PaymentBindings;
    observation: Awaited<ReturnType<typeof paymentFacts>>;
  };
};
/** T61 supplies fresh disposable native PostgreSQL fixtures using original publication,
 * inventory, quote/accepted terms and current role/policy fixtures. Provider adapters
 * are local synthetic facts; no binding/account/approval/shared-data effect is allowed.
 * Only its registered isolated identities get synthetic recent evidence. */
export function defineAftercareBoundaryCases(
  get: (name: AftercareFixtureName) => Promise<AftercareNativeFixture>,
) {
  const snapshot = async (f: AftercareNativeFixture) =>
    (
      await f.admin.query<{ value: unknown }>(
        "SELECT jsonb_build_object('quote',to_jsonb(q),'lines',(SELECT jsonb_agg(to_jsonb(l) ORDER BY position) FROM treido.payable_quote_lines l WHERE l.quote_id=q.id),'allocation',to_jsonb(a),'stockEvents',(SELECT count(*) FROM treido.inventory_events e WHERE e.allocation_id=a.id)) AS value FROM treido.payable_quotes q JOIN treido.inventory_allocations a ON a.id=q.allocation_id WHERE q.id=$1",
        [f.quoteId],
      )
    ).rows[0].value;
  const open = (f: AftercareNativeFixture) => ({
    actorKey: libraryActorKey(f.buyer),
    orderId: f.orderId,
    sellerId: null,
    requestId: randomUUID(),
    expectedRevision: f.orderRevision,
    language: "en",
    action: "open",
    reason: "item_condition",
    body: "SYNTHETIC original participant evidence",
    evidence: ["SYNTHETIC plain evidence"],
    servicePolicyId: f.service.id,
    servicePolicyVersion: f.service.version,
    serviceTermsHash: f.service.termsHash,
    acknowledged: true,
  });
  const refund = (f: AftercareNativeFixture) => ({
    actorKey: libraryActorKey(f.merchant),
    orderId: f.orderId,
    sellerId: f.sellerId,
    requestId: randomUUID(),
    expectedRevision: f.orderRevision,
    language: "en",
    action: "prepare_refund",
    caseId: null,
    reason: "SYNTHETIC reviewed one-unit refund",
    selection: "lines",
    lines: [{ skuId: f.skuId, quantity: 1 }],
  });
  const currentRefund = async (f: AftercareNativeFixture, id: string) => {
    const row = await inTransaction(f.database, (tx) =>
      readRefundIntent(tx, id),
    );
    if (!row) throw Error("Original native refund intent missing");
    return row;
  };
  const execute = (f: AftercareNativeFixture, intentId: string) => ({
    actorKey: libraryActorKey(f.merchant),
    orderId: f.orderId,
    sellerId: f.sellerId,
    requestId: randomUUID(),
    expectedRevision: 0,
    language: "en",
    action: "execute_refund",
    intentId,
  });
  // Explicit provider-boundary facts only. All command/processor/SQL writes
  // and original allocation/receipt/lease behavior remain native and unchanged.
  const syntheticRefund = (
    row: RefundIntent,
    status: "pending" | "succeeded",
  ): Stripe.Response<Stripe.Refund> => {
    const sourceMetadata = row.parameters.metadata;
    if (!sourceMetadata || typeof sourceMetadata !== "object")
      throw Error("Original synthetic refund metadata missing");
    const metadata: Stripe.Metadata = {};
    for (const [key, value] of Object.entries(sourceMetadata)) {
      if (typeof value !== "string")
        throw Error("Original synthetic refund metadata must contain strings");
      metadata[key] = value;
    }
    return {
      id: "re_Native" + row.id.replaceAll("-", ""),
      object: "refund",
      created: Math.floor((row.firstAttemptAt ?? new Date()).getTime() / 1000),
      amount: row.amountMinor,
      currency: "eur",
      balance_transaction: null,
      charge: row.chargeId,
      customer: null,
      customer_account: null,
      payment_intent: row.paymentIntentId,
      payment_method: null,
      metadata,
      reason: null,
      receipt_number: null,
      source_transfer_reversal: null,
      status,
      transfer_reversal: null,
      lastResponse: {
        headers: { "request-id": "req_NativeSynthetic" },
        requestId: "req_NativeSynthetic",
        statusCode: 200,
      },
    };
  };
  const syntheticObservation = (
    row: RefundIntent,
    status: "pending" | "succeeded" | null,
    verified = false,
  ): refundProvider.RefundObservation => ({
    providerId: status ? syntheticRefund(row, "pending").id : null,
    providerStatus: status,
    state: verified
      ? "succeeded"
      : status === "pending"
        ? "pending"
        : "reconciling",
    settlementState: verified ? "verified" : "reconciling",
    fact: {
      refundId: status ? syntheticRefund(row, "pending").id : null,
      status,
      amountMinor: row.amountMinor,
      chargeId: row.chargeId,
      amountRefundedMinor: status === "succeeded" ? row.amountMinor : 0,
      chargeDisputed: false,
      reversalId: null,
      reversalMinor: null,
      feeRefundedMinor: null,
      feeRefundIds: [],
    },
  });
  describe("T64 original aftercare authority on disposable native PostgreSQL", () => {
    it("paid order exact receipt replays after later revisions while stale unaccepted commands require fresh authority", async () => {
      const f = await get("case-replay");
      // The declared paid fixture starts collected. Prepare only this isolated
      // order's pickup state; quote, accepted terms, stock and grants stay intact.
      await f.admin.query(
        "UPDATE treido.paid_orders SET fulfilment_state='pending' WHERE id=$1",
        [f.orderId],
      );
      const before = await snapshot(f),
        providers = f.providerCounts();
      const ready = {
        actorKey: libraryActorKey(f.merchant),
        id: f.orderId,
        sellerId: f.sellerId,
        requestId: randomUUID(),
        action: "ready",
        expectedRevision: f.orderRevision,
        reason: "",
      };
      const accepted = await changePaidOrder(f.database, f.merchant, ready);
      expect(accepted.revision).toBe(f.orderRevision + 1);
      const stale = {
        ...ready,
        actorKey: libraryActorKey(f.buyer),
        sellerId: null,
        requestId: randomUUID(),
        action: "collected",
      };
      await expect(
        changePaidOrder(f.database, f.buyer, stale),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await f.admin.query(
            "SELECT count(*)::int AS count FROM treido.paid_order_receipts WHERE order_id=$1 AND request_id=$2",
            [f.orderId, stale.requestId],
          )
        ).rows[0].count,
      ).toBe(0);
      const [fresh] = await readPaidOrders(
        f.database,
        f.buyer,
        null,
        f.orderId,
      );
      expect(fresh.revision).toBe(accepted.revision);
      const corrected = {
        ...stale,
        requestId: randomUUID(),
        expectedRevision: fresh.revision,
      };
      expect(await changePaidOrder(f.database, f.buyer, corrected)).toEqual({
        id: f.orderId,
        revision: accepted.revision + 1,
      });
      expect(await changePaidOrder(f.database, f.merchant, ready)).toEqual(
        accepted,
      );
      await expect(
        changePaidOrder(f.database, f.merchant, {
          ...ready,
          expectedRevision: fresh.revision,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await f.admin.query(
            "SELECT count(*)::int AS count FROM treido.paid_order_receipts WHERE order_id=$1",
            [f.orderId],
          )
        ).rows[0].count,
      ).toBe(2);
      expect(
        (await readPaidOrders(f.database, f.buyer, null, f.orderId))[0],
      ).toMatchObject({
        revision: accepted.revision + 1,
        fulfilmentState: "collected",
      });
      expect(await snapshot(f)).toEqual(before);
      expect(f.providerCounts()).toEqual(providers);
    });

    it("one original execute race emits one POST and unknown outcomes keep the original budget/expiry while jobs only read", async () => {
      const f = await get("one-post-unknown"),
        before = await snapshot(f);
      await f.withUnknownProvider(async () => {
        const prepared = await prepareOrderRefund(
          f.database,
          f.merchant,
          refund(f),
        );
        if (!prepared.intentId)
          throw new Error("Original prepare did not create an intent");
        const command = {
          actorKey: libraryActorKey(f.merchant),
          orderId: f.orderId,
          sellerId: f.sellerId,
          requestId: randomUUID(),
          expectedRevision: 0,
          language: "en",
          action: "execute_refund",
          intentId: prepared.intentId,
        };
        const original = (
          await f.admin.query(
            "SELECT operation_key,parameter_hash,parameters,expires_at FROM treido.order_refund_intents WHERE id=$1",
            [prepared.intentId],
          )
        ).rows[0];
        const results = await Promise.all([
          executeOrderRefund(f.database, f.merchant, command),
          executeOrderRefund(f.database, f.merchant, command),
        ]);
        expect(results[0]).toEqual(results[1]);
        expect(f.providerCounts().posts).toBe(1);
        expect(
          await executeOrderRefund(f.database, f.merchant, command),
        ).toEqual(results[0]);
        expect(f.providerCounts().posts).toBe(1);
        await expect(
          executeOrderRefund(f.database, f.merchant, {
            ...command,
            requestId: randomUUID(),
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(f.providerCounts().posts).toBe(1);
        await f.runRefundJob(prepared.intentId);
        expect(f.providerCounts().posts).toBe(1);
        expect(f.providerCounts().reads).toBeGreaterThan(0);
        const current = (
          await f.admin.query(
            "SELECT operation_key,parameter_hash,parameters,expires_at,state,first_attempt_at FROM treido.order_refund_intents WHERE id=$1",
            [prepared.intentId],
          )
        ).rows[0];
        expect(current.state).toBe("reconciling");
        expect(current.first_attempt_at).not.toBeNull();
        for (const name of [
          "operation_key",
          "parameter_hash",
          "parameters",
          "expires_at",
        ])
          expect(current[name]).toEqual(original[name]);
        await expect(
          prepareOrderRefund(f.database, f.merchant, refund(f)),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(await snapshot(f)).toEqual(before);
      });
    });

    it("foreign buyer cannot read private histories or recover original receipts; immutable source is unchanged", async () => {
      const f = await get("foreign-participant"),
        before = await snapshot(f);
      await expect(
        readOrderAftercare(f.database, f.foreign, null, f.orderId, "en"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        recoverOrderAftercare(f.database, f.foreign, {
          actorKey: libraryActorKey(f.foreign),
          orderId: f.orderId,
          sellerId: null,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await snapshot(f)).toEqual(before);
    });
    it("concurrent original case replay records one case/event/receipt and rejects changed original evidence", async () => {
      const f = await get("case-replay"),
        command = open(f),
        before = await snapshot(f);
      const results = await Promise.all([
        executeOrderCase(f.database, f.buyer, command),
        executeOrderCase(f.database, f.buyer, command),
      ]);
      expect(results[0]).toEqual(results[1]);
      const count = (
        await f.admin.query<{
          cases: number;
          events: number;
          receipts: number;
        }>(
          "SELECT (SELECT count(*)::int FROM treido.order_cases WHERE order_id=$1) AS cases,(SELECT count(*)::int FROM treido.order_case_events e JOIN treido.order_cases c ON c.id=e.case_id WHERE c.order_id=$1) AS events,(SELECT count(*)::int FROM treido.order_aftercare_receipts WHERE order_id=$1) AS receipts",
          [f.orderId],
        )
      ).rows[0];
      expect(count).toEqual({ cases: 1, events: 1, receipts: 1 });
      await expect(
        executeOrderCase(f.database, f.buyer, {
          ...command,
          body: "Changed original evidence",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await snapshot(f)).toEqual(before);
    });
    it("stale case revision does not append a decision or change the original accepted allocation", async () => {
      const f = await get("stale-case"),
        result = await executeOrderCase(f.database, f.buyer, open(f)),
        before = await snapshot(f);
      await executeOrderCase(f.database, f.buyer, {
        actorKey: libraryActorKey(f.buyer),
        orderId: f.orderId,
        sellerId: null,
        requestId: randomUUID(),
        expectedRevision: 0,
        language: "en",
        action: "message",
        caseId: result.caseId,
        body: "Current message",
      });
      await expect(
        executeOrderCase(f.database, f.buyer, {
          actorKey: libraryActorKey(f.buyer),
          orderId: f.orderId,
          sellerId: null,
          requestId: randomUUID(),
          expectedRevision: 0,
          language: "en",
          action: "message",
          caseId: result.caseId,
          body: "Stale message",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await f.admin.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM treido.order_case_events WHERE case_id=$1",
            [result.caseId],
          )
        ).rows[0].n,
      ).toBe(2);
      expect(await snapshot(f)).toEqual(before);
    });
    it("deserialized recentlyAuthenticated=true does not authorize a sensitive refund", async () => {
      const f = await get("no-recent-auth"),
        before = await snapshot(f);
      const projection = {
        subject: f.merchant.subject,
        recentlyAuthenticated: true,
      };
      await expect(
        prepareOrderRefund(f.database, projection, refund(f)),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await snapshot(f)).toEqual(before);
    });
    it("legacy full-only pickup terms cannot gain partial refund rights", async () => {
      const f = await get("legacy-no-partial"),
        before = await snapshot(f);
      await expect(
        prepareOrderRefund(f.database, f.merchant, refund(f)),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      expect(
        (
          await f.admin.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM treido.order_refund_intents WHERE order_id=$1",
            [f.orderId],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(await snapshot(f)).toEqual(before);
    });
    it("original refund prepare replay retains one exact amount, parameters, key, API and expiry without another allocation", async () => {
      const f = await get("refund-replay"),
        command = refund(f),
        before = await snapshot(f);
      const a = await prepareOrderRefund(f.database, f.merchant, command);
      const original = (
        await f.admin.query(
          "SELECT * FROM treido.order_refund_intents WHERE id=$1",
          [a.intentId],
        )
      ).rows[0];
      const b = await prepareOrderRefund(f.database, f.merchant, command);
      expect(b).toEqual(a);
      expect(
        (
          await f.admin.query(
            "SELECT * FROM treido.order_refund_intents WHERE id=$1",
            [a.intentId],
          )
        ).rows[0],
      ).toEqual(original);
      expect(original.operation_key).toBe(
        "treido:order-refund:v2:" + a.intentId,
      );
      expect(original.first_attempt_at).toBeNull();
      expect(original.api_version).toBe("2026-09-30.endive");
      expect(await snapshot(f)).toEqual(before);
    });
    it("reserved or uncertain units reject another original request rather than reusing its money", async () => {
      const f = await get("refund-reserved"),
        before = await snapshot(f);
      await prepareOrderRefund(f.database, f.merchant, refund(f));
      await expect(
        prepareOrderRefund(f.database, f.merchant, refund(f)),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await f.admin.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM treido.order_refund_intents WHERE order_id=$1",
            [f.orderId],
          )
        ).rows[0].n,
      ).toBe(1);
      await expect(
        changePaidOrder(f.database, f.merchant, {
          actorKey: libraryActorKey(f.merchant),
          requestId: randomUUID(),
          id: f.orderId,
          sellerId: f.sellerId,
          expectedRevision: f.orderRevision,
          action: "refund",
          reason: "SYNTHETIC legacy full refund",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await snapshot(f)).toEqual(before);
    });
    it("actual completed paid feedback original replay is unique and pending until separately approved moderation", async () => {
      const f = await get("feedback-replay");
      const command = {
        actorKey: libraryActorKey(f.buyer),
        orderId: f.orderId,
        sellerId: null,
        requestId: randomUUID(),
        expectedRevision: f.orderRevision,
        language: "en",
        rating: 4,
        body: "SYNTHETIC original buyer feedback",
        policyId: f.feedback.id,
        version: f.feedback.version,
        termsHash: f.feedback.termsHash,
        acknowledged: true,
      };
      const results = await Promise.all([
        submitOrderFeedback(f.database, f.buyer, command),
        submitOrderFeedback(f.database, f.buyer, command),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(
        (
          await f.admin.query<{ n: number; state: string }>(
            "SELECT count(*)::int AS n,min(state) AS state FROM treido.order_purchase_feedback WHERE order_id=$1",
            [f.orderId],
          )
        ).rows[0],
      ).toEqual({ n: 1, state: "pending" });
      await expect(
        submitOrderFeedback(f.database, f.merchant, {
          ...command,
          actorKey: libraryActorKey(f.merchant),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    for (const name of ["public-restricted", "public-withdrawn"] as const)
      it(
        "published feedback disappears under current " +
          name +
          " supply eligibility",
        async () => {
          const f = await get(name);
          const initial = await readPublicOrderFeedback(f.database, f.sellerId);
          expect(initial.available).toBe(true);
          expect(initial.feedback).toHaveLength(1);
          if (name === "public-restricted")
            await f.admin.query(
              "UPDATE treido.seller_accounts SET status='restricted' WHERE id=$1",
              [f.sellerId],
            );
          else
            await f.admin.query(
              "UPDATE treido.listings SET publication='withdrawn' WHERE seller_id=$1",
              [f.sellerId],
            );
          expect(
            (await readPublicOrderFeedback(f.database, f.sellerId)).feedback,
          ).toEqual([]);
          for (const row of initial.feedback) {
            expect(row).not.toHaveProperty("buyerId");
            expect(row).not.toHaveProperty("orderId");
            expect(row.reviewer).toBe("anonymous_buyer");
          }
        },
      );
    it("accepted original consumed payment observation survives later human and personal seller restriction without new allocation or revived fulfilment", async () => {
      const f = await get("accepted-after-restriction"),
        before = await snapshot(f);
      await f.admin.query(
        "UPDATE treido.users SET status='restricted' WHERE id=$1",
        [f.buyerId],
      );
      await f.admin.query(
        "UPDATE treido.seller_accounts SET status='restricted' WHERE id=$1",
        [f.sellerId],
      );
      await inTransaction(f.database, async (tx) => {
        const initial = (
          await tx.client.query<AttemptRow>(
            "SELECT " +
              attemptColumns +
              " FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE a.id=$1",
            [f.attemptId],
          )
        ).rows[0];
        await applyPaymentObservation(
          tx,
          initial,
          f.payment.intent,
          f.payment.binding,
          f.payment.observation,
        );
      });
      expect(
        (
          await f.admin.query(
            "SELECT payment_state,fulfilment_state,settlement_state FROM treido.paid_orders WHERE id=$1",
            [f.orderId],
          )
        ).rows[0],
      ).toEqual({
        payment_state: "paid",
        fulfilment_state: "collected",
        settlement_state: "transferred",
      });
      expect(await snapshot(f)).toEqual(before);
    });
    it("first settlement still quarantines an inactive original buyer instead of consuming stock", async () => {
      const f = await get("first-settlement-inactive");
      await f.admin.query(
        "UPDATE treido.users SET status='restricted' WHERE id=$1",
        [f.buyerId],
      );
      await inTransaction(f.database, async (tx) => {
        const initial = (
          await tx.client.query<AttemptRow>(
            "SELECT " +
              attemptColumns +
              " FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE a.id=$1",
            [f.attemptId],
          )
        ).rows[0];
        await applyPaymentObservation(
          tx,
          initial,
          f.payment.intent,
          f.payment.binding,
          f.payment.observation,
        );
      });
      expect(
        (
          await f.admin.query(
            "SELECT state FROM treido.inventory_allocations WHERE id=$1",
            [f.allocationId],
          )
        ).rows[0].state,
      ).toBe("reconciliation");
      expect(
        (
          await f.admin.query(
            "SELECT payment_state,fulfilment_state FROM treido.paid_orders WHERE quote_id=$1",
            [f.quoteId],
          )
        ).rows[0],
      ).toEqual({
        payment_state: "reconciliation",
        fulfilment_state: "blocked",
      });
    });
    it.each([null, "pending"] as const)(
      "native same-generation refund: older %s observation cannot replace a succeeded create acknowledgment",
      async (status) => {
        const f = await get("stale-refund-observation"),
          prepared = await prepareOrderRefund(
            f.database,
            f.merchant,
            refund(f),
          );
        if (!prepared.intentId) throw Error("Original prepare failed");
        const original = await currentRefund(f, prepared.intentId),
          provider = await refundProvider.orderRefundProvider(),
          find = vi
            .spyOn(refundProvider, "findOriginalRefund")
            .mockResolvedValue(null),
          observe = vi
            .spyOn(refundProvider, "observeOriginalRefund")
            .mockResolvedValue(syntheticObservation(original, status));
        let pending: EffectResult | null = null;
        const create = vi
          .spyOn(provider.stripe.refunds, "create")
          .mockImplementation(async () => {
            const job = (
              await f.admin.query<SellerJobRow>(
                `SELECT ${jobColumns} FROM treido.outbox_jobs WHERE kind='payment.aftercare' AND resource_id=$1 ORDER BY created_at DESC LIMIT 1`,
                [original.id],
              )
            ).rows[0];
            if (!job) throw Error("Original accepted refund job missing");
            pending = await processOrderRefund(f.database, {
              ...job,
              executionToken: randomUUID(),
            });
            return syntheticRefund(
              await currentRefund(f, original.id),
              "succeeded",
            );
          });
        try {
          const command = execute(f, original.id),
            acknowledged = await executeOrderRefund(
              f.database,
              f.merchant,
              command,
            ),
            before = await currentRefund(f, original.id);
          expect(before.providerStatus).toBe("succeeded");
          expect(before.state).toBe("reconciling");
          if (!pending) throw Error("Original external observation missing");
          const older: EffectResult = pending;
          await inTransaction(f.database, async (tx) => {
            await older.lock?.(tx);
            await older.apply?.(tx);
          });
          expect(await currentRefund(f, original.id)).toEqual(before);
          expect(
            (
              await f.admin.query(
                "SELECT count(*)::int AS n FROM treido.order_refund_observations WHERE intent_id=$1",
                [original.id],
              )
            ).rows[0].n,
          ).toBe(0);
          observe.mockResolvedValue(
            syntheticObservation(original, "succeeded", true),
          );
          find.mockResolvedValue(syntheticRefund(original, "succeeded"));
          await f.runRefundJob(original.id);
          expect(await currentRefund(f, original.id)).toMatchObject({
            providerStatus: "succeeded",
            state: "succeeded",
            settlementState: "verified",
          });
          expect(
            await executeOrderRefund(f.database, f.merchant, command),
          ).toEqual(acknowledged);
          expect(create).toHaveBeenCalledTimes(1);
        } finally {
          create.mockRestore();
          observe.mockRestore();
          find.mockRestore();
        }
      },
    );
    it("native late pending create acknowledgment preserves already observed succeeded-but-unverified settlement", async () => {
      const f = await get("late-refund-acknowledgment"),
        prepared = await prepareOrderRefund(f.database, f.merchant, refund(f));
      if (!prepared.intentId) throw Error("Original prepare failed");
      const original = await currentRefund(f, prepared.intentId),
        provider = await refundProvider.orderRefundProvider(),
        find = vi
          .spyOn(refundProvider, "findOriginalRefund")
          .mockResolvedValue(syntheticRefund(original, "succeeded")),
        observe = vi
          .spyOn(refundProvider, "observeOriginalRefund")
          .mockResolvedValue(syntheticObservation(original, "succeeded")),
        create = vi
          .spyOn(provider.stripe.refunds, "create")
          .mockImplementation(async () => {
            await f.runRefundJob(original.id);
            expect(await currentRefund(f, original.id)).toMatchObject({
              providerStatus: "succeeded",
              state: "reconciling",
              settlementState: "reconciling",
            });
            return syntheticRefund(
              await currentRefund(f, original.id),
              "pending",
            );
          });
      try {
        await executeOrderRefund(
          f.database,
          f.merchant,
          execute(f, original.id),
        );
        expect(await currentRefund(f, original.id)).toMatchObject({
          providerId: syntheticRefund(original, "succeeded").id,
          providerStatus: "succeeded",
          state: "reconciling",
          settlementState: "reconciling",
        });
        await f.database.pool.query(
          "UPDATE treido.order_refund_intents SET reconcile_at=clock_timestamp() WHERE id=$1",
          [original.id],
        );
        expect(
          await scheduleOrderRefundRepair(f.database),
        ).toBeGreaterThanOrEqual(1);
        observe.mockResolvedValue(
          syntheticObservation(original, "succeeded", true),
        );
        await f.runRefundJob(original.id);
        expect(await currentRefund(f, original.id)).toMatchObject({
          state: "succeeded",
          settlementState: "verified",
        });
        expect(create).toHaveBeenCalledTimes(1);
      } finally {
        create.mockRestore();
        observe.mockRestore();
        find.mockRestore();
      }
    });
    it("native refund repair reaches due recovery behind twenty unexpired prepared requests", async () => {
      const preparedIds: string[] = [];
      for (let n = 0; n < 20; n++) {
        const f = await get("refund-repair-fairness"),
          prepared = await prepareOrderRefund(
            f.database,
            f.merchant,
            refund(f),
          );
        if (!prepared.intentId) throw Error("Original prepare failed");
        preparedIds.push(prepared.intentId);
      }
      const f = await get("refund-repair-fairness"),
        prepared = await prepareOrderRefund(f.database, f.merchant, refund(f));
      if (!prepared.intentId) throw Error("Original prepare failed");
      await executeOrderRefund(
        f.database,
        f.merchant,
        execute(f, prepared.intentId),
      );
      await f.runRefundJob(prepared.intentId);
      // Advance only the owned fixture's actual retry eligibility, not its state,
      // original parameters, expiry, provider identity or ownership constraints.
      await f.database.pool.query(
        "UPDATE treido.order_refund_intents SET reconcile_at=clock_timestamp() WHERE id=$1",
        [prepared.intentId],
      );
      const posts = f.providerCounts().posts;
      expect(
        await scheduleOrderRefundRepair(f.database),
      ).toBeGreaterThanOrEqual(1);
      expect(
        (
          await f.admin.query(
            "SELECT count(*)::int AS n FROM treido.outbox_jobs WHERE kind='payment.aftercare' AND resource_id=$1 AND state IN ('pending','accepted')",
            [prepared.intentId],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await f.admin.query(
            "SELECT count(*)::int AS n FROM treido.order_refund_intents WHERE id=ANY($1::uuid[]) AND state='prepared' AND first_attempt_at IS NULL AND provider_id IS NULL AND expires_at>clock_timestamp()",
            [preparedIds],
          )
        ).rows[0].n,
      ).toBe(20);
      expect(f.providerCounts().posts).toBe(posts);
    }, 60000);
    it("native refund repair reaches due recovery behind twenty existing active observations", async () => {
      const activeIds: string[] = [],
        activeFixtures: AftercareNativeFixture[] = [];
      for (let n = 0; n < 20; n++) {
        const f = await get("active-refund-repair-fairness"),
          prepared = await prepareOrderRefund(
            f.database,
            f.merchant,
            refund(f),
          );
        if (!prepared.intentId) throw Error("Original prepare failed");
        await executeOrderRefund(
          f.database,
          f.merchant,
          execute(f, prepared.intentId),
        );
        activeIds.push(prepared.intentId);
        activeFixtures.push(f);
      }
      const f = await get("active-refund-repair-fairness"),
        prepared = await prepareOrderRefund(f.database, f.merchant, refund(f));
      if (!prepared.intentId) throw Error("Original prepare failed");
      await executeOrderRefund(
        f.database,
        f.merchant,
        execute(f, prepared.intentId),
      );
      await f.runRefundJob(prepared.intentId);
      // The twenty earlier original commands retain their existing observations.
      // Advance only fixture retry timing so they precede the unscheduled intent.
      await f.database.pool.query(
        "UPDATE treido.order_refund_intents SET reconcile_at=clock_timestamp()-interval '1 minute' WHERE id=ANY($1::uuid[])",
        [activeIds],
      );
      await f.database.pool.query(
        "UPDATE treido.order_refund_intents SET reconcile_at=clock_timestamp() WHERE id=$1",
        [prepared.intentId],
      );
      const readActive = async () =>
        (
          await f.admin.query(
            "SELECT to_jsonb(r) AS intent,(SELECT jsonb_agg(to_jsonb(j) ORDER BY j.id) FROM treido.outbox_jobs j WHERE j.kind='payment.aftercare' AND j.resource_id=r.id) AS jobs FROM treido.order_refund_intents r WHERE r.id=ANY($1::uuid[]) ORDER BY r.id",
            [activeIds],
          )
        ).rows;
      expect(
        (
          await f.admin.query(
            "SELECT count(*)::int AS n FROM treido.order_refund_intents r WHERE r.id=ANY($1::uuid[]) AND r.state='reconciling' AND r.first_attempt_at IS NOT NULL AND r.reconcile_at<=clock_timestamp() AND EXISTS (SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='payment.aftercare' AND j.resource_id=r.id AND j.state IN ('pending','accepted'))",
            [activeIds],
          )
        ).rows[0].n,
      ).toBe(20);
      const activeBefore = await readActive(),
        countsBefore = [...activeFixtures, f].map((item) =>
          item.providerCounts(),
        );
      expect(
        await scheduleOrderRefundRepair(f.database),
      ).toBeGreaterThanOrEqual(1);
      expect(
        (
          await f.admin.query(
            "SELECT count(*)::int AS n FROM treido.outbox_jobs WHERE kind='payment.aftercare' AND resource_id=$1 AND state IN ('pending','accepted')",
            [prepared.intentId],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(await readActive()).toEqual(activeBefore);
      expect(
        [...activeFixtures, f].map((item) => item.providerCounts()),
      ).toEqual(countsBefore);
    }, 60000);
  });
}
