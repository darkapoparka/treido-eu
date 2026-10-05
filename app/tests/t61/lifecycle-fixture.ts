import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import { authorizeHuman, ensurePersonalSeller } from "../../apps/web/src/features/sellers/persistence.server";
import { changePrivacy } from "../../apps/web/src/features/account-privacy/commands.server";
import { privacyActorKey } from "../../apps/web/src/features/account-privacy/storage.server";
import { categories, type ClosurePolicy } from "../../apps/web/src/features/account-closure/model";
import { approvedBinding, bindingColumns, type LifecycleBinding } from "../../apps/web/src/features/account-closure/storage.server";
import { buildPlan } from "../../apps/web/src/features/account-closure/planning.server";

export type LifecycleNativeContext = { database: SellerDatabase; admin: Pool; registerRecent: (identity: VerifiedIdentity) => void };
export const lifecycleNamespace = { environment: "test", applicationId: "app_T61Native" };

/** All registry rows are visibly synthetic and confined to the fresh native
 * cluster. Original measured extension functions remain mandatory; no zero
 * facts/authority/approval helper is mocked. The baseline binding lets isolated
 * future-binding fixtures reach the intended original native acceptance gate.
 */
export async function ensureLifecycleContract(context: LifecycleNativeContext) {
  const policies = (await context.admin.query<{ id: string; application_id: string; environment: string }>(`SELECT p.id,p.application_id,p.environment FROM treido.order_aftercare_lifecycle_policies p
    WHERE p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL AND EXISTS(SELECT 1 FROM treido.account_lifecycle_bindings b WHERE b.application_id=p.application_id AND b.environment=p.environment AND b.aftercare_lifecycle_version=p.version AND b.closure_enabled AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL)`)).rows;
  if (policies.length > 1) throw Error("Original lifecycle fixture requires exactly one current reviewed aftercare namespace");
  if (!policies.length) {
    const namespace = "t61-lifecycle-" + randomUUID();
    await context.admin.query(`INSERT INTO treido.order_aftercare_lifecycle_policies(id,version,environment,application_id,preserves_accepted_evidence,legal_holds_reviewed,allow_restore_restriction,retention_description,approved_at,approval_reference)
      VALUES($1,'order-aftercare-v1','test',$3,true,true,true,$2::jsonb,clock_timestamp(),'SYNTHETIC ISOLATED T61 ONLY')`, [randomUUID(), JSON.stringify({ bg: "Синтетичен тест", en: "Synthetic isolated test" }), namespace]);
    await context.admin.query(`INSERT INTO treido.account_lifecycle_bindings(id,environment,application_id,clerk_instance_id,clerk_mode,assistant_lifecycle_version,aftercare_lifecycle_version,security_enabled,closure_enabled,approved_at)
      VALUES($1,'test',$2,'ins_T61Native','test','assistant-input-v1','order-aftercare-v1',true,true,clock_timestamp())`, [randomUUID(), namespace]);
  }
  const existing = (await context.admin.query<{ id: string }>(`SELECT id FROM treido.account_lifecycle_bindings WHERE environment='test' AND application_id='app_T61Native' AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND closure_enabled AND assistant_lifecycle_version='assistant-input-v1' AND aftercare_lifecycle_version='order-aftercare-v1' LIMIT 1`)).rows[0];
  if (!existing) await context.admin.query(`INSERT INTO treido.account_lifecycle_bindings(id,environment,application_id,clerk_instance_id,clerk_mode,assistant_lifecycle_version,aftercare_lifecycle_version,security_enabled,closure_enabled,approved_at)
    VALUES($1,'test','app_T61Native','ins_T61Native','test','assistant-input-v1','order-aftercare-v1',true,true,clock_timestamp())`, [randomUUID()]);
}

export async function createLifecycleActor(context: LifecycleNativeContext, personalSeller = false) {
  const identity: VerifiedIdentity = { subject: "user_t61_closure_" + randomUUID().replaceAll("-", "") };
  context.registerRecent(identity);
  const user = await inTransaction(context.database, tx => authorizeHuman(tx, identity, true));
  const sellerId = personalSeller ? await ensurePersonalSeller(context.database, identity) : null;
  const review = await changePrivacy(context.database, identity, { version: 1, actorKey: privacyActorKey(identity), requestId: randomUUID(), expectedRevision: 0, operation: { kind: "review" } });
  const request = await changePrivacy(context.database, identity, { version: 1, actorKey: privacyActorKey(identity), requestId: randomUUID(), expectedRevision: review.acknowledgment.revision,
    operation: { kind: "submit", reviewId: review.acknowledgment.resourceId, acknowledged: true } });
  await context.database.pool.query("INSERT INTO treido.account_lifecycle_workspaces(user_id) VALUES($1)", [user.id]);
  return { identity, userId: user.id, sellerId, closureRequestId: request.acknowledgment.resourceId };
}

export async function createLifecycleRegistry(context: LifecycleNativeContext, options: { futurePolicy?: boolean; futureBinding?: boolean } = {}) {
  await ensureLifecycleContract(context);
  const policyId = randomUUID(), bindingId = randomUUID();
  const value: ClosurePolicy = { version: "t61-" + policyId, approvalReference: "SYNTHETIC OWNED NATIVE TEST ONLY",
    summary: { bg: "Синтетичен тест", en: "Synthetic test" },
    rules: categories.map(category => ({ category, handling: "retain", purpose: { bg: "Тест", en: "Test" }, trigger: "obligationsResolved", delaySeconds: null, explanation: { bg: "Тест", en: "Test" } })),
    identity: "revoke", personalBilling: "stop-renewal", preservesAcceptedEvidence: true, reversibleBeforeEffects: true };
  await context.admin.query("INSERT INTO treido.account_closure_policies(id,version,payload,approved_at) VALUES($1,$2,$3::jsonb,clock_timestamp()+make_interval(secs=>$4))", [policyId, value.version, JSON.stringify(value), options.futurePolicy ? 86400 : 0]);
  await context.admin.query(`INSERT INTO treido.account_lifecycle_bindings(id,environment,application_id,clerk_instance_id,clerk_mode,assistant_lifecycle_version,aftercare_lifecycle_version,security_enabled,closure_enabled,approved_at)
    VALUES($1,'test','app_T61Native','ins_T61Native','test','assistant-input-v1','order-aftercare-v1',true,true,clock_timestamp()+make_interval(secs=>$2))`, [bindingId, options.futureBinding ? 86400 : 0]);
  // Deliberately future registry rows are admin-read fixtures ONLY. The real
  // source reader and native acceptance must independently reject them.
  const binding = options.futureBinding
    ? (await context.admin.query<LifecycleBinding>(`SELECT ${bindingColumns} FROM treido.account_lifecycle_bindings WHERE id=$1`, [bindingId])).rows[0]
    : await inTransaction(context.database, tx => approvedBinding(tx, bindingId));
  return { policyId, bindingId, value, binding };
}

export async function createLifecyclePlan(context: LifecycleNativeContext, owner: Awaited<ReturnType<typeof createLifecycleActor>>, rules: Awaited<ReturnType<typeof createLifecycleRegistry>>, sessions: { id: string }[] = []) {
  return inTransaction(context.database, async tx => {
    await authorizeHuman(tx, owner.identity, true);
    // Explicit synthetic COMPLETE caller inventory (empty by default). No actual Clerk
    // session/provider qualification is claimed by this native planner fixture.
    return buildPlan(tx, owner.userId, owner.identity.subject, owner.closureRequestId, rules.policyId, rules.value, rules.binding, sessions);
  });
}
