import { JOB_LIMITS } from "./model";

const outcomes = {
  handoff: ["accepted", "failed", "stale"],
  batch: ["completed", "failed"],
  executor: ["completed", "cancelled", "stale", "failed"],
  exhaustion: ["exhausted", "failed"],
} as const;
export const JOB_OBSERVATION_LIMITS = {
  durationMs: 3600000,
  bytes: 512,
} as const;
type Phase = keyof typeof outcomes;
export type JobObservation = Readonly<{
  event: "treido.job.observation";
  version: 1;
  phase: Phase;
  outcome: (typeof outcomes)[Phase][number];
  durationMs?: number;
  durationCapped?: true;
  jobId?: string;
  generation?: number;
  runId?: string;
  eventId?: string;
  leased?: number;
  accepted?: number;
  failed?: number;
  errorClass?:
    | "handoff_unavailable"
    | "handoff_stale"
    | "batch_unavailable"
    | "authority_rejected"
    | "effect_unavailable"
    | "executor_exhausted"
    | "exhaustion_unavailable";
}>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ulid = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
function correlationId(value: unknown) {
  return typeof value === "string" && (uuid.test(value) || ulid.test(value))
    ? value
    : undefined;
}
/** Construct a new fixed data projection; never serialize or enumerate input. */
export function jobObservation(input: unknown): JobObservation | null {
  try {
    const phase = own(input, "phase"),
      outcome = own(input, "outcome");
    if (
      typeof phase !== "string" ||
      !Object.hasOwn(outcomes, phase) ||
      typeof outcome !== "string" ||
      !(outcomes[phase as Phase] as readonly string[]).includes(outcome)
    )
      return null;
    const output = Object.assign(Object.create(null), {
      event: "treido.job.observation",
      version: 1,
      phase,
      outcome,
    }) as Record<string, unknown>;
    const duration = own(input, "durationMs");
    if (
      typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration >= 0
    ) {
      output.durationMs = Math.min(
        Math.floor(duration),
        JOB_OBSERVATION_LIMITS.durationMs,
      );
      if (duration > JOB_OBSERVATION_LIMITS.durationMs)
        output.durationCapped = true;
    }
    if (phase === "batch") {
      const leased = own(input, "leased"),
        accepted = own(input, "accepted"),
        failed = own(input, "failed");
      if (
        ![leased, accepted, failed].every(
          (v) =>
            typeof v === "number" &&
            Number.isSafeInteger(v) &&
            v >= 0 &&
            v <= JOB_LIMITS.batch,
        ) ||
        (accepted as number) + (failed as number) > (leased as number)
      )
        return null;
      Object.assign(output, { leased, accepted, failed });
    } else {
      const correlation = own(input, "correlation"),
        jobId = own(correlation, "jobId"),
        generation = own(correlation, "generation");
      if (
        typeof jobId === "string" &&
        uuid.test(jobId) &&
        typeof generation === "number" &&
        Number.isSafeInteger(generation) &&
        generation >= 1 &&
        generation <= 2147483647
      )
        Object.assign(output, { jobId: jobId.toLowerCase(), generation });
      const runId = correlationId(own(input, "runId")),
        eventId = correlationId(own(input, "eventId"));
      if (runId && (phase === "executor" || phase === "exhaustion"))
        output.runId = runId;
      if (eventId) output.eventId = eventId;
    }
    if (phase === "handoff" && outcome !== "accepted")
      output.errorClass =
        outcome === "failed" ? "handoff_unavailable" : "handoff_stale";
    if (phase === "batch" && outcome === "failed")
      output.errorClass = "batch_unavailable";
    if (phase === "executor" && outcome === "failed")
      output.errorClass =
        own(input, "errorClass") === "authority_rejected"
          ? "authority_rejected"
          : "effect_unavailable";
    if (phase === "exhaustion")
      output.errorClass =
        outcome === "exhausted"
          ? "executor_exhausted"
          : "exhaustion_unavailable";
    if (JSON.stringify(output).length > JOB_OBSERVATION_LIMITS.bytes)
      return null;
    return Object.freeze(output) as JobObservation;
  } catch {
    return null;
  }
}
/** Input projection and sink failures are observational, including rejected sinks. */
export function emitJobObservation(
  input: () => unknown,
  sink: (event: JobObservation) => unknown,
): void {
  try {
    const event = jobObservation(input());
    if (event) void Promise.resolve(sink(event)).catch(() => {});
  } catch {
    /* No log fallback: a failure must not leak input or change execution. */
  }
}
export function jobObservationTime(): number | null {
  try {
    const now = performance.now();
    return Number.isFinite(now) ? now : null;
  } catch {
    return null;
  }
}
export function jobObservationDuration(
  start: number | null,
): number | undefined {
  const now = jobObservationTime();
  return start !== null && now !== null && now >= start
    ? now - start
    : undefined;
}
