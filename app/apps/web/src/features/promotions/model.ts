import { SellerError } from "../sellers/errors";

export const PRODUCTS = {
  bump_once_v1: { proposedMinor: 99, durationSeconds: 0, placement: "bump" },
  category_spotlight_7d_v1: {
    proposedMinor: 399,
    durationSeconds: 604800,
    placement: "category",
  },
  home_spotlight_7d_v1: {
    proposedMinor: 799,
    durationSeconds: 604800,
    placement: "home",
  },
} as const;
export type ProductId = keyof typeof PRODUCTS;
export type Language = "bg" | "en";
export type CampaignState =
  | "draft"
  | "awaiting_payment"
  | "scheduled"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "reconciling";
export type StopReason =
  | "seller_choice"
  | "listing_unavailable"
  | "moderation"
  | "seller_restricted"
  | "platform_failure"
  | "provider_uncertain"
  | "expired"
  | "payment_failed"
  | "operator_safety";
export const UUID = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length === 36 &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export const HEX = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length === 64 &&
  /^[a-f0-9]{64}$/.test(value);
export const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const productId = (value: unknown): value is ProductId =>
  typeof value === "string" && Object.hasOwn(PRODUCTS, value);
export const hasForbiddenControls = (value: string, allowLines = false) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return (
      code === 127 ||
      (code < 32 && (!allowLines || ![9, 10, 13].includes(code)))
    );
  });
export const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) &&
  Number(value) >= 0 &&
  Number(value) <= 2147483646;

export type PromotionCommand = {
  actorKey: string;
  sellerId: string;
  requestId: string;
  campaignId: string;
  expectedRevision: number;
} & (
  | { action: "save"; listingId: string; productId: ProductId }
  | {
      action: "review" | "pause" | "cancel" | "recheck" | "waitlist";
      reason: string;
    }
  | {
      action: "purchase";
      reviewId: string;
      termsHash: string;
      acknowledged: true;
      language: Language;
    }
);
export function parseCommand(raw: unknown): PromotionCommand {
  if (
    !object(raw) ||
    !HEX(raw.actorKey) ||
    !UUID(raw.sellerId) ||
    !UUID(raw.requestId) ||
    !UUID(raw.campaignId) ||
    !revision(raw.expectedRevision)
  )
    throw new SellerError("INVALID_INPUT");
  const common = [
    "actorKey",
    "sellerId",
    "requestId",
    "campaignId",
    "expectedRevision",
    "action",
  ];
  let extra: string[];
  if (raw.action === "save") {
    if (!UUID(raw.listingId) || !productId(raw.productId))
      throw new SellerError("INVALID_INPUT");
    extra = ["listingId", "productId"];
  } else if (
    ["review", "pause", "cancel", "recheck", "waitlist"].includes(
      String(raw.action),
    )
  ) {
    if (
      typeof raw.reason !== "string" ||
      raw.reason.length > 300 ||
      hasForbiddenControls(raw.reason) ||
      ((raw.action === "pause" || raw.action === "cancel") &&
        !raw.reason.trim())
    )
      throw new SellerError("INVALID_INPUT");
    extra = ["reason"];
  } else if (raw.action === "purchase") {
    if (
      !UUID(raw.reviewId) ||
      !HEX(raw.termsHash) ||
      raw.acknowledged !== true ||
      (raw.language !== "bg" && raw.language !== "en")
    )
      throw new SellerError("INVALID_INPUT");
    extra = ["reviewId", "termsHash", "acknowledged", "language"];
  } else throw new SellerError("INVALID_INPUT");
  if (Object.keys(raw).some((key) => ![...common, ...extra].includes(key)))
    throw new SellerError("INVALID_INPUT");
  return {
    ...raw,
    ...(typeof raw.reason === "string" ? { reason: raw.reason.trim() } : {}),
  } as PromotionCommand;
}
export type Terms = {
  productId: ProductId;
  version: number;
  totalMinor: number;
  currency: "EUR";
  durationSeconds: number;
  tax: "inclusive";
  automaticRenewal: false;
  cancellation: "seller_stop_no_automatic_refund";
  neverStartedRemedy: "full_refund_review";
  interruptedRemedy: "prorated_review";
  text: { bg: string; en: string };
  approvalReference: string;
};
export function validTerms(raw: unknown): raw is Terms {
  if (
    !object(raw) ||
    !productId(raw.productId) ||
    !revision(raw.version) ||
    Number(raw.version) < 1 ||
    !Number.isSafeInteger(raw.totalMinor) ||
    Number(raw.totalMinor) < 1 ||
    Number(raw.totalMinor) > 10000000 ||
    raw.currency !== "EUR" ||
    raw.durationSeconds !== PRODUCTS[raw.productId].durationSeconds ||
    raw.tax !== "inclusive" ||
    raw.automaticRenewal !== false ||
    raw.cancellation !== "seller_stop_no_automatic_refund" ||
    raw.neverStartedRemedy !== "full_refund_review" ||
    raw.interruptedRemedy !== "prorated_review" ||
    !object(raw.text) ||
    Object.keys(raw.text).sort().join(",") !== "bg,en" ||
    !boundedText(raw.text.bg, 8000) ||
    !boundedText(raw.text.en, 8000) ||
    !boundedText(raw.approvalReference, 200)
  )
    return false;
  return (
    Object.keys(raw).sort().join(",") ===
    "approvalReference,automaticRenewal,cancellation,currency,durationSeconds,interruptedRemedy,neverStartedRemedy,productId,tax,text,totalMinor,version"
  );
}
function boundedText(raw: unknown, length: number) {
  return (
    typeof raw === "string" &&
    raw.trim().length > 0 &&
    raw.length <= length &&
    !hasForbiddenControls(raw, true)
  );
}
export type ReviewView = {
  id: string;
  campaignRevision: number;
  termsHash: string;
  terms: Terms | null;
  proposedMinor: number;
  expiresAt: string;
  saleAvailable: boolean;
  capacity: "available" | "waitlist" | "full" | "unavailable";
  country: "BG";
  categoryId: string;
  listingRevision: number;
};
export type CampaignView = {
  id: string;
  listingId: string;
  title: string;
  productId: ProductId;
  revision: number;
  state: CampaignState;
  reason: StopReason | null;
  createdAt: string;
  review: ReviewView | null;
  attempt: {
    id: string;
    state: string;
    refundable: boolean;
    checkoutUrl: string | null;
  } | null;
  purchase: {
    terms: Terms;
    acceptedAt: string;
    interval: { startsAt: string; endsAt: string } | null;
  } | null;
  metrics: { impressions: number; clicks: number; inquiries: number };
  remedy: {
    kind: "full_refund_review" | "prorated_review";
    maximumMinor: number;
    createdAt: string;
  } | null;
  waiting: { position: number; expiresAt: string } | null;
  eligible: boolean;
};
export type PromotionView = {
  actorKey: string;
  sellerId: string;
  sellerName: string;
  canBill: boolean;
  paymentAvailable: boolean;
  campaigns: CampaignView[];
  listings: { id: string; title: string; eligible: boolean }[];
  truncated: boolean;
  observedAt: string;
};
export type Acknowledgment = {
  campaignId: string;
  revision: number;
  state: CampaignState;
  reviewId: string | null;
  attemptId: string | null;
};
export type MeasurementChoiceCommand = {
  actorKey: string;
  policyId: string;
  requestId: string;
  expectedRevision: number;
  allowed: boolean;
};
export type MeasurementChoiceView = {
  actorKey: string;
  registered: boolean;
  policy: {
    id: string;
    text: { bg: string; en: string };
    retentionDays: number;
  } | null;
  allowed: boolean;
  revision: number;
};
export function parseMeasurementChoice(raw: unknown): MeasurementChoiceCommand {
  if (
    !object(raw) ||
    Object.keys(raw).sort().join(",") !==
      "actorKey,allowed,expectedRevision,policyId,requestId" ||
    !HEX(raw.actorKey) ||
    !UUID(raw.policyId) ||
    !UUID(raw.requestId) ||
    !revision(raw.expectedRevision) ||
    typeof raw.allowed !== "boolean"
  )
    throw new SellerError("INVALID_INPUT");
  return raw as MeasurementChoiceCommand;
}

