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
export type SellerJobKind =
  | "media.process"
  | "system.probe"
  | "catalogue.import"
  | "team.invitation"
  | "payment.reconcile"
  | "payment.refund"
  | "payment.aftercare"
  | "billing.reconcile"
  | "promotion.reconcile";
export type AssistantJobKind =
  "assistant.media-expiry" | "assistant.run-expiry" | "assistant.usage";
export function isAssistantJobKind(kind: unknown): kind is AssistantJobKind {
  return (
    kind === "assistant.media-expiry" ||
    kind === "assistant.run-expiry" ||
    kind === "assistant.usage"
  );
}
export type ShippingJobKind =
  "shipping.input-expiry" | "shipping.recipient-expiry";
export function isShippingJobKind(kind: unknown): kind is ShippingJobKind {
  return (
    kind === "shipping.input-expiry" || kind === "shipping.recipient-expiry"
  );
}
export type JobKind =
  | SellerJobKind
  | "buyer.saved-search"
  | AssistantJobKind
  | "account.closure"
  | ShippingJobKind;
export type JobAuthority =
  "member" | "service" | "buyer" | "assistant" | "closure" | "shipping";
export type JobState =
  "pending" | "accepted" | "completed" | "cancelled" | "dead";
export type SellerJobIntent = {
  kind: SellerJobKind;
  sellerId: string;
  buyerId?: null;
  resourceId: string;
  operationKey: string;
  actorId: string | null;
  authority: "member" | "service";
};
export type BuyerJobIntent = {
  kind: "buyer.saved-search";
  sellerId: null;
  buyerId: string;
  resourceId: string;
  operationKey: string;
  actorId: string;
  authority: "buyer";
};
export type AssistantJobIntent = {
  kind: AssistantJobKind;
  sellerId: null;
  buyerId: string;
  resourceId: string;
  operationKey: string;
  actorId: null;
  authority: "assistant";
};
export type ClosureJobIntent = Omit<
  AssistantJobIntent,
  "kind" | "authority"
> & {
  kind: "account.closure";
  authority: "closure";
};
export type ShippingJobIntent = Omit<
  AssistantJobIntent,
  "kind" | "authority"
> & { kind: ShippingJobKind; authority: "shipping" };
export type JobIntent =
  | SellerJobIntent
  | BuyerJobIntent
  | AssistantJobIntent
  | ClosureJobIntent
  | ShippingJobIntent;
export type JobEvent = {
  jobId: string;
  sellerId: string | null;
  buyerId?: string;
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
  if (isShippingJobKind(input?.kind)) {
    if (
      input.sellerId !== null ||
      !validId(input.buyerId) ||
      input.actorId !== null ||
      input.authority !== "shipping" ||
      !validId(input.resourceId) ||
      input.operationKey !== input.resourceId
    )
      throw new JobError("INVALID_INPUT");
    return;
  }
  if (isAssistantJobKind(input?.kind) || input?.kind === "account.closure") {
    if (
      input.sellerId !== null ||
      !validId(input.buyerId) ||
      input.actorId !== null ||
      !validId(input.resourceId) ||
      !validId(input.operationKey) ||
      (input.kind === "account.closure"
        ? input.authority !== "closure"
        : input.authority !== "assistant" ||
          input.operationKey !== input.resourceId)
    )
      throw new JobError("INVALID_INPUT");
    return;
  }
  if (input?.kind === "buyer.saved-search") {
    if (
      input.sellerId !== null ||
      !validId(input.buyerId) ||
      input.actorId !== input.buyerId ||
      input.authority !== "buyer" ||
      !validId(input.resourceId) ||
      !validId(input.operationKey)
    )
      throw new JobError("INVALID_INPUT");
    return;
  }
  if (
    !input ||
    ![
      "media.process",
      "system.probe",
      "catalogue.import",
      "team.invitation",
      "payment.reconcile",
      "payment.refund",
      "payment.aftercare",
      "billing.reconcile",
      "promotion.reconcile",
    ].includes(input.kind) ||
    !validId(input.sellerId) ||
    input.buyerId != null ||
    !validId(input.resourceId) ||
    !validId(input.operationKey) ||
    !["member", "service"].includes(input.authority) ||
    (input.authority === "member" && !validId(input.actorId)) ||
    (input.authority === "service" && input.actorId !== null) ||
    ([
      "payment.reconcile",
      "payment.refund",
      "payment.aftercare",
      "billing.reconcile",
      "promotion.reconcile",
    ].includes(input.kind) &&
      input.authority !== "service") ||
    (["media.process", "catalogue.import", "team.invitation"].includes(
      input.kind,
    ) &&
      input.authority !== "member")
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
          "buyerId",
          "generation",
          "schemaVersion",
          "environment",
          "applicationId",
        ].includes(key),
    ) ||
    !validId(event.jobId) ||
    (event.sellerId === null
      ? !validId(event.buyerId)
      : !validId(event.sellerId) || event.buyerId !== undefined) ||
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
