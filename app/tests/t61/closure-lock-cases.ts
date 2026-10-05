import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { inTransaction } from "../../apps/web/src/server/db/database";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { approvedBinding, approvedPolicy, lockOwnSecurityEffect, readClosurePlan } from "../../apps/web/src/features/account-closure/storage.server";
import { createLifecycleActor, createLifecycleRegistry, createLifecyclePlan } from "./lifecycle-fixture";
import type { ExecutorFixtureContext } from "./executor-completion-fixture";
import { runRetiredPersonalBillingClosure } from "./closure-billing-fixture";

/** Additive actual restricted-reader regressions. Original182 definitions and
 * all original closure/business/unknown-financial assertions remain intact. */
export function defineClosureLockPersistenceCases(get: () => ExecutorFixtureContext & {
  recordAdapterCounters: (label: string, read: () => Record<string, number>) => void;
}) {
  describe("original connected closure locks on restricted native runtime", () => {
    it("own shared/exclusive plan reads preserve projection and exclude foreign/null authority without mutation rights", async () => {
      const context = get(), owner = await createLifecycleActor(context), foreign = await createLifecycleActor(context);
      const rules = await createLifecycleRegistry(context), plan = await createLifecyclePlan(context, owner, rules);
      for (const exclusive of [false, true]) {
        const row = await inTransaction(context.database, tx => readClosurePlan(tx, owner.userId, plan.id, exclusive));
        expect(row).toMatchObject({ id: plan.id, userId: owner.userId, hash: plan.hash, state: "reviewed", acceptedAt: null, expired: false });
        expect(await inTransaction(context.database, tx => readClosurePlan(tx, foreign.userId, plan.id, exclusive))).toBeUndefined();
      }
      await expect(context.database.pool.query("SELECT * FROM treido.account_read_closure_plan($1,$2,NULL)", [owner.userId, plan.id])).rejects.toMatchObject({ code: "23514" });
      expect((await context.database.pool.query("SELECT * FROM treido.account_read_closure_plan(NULL,$1,false)", [plan.id])).rows).toEqual([]);
      await expect(context.database.pool.query("UPDATE treido.account_execution_plans SET state='accepted' WHERE id=$1", [plan.id])).rejects.toMatchObject({ code: "42501" });
      expect((await context.admin.query("SELECT state,accepted_at FROM treido.account_execution_plans WHERE id=$1", [plan.id])).rows[0]).toEqual({ state: "reviewed", accepted_at: null });
    });
    it("security reader locks only the active exact subject and own unresolved standalone target", async () => {
      const context = get(), owner = await createLifecycleActor(context), foreign = await createLifecycleActor(context), rules = await createLifecycleRegistry(context);
      const target = { sessionId: "SYNTHETIC-OWN-STANDALONE-LOCK" }, digest = inputHash(target), id = randomUUID();
      await context.admin.query("INSERT INTO treido.account_lifecycle_effects(id,user_id,binding_id,subject,kind,target,target_hash,operation_key,due_at) VALUES($1,$2,$3,$4,'session.revoke',$5::jsonb,$6,$7,clock_timestamp())", [id, owner.userId, rules.bindingId, owner.identity.subject, JSON.stringify(target), digest, randomUUID()]);
      const before = (await context.admin.query("SELECT * FROM treido.account_lifecycle_effects WHERE id=$1", [id])).rows[0];
      expect(await inTransaction(context.database, tx => lockOwnSecurityEffect(tx, owner.userId, owner.identity.subject, digest))).toEqual({ id });
      expect(await inTransaction(context.database, tx => lockOwnSecurityEffect(tx, foreign.userId, foreign.identity.subject, digest))).toBeUndefined();
      expect(await inTransaction(context.database, tx => lockOwnSecurityEffect(tx, owner.userId, owner.identity.subject, inputHash({ sessionId: "OTHER" })))).toBeUndefined();
      await expect(inTransaction(context.database, tx => lockOwnSecurityEffect(tx, owner.userId, foreign.identity.subject, digest))).rejects.toMatchObject({ code: "23514" });
      await expect(context.database.pool.query("UPDATE treido.account_lifecycle_effects SET state='confirmed' WHERE id=$1", [id])).rejects.toMatchObject({ code: "42501" });
      expect((await context.admin.query("SELECT * FROM treido.account_lifecycle_effects WHERE id=$1", [id])).rows[0]).toEqual(before);
    });
    for (const kind of ["policy", "binding"] as const) {
      it(`actual ${kind} reader holds revocation lock without granting runtime approval mutation`, async () => {
        const context = get(), rules = await createLifecycleRegistry(context);
        const table = kind === "policy" ? "account_closure_policies" : "account_lifecycle_bindings", id = kind === "policy" ? rules.policyId : rules.bindingId;
        const acl = (await context.database.pool.query("SELECT has_table_privilege(current_user,$1,'INSERT') AS insert,has_table_privilege(current_user,$1,'UPDATE') AS update,has_table_privilege(current_user,$1,'DELETE') AS delete", ["treido." + table])).rows[0];
        expect(acl).toEqual({ insert: false, update: false, delete: false });
        const publicExecute = (await context.database.pool.query("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) rights WHERE ns.nspname='treido' AND p.proname IN('account_read_approved_binding','account_read_approved_policy','account_read_closure_plan','account_lock_security_effect','account_read_personal_closure_subscriptions') AND rights.grantee=0 AND rights.privilege_type='EXECUTE'")).rows[0].n;
        expect(publicExecute).toBe(0);
        await inTransaction(context.database, async tx => {
          expect((await (kind === "policy" ? approvedPolicy : approvedBinding)(tx, id)).id).toBe(id);
          const contender = await context.admin.connect();
          try {
            await contender.query("BEGIN");
            await contender.query("SET LOCAL lock_timeout='250ms'");
            await expect(contender.query(`UPDATE treido.${table} SET revoked_at=clock_timestamp() WHERE id=$1`, [id])).rejects.toMatchObject({ code: "55P03" });
          } finally { await contender.query("ROLLBACK"); contender.release(); }
        });
        await context.admin.query(`UPDATE treido.${table} SET revoked_at=clock_timestamp() WHERE id=$1`, [id]);
        await expect(inTransaction(context.database, async tx => {
          if (kind === "policy") await approvedPolicy(tx, id);
          else await approvedBinding(tx, id);
        })).rejects.toMatchObject({ code: kind === "policy" ? "POLICY_REQUIRED" : "BINDING_REQUIRED" });
        await expect(context.database.pool.query(`UPDATE treido.${table} SET revoked_at=NULL WHERE id=$1`, [id])).rejects.toMatchObject({ code: "42501" });
      });
    }
    it("original accepted personal closure cancels renewal of a revoked historical catalogue through genuine leased processor and local SDK", async () => {
      await runRetiredPersonalBillingClosure(get());
    });
  });
}
