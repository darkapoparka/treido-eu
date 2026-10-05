import "server-only";
import { randomUUID } from "node:crypto";
import type { SellerTransaction } from "../../server/db/database";
import { inputHash } from "../sellers/persistence.server";
import {
  CLOSURE_LIMITS,
  ClosureError,
  assertNoObligations,
  type ClosurePolicy,
} from "./model";
import { removalDelay } from "./policy";
import { readObligations } from "./obligations.server";
import type {
  FrozenTarget,
  LifecycleBinding,
  PlanPayload,
} from "./storage.server";
export async function buildPlan(
  tx: SellerTransaction,
  userId: string,
  subject: string,
  closureRequestId: string,
  policyId: string,
  policy: ClosurePolicy,
  binding: LifecycleBinding,
  sessions: { id: string }[],
) {
  if (!binding.closureEnabled || sessions.length > CLOSURE_LIMITS.sessions)
    throw new ClosureError("BINDING_REQUIRED");
  const extension = (
    await tx.client.query<{
      facts: {
        assistantLifecycleVersion?: string;
        aftercareLifecycleVersion?: string;
      };
    }>(`SELECT treido.account_closure_extension_facts($1::uuid) AS facts`, [
      userId,
    ])
  ).rows[0]?.facts;
  if (
    extension?.assistantLifecycleVersion !==
      binding.assistantLifecycleVersion ||
    extension.aftercareLifecycleVersion !== binding.aftercareLifecycleVersion
  )
    throw new ClosureError("BINDING_REQUIRED");
  const request = (
    await tx.client.query(
      `SELECT id FROM treido.account_closure_requests WHERE user_id=$1 AND id=$2 AND state='requested' FOR UPDATE`,
      [userId, closureRequestId],
    )
  ).rows[0];
  if (!request) throw new ClosureError("CONFLICT");
  const obligations = await readObligations(tx, userId);
  assertNoObligations(obligations);
  const personalSellers = (
    await tx.client.query<{ id: string; status: string; revision: number }>(
      `SELECT s.id,s.status,s.revision FROM treido.seller_accounts s JOIN treido.personal_seller_owners o ON o.seller_id=s.id WHERE o.user_id=$1 AND s.kind='personal' ORDER BY s.id FOR SHARE OF s,o`,
      [userId],
    )
  ).rows;
  const businessMemberships = (
    await tx.client.query<{ sellerId: string; role: string }>(
      `SELECT seller_id AS "sellerId",role FROM treido.seller_memberships WHERE user_id=$1 AND status='active' ORDER BY seller_id FOR SHARE`,
      [userId],
    )
  ).rows;
  const targets: FrozenTarget[] = sessions.map((session) => ({
    kind: "session.revoke",
    target: { sessionId: session.id },
    dueSeconds: 0,
  }));
  const mediaDelay = removalDelay(policy, "personalMedia");
  if (mediaDelay !== null) {
    if (!binding.mediaScope || !binding.mediaUnversioned)
      throw new ClosureError("BINDING_REQUIRED");
    const objects = (
      await tx.client.query<{
        storageScope: string;
        objectKey: string;
        sellerId: string;
        assetId: string;
      }>(
        `SELECT o.storage_scope AS "storageScope",o.object_key AS "objectKey",o.seller_id AS "sellerId",o.asset_id AS "assetId" FROM treido.media_storage_objects o JOIN treido.personal_seller_owners p ON p.seller_id=o.seller_id WHERE p.user_id=$1 AND o.state<>'deleted' ORDER BY o.storage_scope,o.object_key LIMIT $2 FOR SHARE OF o`,
        [userId, CLOSURE_LIMITS.objects + 1],
      )
    ).rows;
    if (objects.length > CLOSURE_LIMITS.objects)
      throw new ClosureError("QUOTA_EXCEEDED");
    if (objects.some((o) => o.storageScope !== binding.mediaScope))
      throw new ClosureError("BINDING_REQUIRED");
    for (const item of objects)
      targets.push({
        kind: "media.delete",
        target: item,
        dueSeconds: mediaDelay,
      });
  }
  const assistantDelay = removalDelay(policy, "assistantMedia");
  if (assistantDelay !== null) {
    if (!binding.mediaScope || !binding.mediaUnversioned)
      throw new ClosureError("BINDING_REQUIRED");
    const assistant = (
      await tx.client.query<{ targets: FrozenTarget["target"][] }>(
        `SELECT treido.account_closure_assistant_targets($1::uuid,$2::text,$3::text) AS targets`,
        [userId, binding.mediaScope, binding.assistantLifecycleVersion],
      )
    ).rows[0]?.targets;
    if (
      !Array.isArray(assistant) ||
      assistant.length > CLOSURE_LIMITS.objects ||
      assistant.some(
        (target) =>
          target.ownerKind !== "assistant" ||
          target.ownerUserId !== userId ||
          target.storageScope !== binding.mediaScope ||
          typeof target.objectKey !== "string" ||
          typeof target.assetId !== "string",
      )
    )
      throw new ClosureError("NOT_AVAILABLE");
    for (const target of assistant)
      targets.push({
        kind: "media.delete",
        target,
        dueSeconds: assistantDelay,
      });
  }
  const subscriptions = (
    await tx.client.query<{
      sellerId: string;
      subscriptionId: string;
      customerBindingId: string;
      catalogueId: string;
      expectedPriceId: string;
    }>(
      `SELECT seller_id AS "sellerId",subscription_id AS "subscriptionId",customer_binding_id AS "customerBindingId",catalogue_id AS "catalogueId",expected_price_id AS "expectedPriceId" FROM treido.account_read_personal_closure_subscriptions($1::uuid)`,
      [userId],
    )
  ).rows;
  if (subscriptions.length > 10) throw new ClosureError("QUOTA_EXCEEDED");
  if (subscriptions.length && !binding.stripeAccount)
    throw new ClosureError("BINDING_REQUIRED");
  for (const item of subscriptions)
    targets.push({ kind: "billing.stop-renewal", target: item, dueSeconds: 0 });
  // Optional data removal uses a canonical capability and the same frozen reviewed rules.
  for (const category of [
    "profile",
    "library",
    "cart",
    "searches",
    "assistantMedia",
  ] as const) {
    const delay = removalDelay(policy, category);
    if (delay !== null)
      targets.push({
        kind: "data.remove",
        target: { category },
        dueSeconds: delay,
      });
  }
  if (policy.identity === "delete") {
    const delay = removalDelay(policy, "identity");
    if (delay === null) throw new ClosureError("POLICY_REQUIRED");
    targets.push({
      kind: "identity.delete",
      target: { subject },
      dueSeconds: delay,
    });
  }
  if (targets.length > CLOSURE_LIMITS.effects)
    throw new ClosureError("QUOTA_EXCEEDED");
  const clock = (
    await tx.client.query<{ now: Date; expiry: Date }>(
      `SELECT clock_timestamp() AS now,clock_timestamp()+interval '15 minutes' AS expiry`,
    )
  ).rows[0];
  const payload: PlanPayload = {
    version: 1,
    userId,
    subject,
    closureRequestId,
    policyId,
    bindingId: binding.id,
    policy,
    obligations,
    targets,
    personalSellers,
    businessMemberships,
    createdAt: clock.now.toISOString(),
    expiresAt: clock.expiry.toISOString(),
  };
  const id = randomUUID(),
    hash = inputHash(payload);
  await tx.client.query(
    `INSERT INTO treido.account_execution_plans(id,user_id,closure_request_id,policy_id,binding_id,plan_hash,payload,state,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'reviewed',$8,$9)`,
    [
      id,
      userId,
      closureRequestId,
      policyId,
      binding.id,
      hash,
      JSON.stringify(payload),
      clock.now,
      clock.expiry,
    ],
  );
  return { id, hash };
}
export async function createPlanEffects(
  tx: SellerTransaction,
  planId: string,
  userId: string,
  payload: PlanPayload,
) {
  // Keep the accepted PostgreSQL clock precise inside this locked transaction.
  for (const item of payload.targets) {
    const id = randomUUID();
    await tx.client.query(
      `INSERT INTO treido.account_lifecycle_effects(id,user_id,plan_id,binding_id,subject,kind,target,target_hash,operation_key,due_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,(SELECT p.accepted_at FROM treido.account_execution_plans p WHERE p.id=$3 AND p.user_id=$2 AND p.accepted_at IS NOT NULL)+make_interval(secs=>$10::integer)) ON CONFLICT(plan_id,kind,target_hash) DO NOTHING`,
      [
        id,
        userId,
        planId,
        payload.bindingId,
        payload.subject,
        item.kind,
        JSON.stringify(item.target),
        inputHash(item.target),
        randomUUID(),
        item.dueSeconds,
      ],
    );
  }
}
