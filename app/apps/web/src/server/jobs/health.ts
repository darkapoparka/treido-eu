import { JOB_OBSERVATION_LIMITS } from "./observations";

export const JOB_HEALTH_LIMITS = {
  count: 1000000,
  ageMs: 7 * 24 * 60 * 60 * 1000,
} as const;
const counts = [
  "pending",
  "accepted",
  "due",
  "leased",
  "retrying",
  "dead",
  "running",
] as const;
const zero = BigInt(0);
const maxInteger = BigInt("9223372036854775807");
type Count = (typeof counts)[number];
type Timing = { durationMs?: number; durationCapped?: true };
export type JobHealth = Readonly<
  { event: "treido.job.health"; version: 1 } & Timing &
    (
      | { status: "unavailable" }
      | ({
          status: "available";
          active: number;
          oldestActiveMs: number | null;
          oldestDueMs: number | null;
          countsCapped?: true;
          agesCapped?: true;
        } & Record<Count, number>)
    )
>;
function own(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
function integer(value: unknown): bigint | null {
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  return typeof value === "string" &&
    /^(?:0|[1-9][0-9]{0,18})$/.test(value) &&
    BigInt(value) <= maxInteger
    ? BigInt(value)
    : null;
}
function timing(duration: unknown): Timing {
  if (
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration < 0
  )
    return {};
  return {
    durationMs: Math.min(
      Math.floor(duration),
      JOB_OBSERVATION_LIMITS.durationMs,
    ),
    ...(duration > JOB_OBSERVATION_LIMITS.durationMs
      ? { durationCapped: true as const }
      : {}),
  };
}
function unavailable(duration: unknown): JobHealth {
  return Object.freeze({
    event: "treido.job.health",
    version: 1,
    status: "unavailable",
    ...timing(duration),
  });
}
/** Fixed aggregate projection only. A failed/malformed read is never an empty queue. */
export function jobHealth(input: unknown, duration?: unknown): JobHealth {
  try {
    const raw = {} as Record<Count, bigint>;
    for (const key of counts) {
      const value = integer(own(input, key));
      if (value === null) return unavailable(duration);
      raw[key] = value;
    }
    const active = raw.pending + raw.accepted;
    if (
      [raw.due, raw.leased, raw.retrying, raw.running].some(
        (value) => value > active,
      )
    )
      return unavailable(duration);
    const ages = {
      oldestActiveMs: own(input, "oldestActiveMs"),
      oldestDueMs: own(input, "oldestDueMs"),
    };
    const parsedAges = {
      oldestActiveMs:
        ages.oldestActiveMs === null ? null : integer(ages.oldestActiveMs),
      oldestDueMs: ages.oldestDueMs === null ? null : integer(ages.oldestDueMs),
    };
    if (
      (active === zero
        ? ages.oldestActiveMs !== null
        : parsedAges.oldestActiveMs === null) ||
      (raw.due === zero
        ? ages.oldestDueMs !== null
        : parsedAges.oldestDueMs === null)
    )
      return unavailable(duration);
    const cappedCount = (value: bigint) =>
      Number(
        value > BigInt(JOB_HEALTH_LIMITS.count)
          ? BigInt(JOB_HEALTH_LIMITS.count)
          : value,
      );
    const cappedAge = (value: bigint | null) =>
      value === null
        ? null
        : Number(
            value > BigInt(JOB_HEALTH_LIMITS.ageMs)
              ? BigInt(JOB_HEALTH_LIMITS.ageMs)
              : value,
          );
    const output = Object.assign(Object.create(null), {
      event: "treido.job.health",
      version: 1,
      status: "available",
      active: cappedCount(active),
      ...Object.fromEntries(counts.map((key) => [key, cappedCount(raw[key])])),
      oldestActiveMs: cappedAge(parsedAges.oldestActiveMs),
      oldestDueMs: cappedAge(parsedAges.oldestDueMs),
      ...(Object.values(raw).some(
        (value) => value > BigInt(JOB_HEALTH_LIMITS.count),
      ) || active > BigInt(JOB_HEALTH_LIMITS.count)
        ? { countsCapped: true }
        : {}),
      ...(Object.values(parsedAges).some(
        (value) => value !== null && value > BigInt(JOB_HEALTH_LIMITS.ageMs),
      )
        ? { agesCapped: true }
        : {}),
      ...timing(duration),
    }) as JobHealth;
    return JSON.stringify(output).length <= JOB_OBSERVATION_LIMITS.bytes
      ? Object.freeze(output)
      : unavailable(duration);
  } catch {
    return unavailable(duration);
  }
}
/** Same bounded stdout observation policy: contain sync/async sinks, with no raw fallback. */
export function emitJobHealth(
  input: () => unknown,
  sink: (event: JobHealth) => unknown,
  duration?: unknown,
): void {
  try {
    let value: unknown;
    try {
      value = input();
    } catch {
      /* A failed observation has only the fixed unavailable projection. */
    }
    void Promise.resolve(sink(jobHealth(value, duration))).catch(() => {});
  } catch {
    /* Never log the source or sink exception. */
  }
}
