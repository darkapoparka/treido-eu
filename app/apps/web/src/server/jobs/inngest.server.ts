import "server-only";
import { scheduleLifecycleMaintenance } from "./lifecycle-maintenance.server";
import { scheduleOrderRefundRepair } from "../../features/order-aftercare/jobs.server";
import { scheduleBillingRepair } from "../../features/seller-billing/jobs.server";
import { schedulePromotionRepair } from "../../features/promotions/jobs.server";
import { promotionStorageReady } from "../../features/seller-billing/promotion-storage.server";
import { requireMediaStorage } from "../media/storage.server";
import { cleanupMediaObjects } from "../media/retention.server";
import { expireTeamInvitations } from "../../features/team/expiry.server";
import { expireOffers } from "../../features/offers/expiry.server";
import { expireInventoryAllocations } from "../../features/inventory/allocations.server";
import { expireImportUploads } from "../../features/catalogue-import/process.server";
import { Inngest, NonRetriableError } from "inngest";
import { serve } from "inngest/next";
import {
  getDatabase,
  inTransaction,
  type SellerDatabase,
} from "../db/database";
import type { JobBindings } from "./bindings";
import {
  executeJob,
  markExecutorFailure,
  type JobHandlers,
} from "./execution.server";
import { dispatchOutbox } from "./dispatch.server";
import { JOB_EVENT, JobError } from "./model";
import { SellerError } from "../../features/sellers/errors";
import { schedulePaymentRepair } from "../../features/payments/jobs.server";
import { scheduleSavedSearches } from "../../features/saved-searches/jobs.server";
import { observeJob } from "./observations.server";
import { jobObservationTime, jobObservationDuration } from "./observations";

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
        const started = jobObservationTime();
        let recorded = false;
        try {
          await markExecutorFailure(
            database(),
            event.data.event.data,
            bindings,
          );
          recorded = true;
          console.error("Treido durable job exhausted its executor retries.");
        } finally {
          observeJob(() => ({
            phase: "exhaustion",
            outcome: recorded ? "exhausted" : "failed",
            correlation: event.data.event.data,
            eventId: event.data.event.id,
            durationMs: jobObservationDuration(started),
          }));
        }
      },
    },
    async ({ event, step, runId }) => {
      const started = jobObservationTime();
      try {
        // Only IDs and status are retained in executor step history.
        const result = await step.run("execute-owned-effect-v1", () =>
          executeJob(database(), event.data, bindings, runId, handlers),
        );
        observeJob(() => ({
          phase: "executor",
          outcome: result?.status,
          correlation: event.data,
          runId,
          eventId: event.id,
          durationMs: jobObservationDuration(started),
        }));
        return result;
      } catch (error) {
        if (
          (error instanceof JobError || error instanceof SellerError) &&
          ["INVALID_INPUT", "NOT_FOUND", "FORBIDDEN"].includes(error.code)
        ) {
          observeJob(() => ({
            phase: "executor",
            outcome: "failed",
            correlation: event.data,
            runId,
            eventId: event.id,
            durationMs: jobObservationDuration(started),
            errorClass: "authority_rejected",
          }));
          throw new NonRetriableError(
            "Treido job input or authority was rejected.",
          );
        }
        observeJob(() => ({
          phase: "executor",
          outcome: "failed",
          correlation: event.data,
          runId,
          eventId: event.id,
          durationMs: jobObservationDuration(started),
          errorClass: "effect_unavailable",
        }));
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
    async ({ step }) => {
      await step.run("schedule-seller-billing-observation-v1", () =>
        scheduleBillingRepair(database()),
      );
      await step.run("schedule-promotion-observation-v1", async () => {
        const db = database();
        if (!(await inTransaction(db, promotionStorageReady))) return 0;
        return schedulePromotionRepair(db);
      });
      await step.run("schedule-order-refund-observation-v2", () =>
        scheduleOrderRefundRepair(database()),
      );
      await step.run("schedule-payment-observation-v1", () =>
        schedulePaymentRepair(database()),
      );
      await step.run("schedule-buyer-search-matches-v1", () =>
        scheduleSavedSearches(database()),
      );
      await step.run("schedule-owned-assistant-maintenance-v1", () =>
        scheduleLifecycleMaintenance(database(), "assistant"),
      );
      await step.run("schedule-accepted-account-closure-v1", () =>
        scheduleLifecycleMaintenance(database(), "closure"),
      );
      await step.run("schedule-original-shipping-retention-v1", () =>
        scheduleLifecycleMaintenance(database(), "shipping"),
      );
      const dispatched = await step.run("lease-and-handoff-v1", () =>
        dispatchOutbox(database(), bindings, (event) => client.send(event)),
      );
      await step.run("expire-inventory-reservations-v1", () =>
        expireInventoryAllocations(database()),
      );
      await step.run("expire-negotiated-offers-v1", () =>
        expireOffers(database()),
      );
      await step.run("expire-private-csv-uploads-v1", () =>
        expireImportUploads(database()),
      );
      await step.run("expire-business-invitations-v1", () =>
        expireTeamInvitations(database()),
      );
      await step.run("cleanup-registered-photo-objects-v1", async () => {
        let storage;
        try {
          storage = requireMediaStorage();
        } catch (error) {
          if (error instanceof SellerError && error.code === "NOT_AVAILABLE")
            return { status: "unavailable" as const };
          throw error;
        }
        return {
          status: "processed" as const,
          ...(await cleanupMediaObjects(database(), storage)),
        };
      });
      return dispatched;
    },
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
