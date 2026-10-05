import { validId } from "../selling/draft-model";

export type SellerKind = "personal" | "business";
export type PlanId =
  "personal_free" | "personal_pro" | "business_free" | "business_pro";
export type Limits = {
  active: number;
  drafts: number;
  seats: number;
  historyDays: number;
  commercialExport: boolean;
  importRows: number;
  variants: number;
};
/** Proposed v1 catalogue, never evidence of provider/commercial approval. */
export const PLANS: Record<
  PlanId,
  { kind: SellerKind; amountMinor: number; limits: Limits }
> = {
  personal_free: {
    kind: "personal",
    amountMinor: 0,
    limits: {
      active: 30,
      drafts: 100,
      seats: 1,
      historyDays: 30,
      commercialExport: false,
      importRows: 0,
      variants: 1,
    },
  },
  personal_pro: {
    kind: "personal",
    amountMinor: 799,
    limits: {
      active: 150,
      drafts: 200,
      seats: 1,
      historyDays: 365,
      commercialExport: true,
      importRows: 0,
      variants: 1,
    },
  },
  business_free: {
    kind: "business",
    amountMinor: 0,
    limits: {
      active: 100,
      drafts: 200,
      seats: 3,
      historyDays: 30,
      commercialExport: false,
      importRows: 25,
      variants: 25,
    },
  },
  business_pro: {
    kind: "business",
    amountMinor: 2499,
    limits: {
      active: 500,
      drafts: 1000,
      seats: 10,
      historyDays: 365,
      commercialExport: true,
      importRows: 1000,
      variants: 50,
    },
  },
};
export type BillingOperation =
  "checkout" | "portal" | "cancel" | "preview" | "change";
export type BillingCommand = {
  sellerId: string;
  requestId: string;
  actorKey: string;
  operation: BillingOperation;
  planId: PlanId | null;
  version: number | null;
  previewId: string | null;
  reviewHash?: string | null;
  language: "bg" | "en";
};
export function parseBillingCommand(value: unknown): BillingCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const x = value as Record<string, unknown>;
  if (
    Object.keys(x).some(
      (k) =>
        ![
          "sellerId",
          "requestId",
          "actorKey",
          "operation",
          "planId",
          "version",
          "previewId",
          "reviewHash",
          "language",
        ].includes(k),
    ) ||
    !validId(x.sellerId) ||
    !validId(x.requestId) ||
    typeof x.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(x.actorKey) ||
    !["checkout", "portal", "cancel", "preview", "change"].includes(
      String(x.operation),
    ) ||
    !["bg", "en"].includes(String(x.language))
  )
    return null;
  const priced = ["checkout", "preview", "change"].includes(
    String(x.operation),
  );
  if (
    priced
      ? !["personal_pro", "business_pro"].includes(String(x.planId)) ||
        !Number.isSafeInteger(x.version) ||
        (x.version as number) < 1
      : x.planId != null || x.version != null
  )
    return null;
  if (x.operation === "change" ? !validId(x.previewId) : x.previewId != null)
    return null;
  if (
    x.operation === "change"
      ? typeof x.reviewHash !== "string" || !/^[a-f0-9]{64}$/.test(x.reviewHash)
      : x.reviewHash != null
  )
    return null;
  return {
    sellerId: x.sellerId as string,
    requestId: x.requestId as string,
    actorKey: x.actorKey,
    operation: x.operation as BillingOperation,
    planId: priced ? (x.planId as PlanId) : null,
    version: priced ? (x.version as number) : null,
    previewId: (x.previewId as string) ?? null,
    ...(x.reviewHash != null ? { reviewHash: x.reviewHash as string } : {}),
    language: x.language as "bg" | "en",
  };
}
export function safeBillingUrl(
  value: unknown,
  purpose: "invoice" | "checkout" | "portal",
): string | null {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    /[\u0000-\u0020\u007f\\]/.test(value)
  )
    return null;
  try {
    const u = new URL(value);
    const host =
      purpose === "invoice"
        ? "invoice.stripe.com"
        : purpose === "checkout"
          ? "checkout.stripe.com"
          : "billing.stripe.com";
    return u.protocol === "https:" &&
      u.hostname === host &&
      !u.username &&
      !u.password &&
      !u.port
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function entitlementActive(
  now: number,
  start: number,
  end: number,
  revoked: boolean,
): boolean {
  return (
    !revoked &&
    [now, start, end].every(Number.isSafeInteger) &&
    start <= now &&
    now < end &&
    end > start
  );
}
