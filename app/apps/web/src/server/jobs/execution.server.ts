import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../db/database";
import { authorizeSeller } from "../../features/sellers/persistence.server";
import { SellerError } from "../../features/sellers/errors";
import { validId } from "../../features/selling/draft-model";
import { jobColumns, type JobRow } from "./outbox.server";
import {
  JOB_LIMITS,
  JobError,
  parseJobEvent,
  type JobEvent,
  type JobKind,
} from "./model";

export type EffectContext = JobRow & { executionToken: string };
export type EffectResult = {
  resultId: string;
  providerObjectId?: string;
  lock?: (tx: SellerTransaction) => Promise<void>;
  apply?: (tx: SellerTransaction) => Promise<void>;
};
export type JobHandlers = Partial<
  Record<JobKind, (context: EffectContext) => Promise<EffectResult>>
>;
export type JobOutcome = {
  jobId: string;
  status: "completed" | "cancelled" | "stale";
};

async function currentAuthority(tx: SellerTransaction, job: JobRow) {
  if (job.authority === "service") return;
  const human = (
    await tx.client.query<{ subject: string }>(
      `SELECT clerk_subject AS subject FROM treido.users WHERE id=$1`,
      [job.actorId],
    )
  ).rows[0];
  if (!human) throw new SellerError("FORBIDDEN");
  await authorizeSeller(
    tx,
    { subject: human.subject },
    job.sellerId,
    "listing.write",
  );
}

async function cancelForAuthority(tx: SellerTransaction, job: JobRow) {
  await tx.client.query(
    `UPDATE treido.job_effects SET state='cancelled',execution_token=NULL,execution_until=NULL
    WHERE job_id=$1 AND state <> 'completed'`,
    [job.id],
  );
  await tx.client.query(
    `UPDATE treido.outbox_jobs SET state='cancelled',last_error='authority_removed',
    dispatch_token=NULL,dispatch_until=NULL WHERE id=$1 AND state IN ('pending','accepted')`,
    [job.id],
  );
}

async function claimExecution(
  database: SellerDatabase,
  event: JobEvent,
  runId: string,
) {
  return inTransaction(database, async (tx) => {
    const initial = (
      await tx.client.query<JobRow>(
        `SELECT ${jobColumns} FROM treido.outbox_jobs WHERE id=$1 AND seller_id=$2`,
        [event.jobId, event.sellerId],
      )
    ).rows[0];
    if (!initial) throw new JobError("NOT_FOUND");
    let permitted = true;
    try {
      await currentAuthority(tx, initial);
    } catch (error) {
      if (!(error instanceof SellerError)) throw error;
      permitted = false;
    }
    const job = (
      await tx.client.query<JobRow>(
        `SELECT ${jobColumns} FROM treido.outbox_jobs WHERE id=$1 FOR UPDATE`,
        [initial.id],
      )
    ).rows[0];
    if (job.generation !== event.generation || job.state === "dead")
      return { status: "stale" as const };
    // Private/discretionary jobs recheck current authority even for replayed receipts.
    if (!permitted) {
      if (job.state !== "completed") await cancelForAuthority(tx, job);
      return { status: "cancelled" as const };
    }
    if (job.state === "completed") return { status: "completed" as const };
    if (job.state === "cancelled") return { status: "cancelled" as const };
    const token = randomUUID();
    const effect = await tx.client.query(
      `UPDATE treido.job_effects SET state='running',execution_token=$2,
       execution_until=clock_timestamp()+make_interval(secs=>$3),executor_run_id=$4
       WHERE job_id=$1 AND state IN ('pending','running')
       AND (execution_until IS NULL OR execution_until < clock_timestamp()) RETURNING job_id`,
      [job.id, token, JOB_LIMITS.executionSeconds, runId],
    );
    if (effect.rowCount !== 1) throw new JobError("BUSY");
    await tx.client.query(
      `UPDATE treido.outbox_jobs SET progress_at=clock_timestamp(),
      available_at=clock_timestamp()+make_interval(secs=>$2) WHERE id=$1`,
      [job.id, JOB_LIMITS.stalledSeconds],
    );
    return {
      status: "claimed" as const,
      context: { ...job, executionToken: token },
    };
  });
}