export function lifecycle(
  state: CampaignState,
  event: "pause" | "cancel" | "recheck" | "paid" | "tick",
  facts: {
    now: number;
    startsAt: number | null;
    endsAt: number | null;
    eligible: boolean;
    approved: boolean;
    paymentVerified: boolean;
  },
): CampaignState {
  if (state === "cancelled" || state === "completed") return state;
  if (event === "cancel") return "cancelled";
  if (facts.endsAt !== null && facts.now >= facts.endsAt) return "completed";
  if (event === "pause")
    return state === "active" || state === "scheduled" ? "paused" : state;
  if (!facts.approved || !facts.eligible)
    return state === "active" || state === "scheduled" ? "paused" : state;
  if (
    state === "draft" ||
    state === "awaiting_payment" ||
    state === "reconciling"
  )
    return event === "paid" && facts.paymentVerified && facts.startsAt !== null
      ? facts.now < facts.startsAt
        ? "scheduled"
        : "active"
      : state;
  if (state === "paused" && event !== "recheck") return state;
  return facts.paymentVerified && facts.startsAt !== null
    ? facts.now < facts.startsAt
      ? "scheduled"
      : "active"
    : state;
}
export function deliveryRemedy(
  reason: StopReason,
  startsAt: number | null,
  endsAt: number | null,
  now: number,
  totalMinor: number,
) {
  if (
    reason !== "platform_failure" ||
    !Number.isSafeInteger(totalMinor) ||
    totalMinor < 1 ||
    totalMinor > 10000000
  )
    return null;
  if (startsAt === null || now < startsAt)
    return { kind: "full_refund_review" as const, maximumMinor: totalMinor };
  if (endsAt === null || endsAt <= startsAt || now >= endsAt) return null;
  return {
    kind: "prorated_review" as const,
    maximumMinor: Math.floor(
      (totalMinor * (endsAt - now)) / (endsAt - startsAt),
    ),
  };
}

/** Marketing is an explicit current grant; ordinary listing/billing access is independent. */
export function marketingAllowed(facts: {
  kind: "personal" | "business";
  owner: boolean;
  grants: readonly string[];
  active: boolean;
}) {
  return (
    facts.active &&
    (facts.owner ||
      (facts.kind === "business" && facts.grants.includes("marketing.manage")))
  );
}
