import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import { obligationNames } from "./model";

type Fixture = {
  database: SellerDatabase;
  admin: Pool;
  userId: string;
  planId: string;
  planHash: string;
  effectId: string;
  jobId: string;
  executionToken: string;
};
export type AccountClosureBoundaryFixture =
  | `future-${"policy" | "binding"}-${"accept" | "effect" | "finish"}`
  | `hold-${(typeof obligationNames)[number]}`
  | "cancel-before-effects"
  | "cancel-after-restriction"
  | "cancel-without-reviewed-restoration"
  | "cancel-with-new-legacy-hold"
  | "inactive-unaccepted-plan"
  | "cancel-after-unknown"
  | "unknown-original-effect"
  | "wrong-job-lease"
  | "finish-preserves-evidence";

/** T61 supplies a fresh disposable native fixture for EVERY case. Deliberately
 * invalid future approvals are isolated adversarial fixtures, never real grants.
 * No helper here creates provider credentials, policies or shared database rows.
 */
export function defineAccountClosureBoundaryCases(
  get: (name: AccountClosureBoundaryFixture) => Promise<Fixture>,
) {
  const accept = (f: Fixture) =>
    f.database.pool.query(
      `SELECT treido.account_accept_closure($1::uuid,$2::uuid,$3::text,$4::uuid)`,
      [f.userId, f.planId, f.planHash, randomUUID()],
    );
  const cancel = (f: Fixture) =>
    f.database.pool.query(
      `SELECT treido.account_cancel_closure($1::uuid,$2::uuid)`,
      [f.userId, f.planId],
    );
  const claim = (f: Fixture, jobId = f.jobId) =>
    f.database.pool.query(
      `SELECT treido.account_claim_effect($1::uuid,$2::uuid,$3::uuid,$4::uuid) AS result`,
      [f.effectId, randomUUID(), jobId, f.executionToken],
    );
  const finish = (f: Fixture) =>
    f.database.pool.query(
      `SELECT treido.account_finish_closure($1::uuid,$2::uuid,$3::uuid,$4::uuid)`,
      [f.userId, f.planId, f.jobId, f.executionToken],
    );
  const plan = async (f: Fixture) =>
    (
      await f.admin.query(
        `SELECT state,accepted_at,first_effect_at FROM treido.account_execution_plans WHERE id=$1`,
        [f.planId],
      )
    ).rows[0];

  describe("original closure authority on disposable native PostgreSQL", () => {
    for (const approval of ["policy", "binding"] as const) {
      for (const boundary of ["accept", "effect", "finish"] as const) {
        it(`rejects a future ${approval} approval at ${boundary}, without advancing the plan`, async () => {
          const f = await get(`future-${approval}-${boundary}`);
          const table =
            approval === "policy"
              ? "account_closure_policies"
              : "account_lifecycle_bindings";
          const column = approval === "policy" ? "policy_id" : "binding_id";
          const approvalState = (
            await f.admin.query(
              `SELECT registry.approved_at>clock_timestamp() AS future FROM treido.${table} registry JOIN treido.account_execution_plans p ON p.${column}=registry.id WHERE p.id=$1`,
              [f.planId],
            )
          ).rows[0];
          expect(approvalState?.future).toBe(true);
          const before = await plan(f);
          const operation =
            boundary === "accept"
              ? accept
              : boundary === "effect"
                ? claim
                : finish;
          await expect(operation(f)).rejects.toMatchObject({ code: "55000" });
          expect(await plan(f)).toEqual(before);
        });
      }
    }
    for (const hold of obligationNames) {
      it(`a newly held ${hold} prevents acceptance and preserves current access`, async () => {
        const f = await get(`hold-${hold}`);
        const facts = (
          await f.admin.query(
            `SELECT treido.account_closure_obligations($1::uuid) AS facts`,
            [f.userId],
          )
        ).rows[0]?.facts;
        expect(Number(facts?.[hold])).toBeGreaterThan(0);
        await expect(accept(f)).rejects.toMatchObject({ code: "55000" });
        expect((await plan(f)).accepted_at).toBeNull();
        expect(
          (
            await f.admin.query(`SELECT status FROM treido.users WHERE id=$1`, [
              f.userId,
            ])
          ).rows[0].status,
        ).toBe("active");
      });
    }
    it("cancels only its original restriction, keeps paused matching paused and leaves business resources alone", async () => {
      const f = await get("cancel-before-effects");
      const business = await businessStates(f);
      const searches = (
        await f.admin.query(
          `SELECT id,status,consent_at,consent_generation FROM treido.buyer_saved_searches WHERE user_id=$1 ORDER BY id`,
          [f.userId],
        )
      ).rows;
      expect((await plan(f)).first_effect_at).toBeNull();
      await cancel(f);
      expect((await plan(f)).state).toBe("cancelled");
      expect(
        (
          await f.admin.query(`SELECT status FROM treido.users WHERE id=$1`, [
            f.userId,
          ])
        ).rows[0].status,
      ).toBe("active");
      expect(
        (
          await f.admin.query(
            `SELECT id,status,consent_at,consent_generation FROM treido.buyer_saved_searches WHERE user_id=$1 ORDER BY id`,
            [f.userId],
          )
        ).rows,
      ).toEqual(searches);
      expect(await businessStates(f)).toEqual(business);
    });
    it("absence of explicit reviewed restoration blocks cancellation even for the original latest restriction", async () => {
      const f = await get("cancel-without-reviewed-restoration");
      const facts = (
        await f.admin.query(
          `SELECT treido.account_closure_extension_facts($1::uuid) AS facts`,
          [f.userId],
        )
      ).rows[0].facts;
      expect(facts.mayRestoreClosureRestriction).toBe(false);
      await expect(cancel(f)).rejects.toMatchObject({ code: "55000" });
      expect(
        (
          await f.admin.query(`SELECT status FROM treido.users WHERE id=$1`, [
            f.userId,
          ])
        ).rows[0].status,
      ).toBe("restricted");
    });
    it("a new unresolved original payment blocks restoration even when reviewed aftercare allows it", async () => {
      const f = await get("cancel-with-new-legacy-hold");
      const facts = (
        await f.admin.query(
          `SELECT treido.account_closure_obligations($1::uuid) AS facts`,
          [f.userId],
        )
      ).rows[0].facts;
      expect(Number(facts.payments)).toBeGreaterThan(0);
      await expect(cancel(f)).rejects.toMatchObject({ code: "55000" });
      expect(
        (
          await f.admin.query(`SELECT status FROM treido.users WHERE id=$1`, [
            f.userId,
          ])
        ).rows[0].status,
      ).toBe("restricted");
    });
    it("an inactive human cannot use another accepted plan as permission to mutate an unaccepted review", async () => {
      const f = await get("inactive-unaccepted-plan");
      expect((await plan(f)).accepted_at).toBeNull();
      expect(
        (
          await f.admin.query(`SELECT status FROM treido.users WHERE id=$1`, [
            f.userId,
          ])
        ).rows[0].status,
      ).toBe("restricted");
      const before = await plan(f);
      await expect(cancel(f)).rejects.toMatchObject({ code: "23514" });
      expect(await plan(f)).toEqual(before);
    });
    it("an explicit later same-status restriction cannot be undone by cancellation", async () => {
      const f = await get("cancel-after-restriction");
      await f.admin.query(
        `UPDATE treido.users SET status='restricted' WHERE id=$1`,
        [f.userId],
      );
      const event = (
        await f.admin.query(
          `SELECT cause,plan_id FROM treido.account_lifecycle_status_events WHERE user_id=$1 ORDER BY id DESC LIMIT 1`,
          [f.userId],
        )
      ).rows[0];
      expect(event).toEqual({ cause: "external", plan_id: null });
      await expect(cancel(f)).rejects.toMatchObject({ code: "55000" });
      expect(
        (
          await f.admin.query(`SELECT status FROM treido.users WHERE id=$1`, [
            f.userId,
          ])
        ).rows[0].status,
      ).toBe("restricted");
    });
    it("an attempted effect with an unknown result makes cancellation irreversible", async () => {
      const f = await get("cancel-after-unknown");
      const effect = (
        await f.admin.query(
          `SELECT state,first_attempt_at FROM treido.account_lifecycle_effects WHERE id=$1`,
          [f.effectId],
        )
      ).rows[0];
      expect(effect.state).toBe("unknown");
      expect(effect.first_attempt_at).not.toBeNull();
      await expect(cancel(f)).rejects.toMatchObject({ code: "23514" });
    });
    it("restores the unknown original effect for observation and preserves its first attempt and operation key", async () => {
      const f = await get("unknown-original-effect");
      const before = (
        await f.admin.query(
          `SELECT operation_key,first_attempt_at FROM treido.account_lifecycle_effects WHERE id=$1`,
          [f.effectId],
        )
      ).rows[0];
      expect(before.first_attempt_at).not.toBeNull();
      expect((await claim(f)).rows[0].result).toMatchObject({
        claimed: true,
        execute: false,
      });
      expect(
        (
          await f.admin.query(
            `SELECT operation_key,first_attempt_at FROM treido.account_lifecycle_effects WHERE id=$1`,
            [f.effectId],
          )
        ).rows[0],
      ).toEqual(before);
    });
    it("a different job cannot borrow an accepted closure plan's resource authority", async () => {
      const f = await get("wrong-job-lease");
      const before = await plan(f);
      await expect(claim(f, randomUUID())).rejects.toMatchObject({
        code: "23514",
      });
      expect(await plan(f)).toEqual(before);
      expect(
        (
          await f.admin.query(
            `SELECT first_attempt_at FROM treido.account_lifecycle_effects WHERE id=$1`,
            [f.effectId],
          )
        ).rows[0].first_attempt_at,
      ).toBeNull();
    });
    it("completion preserves accepted financial and case evidence and shared business state", async () => {
      const f = await get("finish-preserves-evidence");
      const before = await evidenceRows(f);
      // Fixtures must actually contain retained evidence, not prove an empty set unchanged.
      expect(before.orders.length).toBeGreaterThan(0);
      expect(before.reports.length).toBeGreaterThan(0);
      const business = await businessStates(f);
      await finish(f);
      expect((await plan(f)).state).toBe("completed");
      expect(await evidenceRows(f)).toEqual(before);
      expect(await businessStates(f)).toEqual(business);
    });
  });
}
async function businessStates(f: Fixture) {
  return (
    await f.admin.query(
      `SELECT s.id,s.status,s.revision FROM treido.seller_accounts s JOIN treido.seller_memberships m ON m.seller_id=s.id WHERE m.user_id=$1 AND s.kind='business' ORDER BY s.id`,
      [f.userId],
    )
  ).rows;
}
async function evidenceRows(f: Fixture) {
  const orders = (
    await f.admin.query(
      `SELECT to_jsonb(o) AS row FROM treido.paid_orders o WHERE o.buyer_id=$1 OR o.seller_id IN(SELECT seller_id FROM treido.personal_seller_owners WHERE user_id=$1) ORDER BY o.id`,
      [f.userId],
    )
  ).rows;
  const reports = (
    await f.admin.query(
      `SELECT to_jsonb(r) AS row FROM treido.reports r WHERE r.reporter_id=$1 ORDER BY r.id`,
      [f.userId],
    )
  ).rows;
  return { orders, reports };
}
