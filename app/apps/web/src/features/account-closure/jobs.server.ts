import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { EffectResult } from "../../server/jobs/execution.server";
import { JobError } from "../../server/jobs/model";
import { inputHash } from "../sellers/persistence.server";
import { ClosureError, uuid } from "./model";
import {
  approvedBinding,
  approvedPolicy,
  effectColumns,
  readClosurePlan,
  type EffectRow,
  type PlanRow,
} from "./storage.server";
import { performLifecycleEffect } from "./effects.server";
export type ClosureJobContext = {
  id: string;
  kind: "account.closure";
  authority: "closure";
  sellerId: null;
  buyerId: string;
  actorId: null;
  resourceId: string;
  operationKey: string;
  generation: number;
  executionToken: string;
};
/** Dedicated accepted-plan lifecycle authority. Never calls authorizeHuman with an exception. */
export async function authorizeClosureJob(
  tx: SellerTransaction,
  job: ClosureJobContext,
): Promise<PlanRow> {
  if (
    job.kind !== "account.closure" ||
    job.authority !== "closure" ||
    job.sellerId !== null ||
    job.actorId !== null ||
    ![
      job.id,
      job.buyerId,
      job.resourceId,
      job.operationKey,
      job.executionToken,
    ].every(uuid) ||
    !Number.isSafeInteger(job.generation) ||
    job.generation < 1
  )
    throw new ClosureError("FORBIDDEN");
  const plan = await readClosurePlan(tx, job.buyerId, job.resourceId, false);
  if (
    !plan ||
    !plan.acceptedAt ||
    plan.acceptanceKey !== job.operationKey ||
    inputHash(plan.payload) !== plan.hash ||
    ["reviewed", "cancelled"].includes(plan.state)
  )
    throw new ClosureError("FORBIDDEN");
  const actual = (
    await tx.client.query(
      `SELECT j.id FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id JOIN treido.users u ON u.id=j.buyer_id WHERE j.id=$1 AND j.kind='account.closure' AND j.authority='closure' AND j.seller_id IS NULL AND j.buyer_id=$2 AND j.actor_id IS NULL AND j.resource_id=$3 AND j.operation_key=$4 AND j.generation=$5 AND e.state='running' AND e.execution_token=$6 AND e.execution_until>clock_timestamp() AND u.clerk_subject=$7 AND u.status IN('restricted','closed')`,
      [
        job.id,
        job.buyerId,
        job.resourceId,
        job.operationKey,
        job.generation,
        job.executionToken,
        plan.payload.subject,
      ],
    )
  ).rows[0];
  if (!actual) throw new ClosureError("FORBIDDEN");
  await approvedBinding(tx, plan.payload.bindingId);
  const policy = await approvedPolicy(tx, plan.payload.policyId);
  if (inputHash(policy.value) !== inputHash(plan.payload.policy))
    throw new ClosureError("FORBIDDEN");
  return plan;
}
export async function processClosureJob(
  database: SellerDatabase,
  job: ClosureJobContext,
): Promise<EffectResult> {
  const started = Date.now();
  for (let step = 0; step < 5 && Date.now() - started < 8000; step++) {
    const next = await inTransaction(database, async (tx) => {
      const plan = await authorizeClosureJob(tx, job);
      if (plan.state === "completed") return { completed: true, effect: null };
      const effect =
        (
          await tx.client.query<EffectRow>(
            `SELECT ${effectColumns} FROM treido.account_lifecycle_effects WHERE plan_id=$1 AND user_id=$2 AND state<>'confirmed' AND due_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<clock_timestamp()) ORDER BY CASE kind WHEN 'billing.stop-renewal' THEN 1 WHEN 'media.delete' THEN 2 WHEN 'data.remove' THEN 3 WHEN 'session.revoke' THEN 4 ELSE 5 END,created_at,id LIMIT 1`,
            [plan.id, job.buyerId],
          )
        ).rows[0] ?? null;
      return { completed: false, effect };
    });
    if (next.completed) break;
    if (!next.effect) break;
    const state = await performLifecycleEffect(database, next.effect, {
      jobId: job.id,
      executionToken: job.executionToken,
    });
    if (state !== "confirmed") throw new JobError("NOT_AVAILABLE");
  }
  return {
    resultId: job.resourceId,
    lock: async (tx) => {
      await authorizeClosureJob(tx, job);
    },
    apply: async (tx) => {
      const plan = await authorizeClosureJob(tx, job);
      if (plan.state === "completed") return;
      const pending = (
        await tx.client.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM treido.account_lifecycle_effects WHERE plan_id=$1 AND state<>'confirmed'`,
          [plan.id],
        )
      ).rows[0].count;
      if (pending) throw new JobError("NOT_AVAILABLE");
      await tx.client.query(
        `SELECT treido.account_finish_closure($1::uuid,$2::uuid,$3::uuid,$4::uuid)`,
        [job.buyerId, plan.id, job.id, job.executionToken],
      );
    },
  };
}
/** Canonical repair requeues the original immutable plan intent/generation; never an effect POST. */
export async function scheduleClosureRepair(
  database: SellerDatabase,
): Promise<number> {
  return inTransaction(database, async (tx) => {
    const ready = (
      await tx.client.query<{ ready: boolean }>(
        `SELECT to_regprocedure('treido.account_repair_closure(integer)') IS NOT NULL AS ready`,
      )
    ).rows[0]?.ready;
    if (!ready) return 0;
    return (
      await tx.client.query<{ count: number }>(
        `SELECT treido.account_repair_closure(20) AS count`,
      )
    ).rows[0].count;
  });
}
