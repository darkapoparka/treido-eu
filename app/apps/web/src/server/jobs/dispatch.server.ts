import "server-only";
import type { SellerDatabase } from "../db/database";
import type { JobBindings } from "./bindings";
import { JOB_EVENT, JOB_VERSION, JOB_LIMITS, type JobEvent } from "./model";
import { leaseJobs, recordHandoff, releaseDispatch } from "./outbox.server";
import { observeJob } from "./observations.server";
import { jobObservationTime, jobObservationDuration } from "./observations";

export type EventSender = (event: {
  id: string;
  name: typeof JOB_EVENT;
  v: string;
  data: JobEvent;
}) => Promise<{ ids: string[] }>;
export async function dispatchOutbox(
  database: SellerDatabase,
  bindings: JobBindings,
  send: EventSender,
) {
  const deadline = Date.now() + 30000;
  let leased = 0;
  let accepted = 0;
  let failed = 0;
  const batchStarted = jobObservationTime();
  let batchCompleted = false;
  try {
    // Claim immediately before each send, so slow earlier handoffs cannot consume
    // another job's lease. The SDK bounds each external request to 15 seconds.
    while (leased < JOB_LIMITS.batch && Date.now() < deadline) {
      const [job] = await leaseJobs(database, 1);
      if (!job) break;
      leased++;
      const handoffStarted = jobObservationTime();
      try {
        const result = await send({
          id: `${job.id}:${job.generation}`,
          name: JOB_EVENT,
          v: String(JOB_VERSION),
          data: {
            jobId: job.id,
            sellerId: job.sellerId,
            ...(job.sellerId === null ? { buyerId: job.buyerId } : {}),
            generation: job.generation,
            schemaVersion: JOB_VERSION,
            environment: bindings.environment,
            applicationId: bindings.applicationId,
          },
        });
        if (!result || !Array.isArray(result.ids) || result.ids.length !== 1)
          throw new Error("Missing durable acceptance.");
        if (await recordHandoff(database, job, result.ids[0])) {
          accepted++;
          observeJob(() => ({
            phase: "handoff",
            outcome: "accepted",
            correlation: { jobId: job.id, generation: job.generation },
            eventId: result.ids[0],
            durationMs: jobObservationDuration(handoffStarted),
          }));
        } else {
          observeJob(() => ({
            phase: "handoff",
            outcome: "stale",
            correlation: { jobId: job.id, generation: job.generation },
            eventId: result.ids[0],
            durationMs: jobObservationDuration(handoffStarted),
          }));
        }
      } catch {
        failed++;
        try {
          await releaseDispatch(database, job);
        } finally {
          observeJob(() => ({
            phase: "handoff",
            outcome: "failed",
            correlation: { jobId: job.id, generation: job.generation },
            durationMs: jobObservationDuration(handoffStarted),
          }));
        }
      }
    }
    batchCompleted = true;
    return { leased, accepted, failed };
  } finally {
    observeJob(() => ({
      phase: "batch",
      outcome: batchCompleted ? "completed" : "failed",
      leased,
      accepted,
      failed,
      durationMs: jobObservationDuration(batchStarted),
    }));
  }
}
