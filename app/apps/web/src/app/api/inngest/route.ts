import { processUnboundShippingInput } from "../../../server/jobs/shipping-authority.server";
import { processAcceptedRecipientRetention } from "../../../features/order-aftercare/shipping-retention.server";
import { processAssistantMaintenanceJob } from "../../../features/assistant-runs/jobs.server";
import { processClosureJob } from "../../../features/account-closure/jobs.server";
import { processOrderRefund } from "../../../features/order-aftercare/jobs.server";
import { processBillingObservation } from "../../../features/seller-billing/jobs.server";
import { processPromotionObservation } from "../../../features/promotions/jobs.server";
import type { NextRequest } from "next/server";
import { requireJobBindings } from "../../../server/jobs/config.server";
import { jobResponse } from "../../../server/jobs/http.server";
import { getDatabase } from "../../../server/db/database";
import { requireMediaStorage } from "../../../server/media/storage.server";
import { processMediaJob } from "../../../features/selling/media.server";
import { processCatalogueImport } from "../../../features/catalogue-import/process.server";
import { processSavedSearchJob } from "../../../features/saved-searches/jobs.server";
import {
  processPaymentObservation,
  processPaymentRefund,
} from "../../../features/payments/jobs.server";

export const runtime = "nodejs";
async function handle(
  request: NextRequest,
  context: unknown,
  method: "GET" | "POST" | "PUT",
) {
  let bindings;
  try {
    bindings = requireJobBindings();
  } catch {
    return jobResponse({ code: "NOT_AVAILABLE" }, 503);
  }
  const { createJobExecutor } =
    await import("../../../server/jobs/inngest.server");
  const executor = createJobExecutor(bindings, {
    "system.probe": async (job) => ({ resultId: job.resourceId }),
    "catalogue.import": (job) => processCatalogueImport(getDatabase(), job),
    "buyer.saved-search": (job) => processSavedSearchJob(getDatabase(), job),
    "media.process": (job) =>
      processMediaJob(getDatabase(), job, requireMediaStorage()),
    "payment.reconcile": (job) => processPaymentObservation(getDatabase(), job),
    "billing.reconcile": (job) => processBillingObservation(getDatabase(), job),
    "promotion.reconcile": (job) =>
      processPromotionObservation(getDatabase(), job),
    "payment.refund": (job) => processPaymentRefund(getDatabase(), job),
    "payment.aftercare": (job) => processOrderRefund(getDatabase(), job),
    "assistant.media-expiry": (job) =>
      processAssistantMaintenanceJob(getDatabase(), job),
    "assistant.run-expiry": (job) =>
      processAssistantMaintenanceJob(getDatabase(), job),
    "assistant.usage": (job) =>
      processAssistantMaintenanceJob(getDatabase(), job),
    "shipping.input-expiry": (job) =>
      processUnboundShippingInput(getDatabase(), job),
    "shipping.recipient-expiry": (job) =>
      processAcceptedRecipientRetention(getDatabase(), job),
    "account.closure": (job) => processClosureJob(getDatabase(), job),
  });
  const response = await executor.http[method](request, context);
  response.headers.set("cache-control", "private, no-store");
  return response;
}
export const GET = (request: NextRequest, context: unknown) =>
  handle(request, context, "GET");
export const POST = (request: NextRequest, context: unknown) =>
  handle(request, context, "POST");
export const PUT = (request: NextRequest, context: unknown) =>
  handle(request, context, "PUT");
