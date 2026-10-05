import "server-only";
import { createHmac } from "node:crypto";
import type { SellerTransaction } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import {
  ClosureError,
  type ClosurePolicy,
  type EffectKind,
  type EffectState,
  type Obligations,
  type PlanState,
} from "./model";
import { parsePolicy } from "./policy";
import type { CleanupResource } from "./acceptance-resources.server";
export function actorKey(identity: VerifiedIdentity) {
  return createHmac("sha256", publicDiscoveryKey())
    .update("account-lifecycle-v1:" + identity.subject)
    .digest("hex");
}
export function sessionRef(subject: string, id: string) {
  return createHmac("sha256", publicDiscoveryKey())
    .update(JSON.stringify(["account-session-v1", subject, id]))
    .digest("hex");
}
export function requireRecent(identity: VerifiedIdentity) {
  if (!hasVerifiedRecentAuthentication(identity))
    throw new ClosureError("RECENT_AUTH_REQUIRED");
}
export async function storageReady(tx: SellerTransaction) {
  const row = (
    await tx.client.query<{ ready: boolean }>(
      `SELECT to_regclass('treido.account_lifecycle_workspaces') IS NOT NULL AND to_regclass('treido.account_closure_policies') IS NOT NULL AND to_regclass('treido.account_lifecycle_bindings') IS NOT NULL AND to_regclass('treido.account_execution_plans') IS NOT NULL AND to_regclass('treido.account_lifecycle_effects') IS NOT NULL AND to_regclass('treido.account_lifecycle_receipts') IS NOT NULL AND to_regprocedure('treido.account_closure_extension_facts(uuid)') IS NOT NULL AND to_regprocedure('treido.account_closure_cleanup_resources(uuid,boolean,boolean)') IS NOT NULL AND to_regprocedure('treido.account_read_approved_binding(uuid)') IS NOT NULL AND to_regprocedure('treido.account_read_approved_policy(uuid)') IS NOT NULL AND to_regprocedure('treido.account_read_closure_plan(uuid,uuid,boolean)') IS NOT NULL AND to_regprocedure('treido.account_lock_security_effect(uuid,text,text)') IS NOT NULL AND to_regprocedure('treido.account_read_personal_closure_subscriptions(uuid)') IS NOT NULL AND to_regprocedure('treido.account_enqueue_closure(uuid)') IS NOT NULL AND to_regprocedure('treido.account_repair_closure(integer)') IS NOT NULL AS ready`,
    )
  ).rows[0];
  if (!row?.ready) throw new ClosureError("NOT_AVAILABLE");
}
export type LifecycleBinding = {
  id: string;
  environment: string;
  applicationId: string;
  clerkInstanceId: string;
  clerkMode: "test" | "live";
  mediaScope: string | null;
  mediaUnversioned: boolean;
  stripeAccount: string | null;
  stripeMode: boolean | null;
  stripeApplicationId: string | null;
  assistantLifecycleVersion: string;
  aftercareLifecycleVersion: string;
  securityEnabled: boolean;
  closureEnabled: boolean;
};
export const bindingColumns = `id,environment,application_id AS "applicationId",clerk_instance_id AS "clerkInstanceId",clerk_mode AS "clerkMode",media_scope AS "mediaScope",media_unversioned AS "mediaUnversioned",stripe_account AS "stripeAccount",stripe_livemode AS "stripeMode",stripe_application_id AS "stripeApplicationId",assistant_lifecycle_version AS "assistantLifecycleVersion",aftercare_lifecycle_version AS "aftercareLifecycleVersion",security_enabled AS "securityEnabled",closure_enabled AS "closureEnabled"`;
export async function approvedBinding(tx: SellerTransaction, id?: string) {
  const row = (
    await tx.client.query<LifecycleBinding>(
      `SELECT ${bindingColumns} FROM treido.account_read_approved_binding($1::uuid)`,
      [id || null],
    )
  ).rows[0];
  if (!row) throw new ClosureError("BINDING_REQUIRED");
  return row;
}
export async function approvedPolicy(
  tx: SellerTransaction,
  id?: string,
): Promise<{ id: string; value: ClosurePolicy }> {
  const row = (
    await tx.client.query<{ id: string; payload: unknown }>(
      `SELECT id,payload FROM treido.account_read_approved_policy($1::uuid)`,
      [id || null],
    )
  ).rows[0];
  if (!row) throw new ClosureError("POLICY_REQUIRED");
  return { id: row.id, value: parsePolicy(row.payload) };
}
export type FrozenTarget = {
  kind: EffectKind;
  target: Record<string, string | number | boolean | null>;
  dueSeconds: number;
};
export type PlanPayload = {
  version: 1;
  userId: string;
  subject: string;
  closureRequestId: string;
  policyId: string;
  bindingId: string;
  policy: ClosurePolicy;
  obligations: Obligations;
  targets: FrozenTarget[];
  cleanupResources?: CleanupResource[];
  personalSellers: { id: string; status: string; revision: number }[];
  businessMemberships: { sellerId: string; role: string }[];
  createdAt: string;
  expiresAt: string;
};
export type PlanRow = {
  id: string;
  userId: string;
  hash: string;
  payload: PlanPayload;
  state: PlanState;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  firstEffectAt: Date | null;
  acceptanceKey: string | null;
};
export const planColumns = `id,user_id AS "userId",plan_hash AS hash,payload,state,created_at AS "createdAt",expires_at AS "expiresAt",accepted_at AS "acceptedAt",first_effect_at AS "firstEffectAt",acceptance_key AS "acceptanceKey"`;
/** Current actor/job authority is checked by the caller; both owner and plan scope are required. */
export async function readClosurePlan(
  tx: SellerTransaction,
  userId: string,
  planId: string,
  exclusive: boolean,
) {
  return (
    await tx.client.query<PlanRow & { expired: boolean }>(
      `SELECT ${planColumns},expires_at<=clock_timestamp() AS expired FROM treido.account_read_closure_plan($1::uuid,$2::uuid,$3::boolean)`,
      [userId, planId, exclusive],
    )
  ).rows[0];
}
export type EffectRow = {
  id: string;
  userId: string;
  planId: string | null;
  kind: EffectKind;
  state: EffectState;
  target: FrozenTarget["target"];
  bindingId: string;
  subject: string;
  operationKey: string;
  firstAttemptAt: Date | null;
  leaseToken: string | null;
  leaseUntil: Date | null;
};
export const effectColumns = `id,user_id AS "userId",plan_id AS "planId",kind,state,target,binding_id AS "bindingId",subject,operation_key AS "operationKey",first_attempt_at AS "firstAttemptAt",lease_token AS "leaseToken",lease_until AS "leaseUntil"`;
export async function lockOwnSecurityEffect(
  tx: SellerTransaction,
  userId: string,
  subject: string,
  targetHash: string,
) {
  return (
    await tx.client.query<{ id: string }>(
      `SELECT id FROM treido.account_lock_security_effect($1::uuid,$2::text,$3::text)`,
      [userId, subject, targetHash],
    )
  ).rows[0];
}
/** Lifecycle-only own recovery. Does not authorize ordinary work for an inactive human. */
export async function ownLifecycleUser(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  exclusive: boolean,
) {
  const row = (
    await tx.client.query<{
      id: string;
      status: "active" | "restricted" | "closed";
    }>(
      `SELECT id,status FROM treido.users WHERE clerk_subject=$1 FOR ${exclusive ? "UPDATE" : "SHARE"}`,
      [identity.subject],
    )
  ).rows[0];
  if (!row) throw new ClosureError("NOT_FOUND");
  if (row.status !== "active") {
    const accepted = (
      await tx.client.query<{ id: string }>(
        `SELECT id FROM treido.account_execution_plans WHERE user_id=$1 AND state IN('accepted','processing','reconciling','blocked','completed') AND accepted_at IS NOT NULL LIMIT 1`,
        [row.id],
      )
    ).rows[0];
    if (!accepted) throw new ClosureError("FORBIDDEN");
  }
  return row;
}
