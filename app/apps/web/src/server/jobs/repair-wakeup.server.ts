import "server-only";
import { createHash } from "node:crypto";
import type { SellerDatabase } from "../db/database";
import type { JobBindings } from "./bindings";
import { JobError } from "./model";
import { readRepairDue } from "./repair-due.server";

export const REPAIR_EVENT = "treido/repair.requested";
export const REPAIR_WAKEUP_PATH = "/api/internal/repair-wakeup";
// Delayed delivery/retry remains valid for one day. Metadata is only a wake-up:
// every effect still checks current database authority and its original identity.
const MAX_AGE_MINUTES = 24 * 60;
type RepairWakeup = {
  schemaVersion: 1;
  applicationId: string;
  environment: string;
  minute: number;
};
type RepairWakeupEvent = {
  id: string;
  name: typeof REPAIR_EVENT;
  data: RepairWakeup;
};

export function validRepairWakeup(
  input: unknown,
  bindings: JobBindings,
  now = Date.now(),
): input is RepairWakeup {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const minute = Math.floor(now / 60000);
  return (
    Object.keys(value).length === 4 &&
    value.schemaVersion === 1 &&
    value.applicationId === bindings.applicationId &&
    value.environment === bindings.environment &&
    typeof value.minute === "number" &&
    Number.isSafeInteger(value.minute) &&
    value.minute >= 0 &&
    value.minute >= minute - MAX_AGE_MINUTES &&
    value.minute <= minute + 1
  );
}

/** No caller-supplied time, resource IDs, payload, provider hosts or credentials. */
export async function wakeRepair(
  database: SellerDatabase,
  bindings: JobBindings,
  send: (event: RepairWakeupEvent) => Promise<unknown>,
  now = Date.now(),
) {
  if (bindings.repairScheduler !== "external-minute")
    throw new JobError("NOT_AVAILABLE");
  const minute = Math.floor(now / 60000);
  if (!Number.isSafeInteger(minute) || minute < 0)
    throw new JobError("NOT_AVAILABLE");
  if (!(await readRepairDue(database)).due) return { status: "empty" as const };
  const data: RepairWakeup = {
    schemaVersion: 1,
    applicationId: bindings.applicationId,
    environment: bindings.environment,
    minute,
  };
  const id = `repair-${createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")}`;
  // An ambiguous send must propagate: no local success marker can lose recovery.
  // Repeated requests within the same minute reuse Inngest's event dedup key.
  const accepted = await send({ id, name: REPAIR_EVENT, data });
  const ids =
    accepted && typeof accepted === "object"
      ? (accepted as { ids?: unknown }).ids
      : undefined;
  if (
    !Array.isArray(ids) ||
    ids.length !== 1 ||
    typeof ids[0] !== "string" ||
    !ids[0]
  )
    throw new Error("Repair wake-up acceptance is unavailable.");
  return { status: "queued" as const };
}

export function validRepairWakeupRequest(
  request: Request,
  bindings: JobBindings,
) {
  const url = new URL(request.url);
  const schedule = request.headers.get("x-vercel-cron-schedule");
  const platformOrigin = [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].some(
    (hostname) =>
      // Only exact deployment metadata, never client/forwarded headers or a
      // configurable wildcard. Vercel cron may use the production vercel.app URL.
      hostname &&
      hostname.length <= 253 &&
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+vercel\.app$/.test(
        hostname,
      ) &&
      url.origin === `https://${hostname}`,
  );
  return (
    bindings.repairScheduler === "external-minute" &&
    process.env.TREIDO_ENV === "production" &&
    process.env.VERCEL_ENV === "production" &&
    request.method === "GET" &&
    (url.origin === bindings.origin || platformOrigin) &&
    url.pathname === REPAIR_WAKEUP_PATH &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password &&
    request.body === null &&
    (!schedule || schedule === "* * * * *")
  );
}