export async function executeJob(
  database: SellerDatabase,
  raw: unknown,
  binding: {
    environment: string;
    applicationId: string;
  },
  runId: string,
  handlers: JobHandlers,
): Promise<JobOutcome> {
  const event = parseJobEvent(raw);
  if (
    !event ||
    event.environment !== binding.environment ||
    event.applicationId !== binding.applicationId ||
    !/^[A-Za-z0-9:_-]{1,160}$/.test(runId)
  )
    throw new JobError("INVALID_INPUT");
  const claimed = await claimExecution(database, event, runId);
  if (claimed.status !== "claimed")
    return { jobId: event.jobId, status: claimed.status };
  const context = claimed.context;
  const handler = handlers[context.kind];
  try {
    if (!handler) throw new JobError("NOT_AVAILABLE");
    // No database lock is held across the external effect. Repeated calls use
    // context.operationKey, including after lease expiry or explicit redrive.
    const result = await handler(context);
    if (
      !validId(result.resultId) ||
      (result.providerObjectId !== undefined &&
        !/^[A-Za-z0-9:_./-]{1,160}$/.test(result.providerObjectId))
    )
      throw new JobError("INVALID_INPUT");
    return await inTransaction(database, async (tx) => {
      let permitted = true;
      try {
        await currentAuthority(tx, context);
      } catch (error) {
        if (!(error instanceof SellerError)) throw error;
        permitted = false;
      }
      if (permitted) await result.lock?.(tx);
      const job = (
        await tx.client.query<JobRow>(
          `SELECT ${jobColumns} FROM treido.outbox_jobs WHERE id=$1 FOR UPDATE`,
          [context.id],
        )
      ).rows[0];
      if (
        job.generation !== context.generation ||
        !["pending", "accepted"].includes(job.state)
      )
        throw new JobError("STALE_LEASE");
      // Media completion cannot become ready after its initiating member loses access.
      if (!permitted) {
        await cancelForAuthority(tx, job);
        return { jobId: job.id, status: "cancelled" };
      }
      const written = await tx.client.query(
        `UPDATE treido.job_effects SET state='completed',
        result_id=$3,provider_object_id=$4,completed_at=clock_timestamp(),execution_token=NULL,execution_until=NULL
        WHERE job_id=$1 AND state='running' AND execution_token=$2 AND execution_until > clock_timestamp() RETURNING job_id`,
        [
          job.id,
          context.executionToken,
          result.resultId,
          result.providerObjectId ?? null,
        ],
      );
      if (written.rowCount !== 1) throw new JobError("STALE_LEASE");
      await result.apply?.(tx);
      await tx.client.query(
        `UPDATE treido.outbox_jobs SET state='completed',completed_at=clock_timestamp(),
        progress_at=clock_timestamp(),dispatch_token=NULL,dispatch_until=NULL,last_error=NULL WHERE id=$1`,
        [job.id],
      );
      return { jobId: job.id, status: "completed" };
    });
  } catch (error) {
    await database.pool.query(
      `UPDATE treido.job_effects SET state='pending',execution_token=NULL,execution_until=NULL
      WHERE job_id=$1 AND execution_token=$2 AND state='running'`,
      [context.id, context.executionToken],
    );
    await database.pool.query(
      `UPDATE treido.outbox_jobs SET last_error='effect_unavailable',progress_at=clock_timestamp()
      WHERE id=$1 AND generation=$2 AND state IN ('pending','accepted')`,
      [context.id, context.generation],
    );
    throw error;
  }
}

export async function markExecutorFailure(
  database: SellerDatabase,
  raw: unknown,
  binding: { environment: string; applicationId: string },
) {
  const event = parseJobEvent(raw);
  if (
    !event ||
    event.environment !== binding.environment ||
    event.applicationId !== binding.applicationId
  )
    throw new JobError("INVALID_INPUT");
  await database.pool.query(
    `UPDATE treido.outbox_jobs j SET state='dead',last_error='executor_unavailable',
    dispatch_token=NULL,dispatch_until=NULL WHERE id=$1 AND seller_id=$2 AND generation=$3
    AND state IN ('pending','accepted') AND NOT EXISTS(SELECT 1 FROM treido.job_effects e
      WHERE e.job_id=j.id AND e.state='running' AND e.execution_until > clock_timestamp())`,
    [event.jobId, event.sellerId, event.generation],
  );
}
