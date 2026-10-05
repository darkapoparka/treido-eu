import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../db/database";
import { inputHash } from "../../features/sellers/persistence.server";
import {
  JobError,
  JOB_LIMITS,
  validateJobIntent,
  isAssistantJobKind,
  isShippingJobKind,
  type ShippingJobKind,
  type AssistantJobKind,
  type JobIntent,
  type SellerJobKind,
  type JobState,
} from "./model";
import { validId } from "../../features/selling/draft-model";

export type SellerJobRow = {
  id: string;
  kind: SellerJobKind;
  sellerId: string;
  buyerId?: null;
  resourceId: string;
  operationKey: string;
  actorId: string | null;
  authority: "member" | "service";
  state: JobState;
  generation: number;
  attempts: number;
};
export type BuyerJobRow = Omit<
  SellerJobRow,
  "kind" | "sellerId" | "buyerId" | "actorId" | "authority"
> & {
  kind: "buyer.saved-search";
  sellerId: null;
  buyerId: string;
  actorId: string;
  authority: "buyer";
};
export type AssistantJobRow = Omit<
  SellerJobRow,
  "kind" | "sellerId" | "buyerId" | "actorId" | "authority"
> & {
  kind: AssistantJobKind;
  sellerId: null;
  buyerId: string;
  actorId: null;
  authority: "assistant";
};
export type ClosureJobRow = Omit<AssistantJobRow, "kind" | "authority"> & {
  kind: "account.closure";
  authority: "closure";
};
export type ShippingJobRow = {
  [K in ShippingJobKind]: Omit<AssistantJobRow, "kind" | "authority"> & {
    kind: K;
    authority: "shipping";
  };
}[ShippingJobKind];
export function isShippingJob(job: JobRow): job is ShippingJobRow {
  return isShippingJobKind(job.kind);
}
export type JobRow =
  SellerJobRow | BuyerJobRow | AssistantJobRow | ClosureJobRow | ShippingJobRow;
export function isAssistantJob(job: JobRow): job is AssistantJobRow {
  return isAssistantJobKind(job.kind);
}
export type LeasedJob = JobRow & { dispatchToken: string };
export const jobColumns = `id, kind, seller_id AS "sellerId", buyer_id AS "buyerId", resource_id AS "resourceId",
  operation_key AS "operationKey", actor_id AS "actorId", authority, state, generation, attempts`;

/** The caller holds the feature's authority/resource locks on this same transaction. */
export async function enqueueJob(tx: SellerTransaction, intent: JobIntent) {
  validateJobIntent(intent);
  const hash = inputHash(intent);
  const id = randomUUID();
  await tx.client.query(
    `INSERT INTO treido.outbox_jobs
     (id, kind, seller_id, resource_id, operation_key, actor_id, authority, intent_hash,buyer_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (kind, operation_key) DO NOTHING`,
    [
      id,
      intent.kind,
      intent.sellerId,
      intent.resourceId,
      intent.operationKey,
      intent.actorId,
      intent.authority,
      hash,
      intent.buyerId ?? null,
    ],
  );
  const result = await tx.client.query<{ id: string; hash: string }>(
    `SELECT id, intent_hash AS hash FROM treido.outbox_jobs WHERE kind=$1 AND operation_key=$2`,
    [intent.kind, intent.operationKey],
  );
  const row = result.rows[0];
  if (!row || row.hash !== hash) throw new JobError("CONFLICT");
  await tx.client.query(
    `INSERT INTO treido.job_effects(job_id,kind,operation_key) VALUES ($1,$2,$3)
     ON CONFLICT (job_id) DO NOTHING`,
    [row.id, intent.kind, intent.operationKey],
  );
  return row.id;
}

export async function leaseJobs(
  database: SellerDatabase,
  limit: number = JOB_LIMITS.batch,
): Promise<LeasedJob[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > JOB_LIMITS.batch)
    throw new JobError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    // An expired execution is an unknown outcome. Its consumer must reconcile
    // with the original effect key; reaching the dispatch budget stops redelivery.
    await tx.client.query(
      `UPDATE treido.outbox_jobs j SET state='dead', last_error='attempts_exhausted',
       dispatch_token=NULL, dispatch_until=NULL
       WHERE state IN ('pending','accepted') AND attempts >= $1
       AND available_at <= clock_timestamp()
       AND (dispatch_until IS NULL OR dispatch_until < clock_timestamp())
       AND NOT EXISTS (SELECT 1 FROM treido.job_effects e WHERE e.job_id=j.id
         AND e.state='running' AND e.execution_until > clock_timestamp())`,
      [JOB_LIMITS.attempts],
    );
    const token = randomUUID();
    const rows = await tx.client.query<LeasedJob>(
      `WITH selected AS (
       SELECT j.id FROM treido.outbox_jobs j WHERE j.state IN ('pending','accepted')
       AND j.available_at <= clock_timestamp() AND j.attempts < $1
       AND (j.dispatch_until IS NULL OR j.dispatch_until < clock_timestamp())
       AND NOT EXISTS (SELECT 1 FROM treido.job_effects e WHERE e.job_id=j.id
         AND e.state='running' AND e.execution_until > clock_timestamp())
       ORDER BY j.available_at,j.id LIMIT $2 FOR UPDATE OF j SKIP LOCKED)
       UPDATE treido.outbox_jobs j SET dispatch_token=$3,
         dispatch_until=clock_timestamp()+make_interval(secs=>$4), attempts=j.attempts+1
      FROM selected s WHERE j.id=s.id RETURNING j.id,j.kind,j.seller_id AS "sellerId",
         j.buyer_id AS "buyerId",
         j.resource_id AS "resourceId",j.operation_key AS "operationKey",j.actor_id AS "actorId",
         j.authority,j.state,j.generation,j.attempts,j.dispatch_token AS "dispatchToken"`,
      [JOB_LIMITS.attempts, limit, token, JOB_LIMITS.leaseSeconds],
    );
    return rows.rows;
  });
}

