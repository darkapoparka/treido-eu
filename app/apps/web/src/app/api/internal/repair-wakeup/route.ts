import { requireJobBindings } from "../../../../server/jobs/config.server";
import { getDatabase } from "../../../../server/db/database";
import {
  authorizedService,
  jobResponse,
} from "../../../../server/jobs/http.server";
import {
  validRepairWakeupRequest,
  wakeRepair,
} from "../../../../server/jobs/repair-wakeup.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!authorizedService(request, process.env.CRON_SECRET))
    return jobResponse({ code: "FORBIDDEN" }, 403);
  try {
    const bindings = requireJobBindings();
    if (!validRepairWakeupRequest(request, bindings))
      return jobResponse({ code: "FORBIDDEN" }, 403);
    const { createJobExecutor } =
      await import("../../../../server/jobs/inngest.server");
    // Client creation performs no IO. Database and sender are reached only after
    // authentication, configuration, deployment purpose and origin validation.
    const executor = createJobExecutor(bindings, {});
    return jobResponse(
      await wakeRepair(getDatabase(), bindings, executor.sendRepairWakeup),
    );
  } catch {
    return jobResponse({ code: "NOT_AVAILABLE" }, 503);
  }
}
