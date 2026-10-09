import "server-only";
import { maintainInvitationMail } from "../../features/team/mail-jobs.server";
import { invitationMailConfig } from "../../features/team/mail-model";
import { maintainMessageAttachments } from "../../features/message-attachments/maintenance.server";
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
import { scheduleNotificationEmails } from "../../features/notification-delivery/scheduler.server";
import { maintainNotificationEmails } from "../../features/notification-delivery/jobs.server";
import { observeJob } from "./observations.server";
import { jobObservationTime, jobObservationDuration } from "./observations";
import { withRepairDueCheckpoint } from "./repair-due.server";
import { REPAIR_EVENT, validRepairWakeup } from "./repair-wakeup.server";
import { observeJobHealth } from "./health.server";

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
        } catch {
          throw new Error("Treido executor failure recording is unavailable.");
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
      // Classify and sanitize inside the step: the SDK records step errors
      // before an outer catch runs, and replayed errors lose custom prototypes.
      const result = await step.run("execute-owned-effect-v1", async () => {
        try {
          return await executeJob(
            database(),
            event.data,
            bindings,
            runId,
            handlers,
          );
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
      });
      observeJob(() => ({
        phase: "executor",
        outcome: result?.status,
        correlation: event.data,
        runId,
        eventId: event.id,
        durationMs: jobObservationDuration(started),
      }));
      return result;
    },
  );
  const repair = client.createFunction(
    {
      id: "outbox-repair-v1",
      triggers:
        bindings.repairScheduler === "external-minute"
          ? { event: REPAIR_EVENT }
          : { cron: "* * * * *" },
      retries: 2,
      concurrency: { limit: 1 },
    },
    async ({ event, step }) => {
      if (
        bindings.repairScheduler === "external-minute" &&
        (event.name !== REPAIR_EVENT ||
          !validRepairWakeup(event.data, bindings))
      )
        throw new NonRetriableError(
          "Treido repair wake-up authority was rejected.",
        );
      const repairStep = <T>(id: string, operation: () => Promise<T>) =>
        step.run(id, async () => {
          try {
            return await operation();
          } catch {
            throw new Error(
              "Treido repair effect is unavailable; retry with the same identity.",
            );
          }
        });
      await observeJobHealth(database);
      return withRepairDueCheckpoint(
        (read) => repairStep("repair-due-work-v1", read),
        database,
        async () => {
          await repairStep("schedule-seller-billing-observation-v1", () =>
            scheduleBillingRepair(database()),
          );
          await repairStep("schedule-promotion-observation-v1", async () => {
            const db = database();
            if (!(await inTransaction(db, promotionStorageReady))) return 0;
            return schedulePromotionRepair(db);
          });
          await repairStep("schedule-order-refund-observation-v2", () =>
            scheduleOrderRefundRepair(database()),
          );
          await repairStep("schedule-payment-observation-v1", () =>
            schedulePaymentRepair(database()),
          );
          await repairStep("schedule-buyer-search-matches-v1", () =>
            scheduleSavedSearches(database()),
          );
          await repairStep("schedule-current-notification-mail-v1", () =>
            scheduleNotificationEmails(database()),
          );
          await repairStep("schedule-owned-assistant-maintenance-v1", () =>
            scheduleLifecycleMaintenance(database(), "assistant"),
          );
          await repairStep("schedule-accepted-account-closure-v1", () =>
            scheduleLifecycleMaintenance(database(), "closure"),
          );
          await repairStep("schedule-original-shipping-retention-v1", () =>
            scheduleLifecycleMaintenance(database(), "shipping"),
          );
          const dispatched = await repairStep("lease-and-handoff-v1", () =>
            dispatchOutbox(database(), bindings, (event) => client.send(event)),
          );
          await repairStep("expire-inventory-reservations-v1", () =>
            expireInventoryAllocations(database()),
          );
          await repairStep("expire-negotiated-offers-v1", () =>
            expireOffers(database()),
          );
          await repairStep("expire-private-csv-uploads-v1", () =>
            expireImportUploads(database()),
          );
          await repairStep("reconcile-invitation-mail-v1", async () => {
            const db = database();
            const ready = await db.pool.query(
              "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='treido' AND table_name='invitation_deliveries' AND column_name='mail_binding') AS ready",
            );
            if (!ready.rows[0]?.ready) return { available: false, checked: 0 };
            return maintainInvitationMail(
              db,
              invitationMailConfig(process.env, bindings),
            );
          });
          await repairStep("cleanup-private-message-images-v1", () =>
            maintainMessageAttachments(database()),
          );
          await repairStep("reconcile-known-notification-mail-v1", () =>
            maintainNotificationEmails(database()),
          );
          await repairStep("expire-business-invitations-v1", () =>
            expireTeamInvitations(database()),
          );
          await repairStep("cleanup-registered-photo-objects-v1", async () => {
            let storage;
            try {
              storage = requireMediaStorage();
            } catch (error) {
              if (
                error instanceof SellerError &&
                error.code === "NOT_AVAILABLE"
              )
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
    sendRepairWakeup: (event: Parameters<typeof client.send>[0]) =>
      client.send(event),
    dispatch: () =>
      dispatchOutbox(database(), bindings, (event) => client.send(event)),
  };
}
