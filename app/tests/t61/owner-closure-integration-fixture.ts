import type { LifecycleNativeContext } from "./lifecycle-fixture";
import { createLifecycleActor, createLifecycleRegistry, createLifecyclePlan } from "./lifecycle-fixture";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";

/** Original T65 preference/request/role/registry cases share this deliberately
 * bounded fresh fixture. Its reviewed plan is never accepted or executed; the
 * cases withdraw its original request and revoke its original synthetic policy.
 * Future approvals are admin-created isolated negatives, never current grants.
 */
export async function createOwnerClosureIntegrationFixture(context: LifecycleNativeContext) {
  const owner = await createLifecycleActor(context), foreign = await createLifecycleActor(context);
  const current = await createLifecycleRegistry(context), future = await createLifecycleRegistry(context, { futurePolicy: true, futureBinding: true });
  const plan = await createLifecyclePlan(context, owner, current);
  const identities: [VerifiedIdentity, VerifiedIdentity] = [owner.identity, foreign.identity];
  const userIds: [string, string] = [owner.userId, foreign.userId];
  return { database: context.database, admin: context.admin, identities, userIds,
    futurePolicyId: future.policyId, futureBindingId: future.bindingId, currentPolicyId: current.policyId, currentBindingId: current.bindingId,
    reviewedPlanId: plan.id, reviewedPlanHash: plan.hash, closureRequestId: owner.closureRequestId };
}