export async function recordHandoff(
  database: SellerDatabase,
  job: LeasedJob,
  eventId: string,
) {
  if (!/^[A-Za-z0-9:_-]{1,160}$/.test(eventId))
    throw new JobError("INVALID_INPUT");
  const result = await database.pool.query(
    `UPDATE treido.outbox_jobs SET state='accepted',executor_event_id=$4,
     accepted_at=COALESCE(accepted_at,clock_timestamp()), progress_at=clock_timestamp(),
     available_at=clock_timestamp()+make_interval(secs=>$5), dispatch_token=NULL, dispatch_until=NULL,last_error=NULL
     WHERE id=$1 AND generation=$2 AND dispatch_token=$3 AND dispatch_until > clock_timestamp()
     AND state IN ('pending','accepted') RETURNING id`,
    [
      job.id,
      job.generation,
      job.dispatchToken,
      eventId,
      JOB_LIMITS.stalledSeconds,
    ],
  );
  return result.rowCount === 1;
}

export async function releaseDispatch(
  database: SellerDatabase,
  job: LeasedJob,
) {
  const result = await database.pool.query(
    `UPDATE treido.outbox_jobs SET dispatch_token=NULL,dispatch_until=NULL,
     state=CASE WHEN attempts >= $4 THEN 'dead' ELSE state END,
     last_error='dispatch_unavailable',available_at=clock_timestamp()+make_interval(secs=>$5)
     WHERE id=$1 AND generation=$2 AND dispatch_token=$3 AND dispatch_until > clock_timestamp()
     AND state IN ('pending','accepted') RETURNING id`,
    [
      job.id,
      job.generation,
      job.dispatchToken,
      JOB_LIMITS.attempts,
      Math.min(300, 2 ** job.attempts),
    ],
  );
  return result.rowCount === 1;
}

/** Only a verified repair service with explicit redrive scope may call this. */
export async function redriveJob(
  database: SellerDatabase,
  input: {
    jobId: string;
    expectedGeneration: number;
    serviceId: string;
    reason: string;
  },
) {
  if (
    !validId(input.jobId) ||
    !Number.isSafeInteger(input.expectedGeneration) ||
    input.expectedGeneration < 1 ||
    !/^[a-z][a-z0-9-]{1,79}$/.test(input.serviceId) ||
    typeof input.reason !== "string" ||
    input.reason.trim().length < 10 ||
    input.reason.length > 500
  )
    throw new JobError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const job = (
      await tx.client.query<JobRow>(
        `SELECT ${jobColumns} FROM treido.outbox_jobs WHERE id=$1 FOR UPDATE`,
        [input.jobId],
      )
    ).rows[0];
    if (!job) throw new JobError("NOT_FOUND");
    if (job.state !== "dead" || job.generation !== input.expectedGeneration)
      throw new JobError("CONFLICT");
    const effect = await tx.client.query<{ state: string; active: boolean }>(
      `SELECT state,execution_until > clock_timestamp() AS active FROM treido.job_effects WHERE job_id=$1 FOR UPDATE`,
      [job.id],
    );
    if (effect.rows[0]?.state === "completed" || effect.rows[0]?.active)
      throw new JobError("CONFLICT");
    await tx.client.query(
      `INSERT INTO treido.job_redrives(id,job_id,service_id,reason,from_generation,to_generation)
      VALUES($1,$2,$3,$4,$5,$5+1)`,
      [
        randomUUID(),
        job.id,
        input.serviceId,
        input.reason.trim(),
        job.generation,
      ],
    );
    await tx.client.query(
      `UPDATE treido.outbox_jobs SET state='pending',generation=generation+1,attempts=0,
      available_at=clock_timestamp(),progress_at=clock_timestamp(),dispatch_token=NULL,dispatch_until=NULL,
      executor_event_id=NULL,accepted_at=NULL,last_error=NULL WHERE id=$1`,
      [job.id],
    );
    await tx.client.query(
      `UPDATE treido.job_effects SET state='pending',execution_token=NULL,execution_until=NULL WHERE job_id=$1`,
      [job.id],
    );
    return { jobId: job.id, generation: job.generation + 1 };
  });
}
