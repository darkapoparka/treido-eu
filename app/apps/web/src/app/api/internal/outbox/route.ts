import { requireJobBindings } from "../../../../server/jobs/config.server";
import { getDatabase } from "../../../../server/db/database";
import {
  authorizedService,
  boundedJson,
  jobResponse,
} from "../../../../server/jobs/http.server";
import { redriveJob } from "../../../../server/jobs/outbox.server";
import { JobError } from "../../../../server/jobs/model";

export const runtime = "nodejs";
export async function POST(request: Request) {
  // Service credentials are checked before configuration or database access.
  const repair = authorizedService(request, process.env.CRON_SECRET);
  const redrive = authorizedService(
    request,
    process.env.TREIDO_OUTBOX_REDRIVE_SECRET,
  );
  if (!repair && !redrive) return jobResponse({ code: "FORBIDDEN" }, 403);
  try {
    const bindings = requireJobBindings();
    const input = (await boundedJson(request)) as Record<string, unknown>;
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new JobError("INVALID_INPUT");
    if (
      input.action === "repair" &&
      repair &&
      Object.keys(input).length === 1
    ) {
      const { createJobExecutor } =
        await import("../../../../server/jobs/inngest.server");
      return jobResponse(await createJobExecutor(bindings, {}).dispatch());
    }
    if (
      input.action === "redrive" &&
      redrive &&
      Object.keys(input).length === 4
    ) {
      return jobResponse(
        await redriveJob(getDatabase(), {
          jobId: input.jobId as string,
          expectedGeneration: input.expectedGeneration as number,
          reason: input.reason as string,
          serviceId: bindings.repairServiceId,
        }),
      );
    }
    throw new JobError("INVALID_INPUT");
  } catch (error) {
    const code = error instanceof JobError ? error.code : "NOT_AVAILABLE";
    return jobResponse(
      { code },
      code === "CONFLICT" ? 409 : code === "INVALID_INPUT" ? 400 : 503,
    );
  }
}
