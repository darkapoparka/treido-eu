import type { NextRequest } from "next/server";
import { requireJobBindings } from "../../../server/jobs/config.server";
import { jobResponse } from "../../../server/jobs/http.server";
import { getDatabase } from "../../../server/db/database";
import { requireMediaStorage } from "../../../server/media/storage.server";
import { processMediaJob } from "../../../features/selling/media.server";

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
    "media.process": (job) =>
      processMediaJob(getDatabase(), job, requireMediaStorage()),
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
