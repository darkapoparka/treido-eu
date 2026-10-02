import "server-only";
import { Inngest, NonRetriableError } from "inngest";
import { serve } from "inngest/next";
import { getDatabase, type SellerDatabase } from "../db/database";
import type { JobBindings } from "./bindings";
import {
  executeJob,
  markExecutorFailure,
  type JobHandlers,
} from "./execution.server";
import { dispatchOutbox } from "./dispatch.server";
import { JOB_EVENT, JobError } from "./model";
import { SellerError } from "../../features/sellers/errors";

const quietLogger = { info() {}, warn() {}, error() {}, debug() {} };
export function createJobExecutor(
  bindings: JobBindings,
  handlers: JobHandlers,
  database: () => SellerDatabase = getDatabase,
) {
  const client = new Inngest({
    id: bindings.applicationId,
    env: bindings.environment,
    isDev: false,
    eventKey: process.env.INNGEST_EVENT_KEY,
    signingKey: process.env.INNGEST_SIGNING_KEY,
    logger: quietLogger,
    internalLogger: quietLogger,
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      }),
  });
  const execute = client.createFunction(
    {
      id: "durable-job-v1",
      triggers: { event: JOB_EVENT },
      retries: 4,
      concurrency: [
        { limit: 4, scope: "env", key: '"treido-durable-jobs"' },
        { limit: 1, key: "event.data.sellerId" },
      ],
      onFailure: async ({ event }) => {
        await markExecutorFailure(database(), event.data.event.data, bindings);
        console.error("Treido durable job exhausted its executor retries.");
      },
    },
    async ({ event, step, runId }) => {
      try {
        // Only IDs and status are retained in executor step history.
        return await step.run("execute-owned-effect-v1", () =>
          executeJob(database(), event.data, bindings, runId, handlers),
        );
      } catch (error) {
        if (
          (error instanceof JobError || error instanceof SellerError) &&
          ["INVALID_INPUT", "NOT_FOUND", "FORBIDDEN"].includes(error.code)
        )
          throw new NonRetriableError(
            "Treido job input or authority was rejected.",
          );
        throw new Error(
          "Treido durable effect is unavailable; retry with the same identity.",
        );
      }
    },
  );
  const repair = client.createFunction(
    {
      id: "outbox-repair-v1",
      triggers: { cron: "* * * * *" },
      retries: 2,
      concurrency: { limit: 1 },
    },
    ({ step }) =>
      step.run("lease-and-handoff-v1", () =>
        dispatchOutbox(database(), bindings, (event) => client.send(event)),
      ),
  );
  const http = serve({
    client,
    functions: [execute, repair],
    serveOrigin: bindings.origin,
    servePath: "/api/inngest",
  });
  return {
    http,
    dispatch: () =>
      dispatchOutbox(database(), bindings, (event) => client.send(event)),
  };
}
