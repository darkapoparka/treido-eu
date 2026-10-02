import { validId } from "../../features/selling/draft-model";

export const JOB_EVENT = "treido/job.requested";
export const JOB_VERSION = 1;
export const JOB_LIMITS = {
  batch: 20,
  leaseSeconds: 60,
  executionSeconds: 120,
  stalledSeconds: 600,
  attempts: 8,
} as const;
export type JobKind = "media.process" | "system.probe";
export type JobAuthority = "member" | "service";
export type JobState =
  "pending" | "accepted" | "completed" | "cancelled" | "dead";
export type JobIntent = {
  kind: JobKind;
  sellerId: string;
  resourceId: string;
  operationKey: string;
  actorId: string | null;
  authority: JobAuthority;
};
export type JobEvent = {
  jobId: string;
  sellerId: string;
  generation: number;
  schemaVersion: 1;
  environment: string;
  applicationId: string;
};
export class JobError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "CONFLICT"
      | "STALE_LEASE"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "NOT_AVAILABLE"
      | "BUSY",
  ) {
    super(`Job operation failed: ${code}.`);
    this.name = "JobError";
  }
}
export function validateJobIntent(input: JobIntent) {
  if (
    !input ||
    !["media.process", "system.probe"].includes(input.kind) ||
    !validId(input.sellerId) ||
    !validId(input.resourceId) ||
    !validId(input.operationKey) ||
    !["member", "service"].includes(input.authority) ||
    (input.authority === "member" && !validId(input.actorId)) ||
    (input.authority === "service" && input.actorId !== null) ||
    (input.kind === "media.process" && input.authority !== "member")
  )
    throw new JobError("INVALID_INPUT");
}
/** Reject additional event fields rather than retaining provider/private payloads. */
export function parseJobEvent(value: unknown): JobEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (
    Object.keys(event).some(
      (key) =>
        ![
          "jobId",
          "sellerId",
          "generation",
          "schemaVersion",
          "environment",
          "applicationId",
        ].includes(key),
    ) ||
    !validId(event.jobId) ||
    !validId(event.sellerId) ||
    !Number.isSafeInteger(event.generation) ||
    (event.generation as number) < 1 ||
    event.schemaVersion !== JOB_VERSION ||
    typeof event.environment !== "string" ||
    !/^[a-z][a-z0-9-]{1,63}$/.test(event.environment) ||
    typeof event.applicationId !== "string" ||
    !/^[a-z][a-z0-9-]{1,79}$/.test(event.applicationId)
  )
    return null;
  return event as JobEvent;
}
