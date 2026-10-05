import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { SellerError } from "../sellers/errors";
export type Language = "bg" | "en";
export const CASE_REASONS = [
  "handover",
  "item_condition",
  "refund_question",
  "other",
] as const;
export type CaseReason = (typeof CASE_REASONS)[number];
export type CaseState =
  "open" | "awaiting_buyer" | "review_requested" | "reviewed" | "resolved";
export type RefundState =
  | "prepared"
  | "creating"
  | "pending"
  | "reconciling"
  | "succeeded"
  | "remedy_required"
  | "expired";
export type Scope = {
  actorKey: string;
  orderId: string;
  sellerId: string | null;
};
export type OriginalRequest = Scope & { requestId: string };
type Base = OriginalRequest & { expectedRevision: number; language: Language };
export type AftercareCommand =
  | (Base & {
      action: "open";
      servicePolicyId: string;
      servicePolicyVersion: number;
      serviceTermsHash: string;
      acknowledged: true;
      reason: CaseReason;
      body: string;
      evidence: string[];
    })
  | (Base & {
      action:
        "message" | "propose" | "accept" | "reopen" | "escalate" | "appeal";
      caseId: string;
      body: string;
    })
  | (Base & {
      action: "prepare_refund";
      caseId: string | null;
      reason: string;
      selection: "lines" | "remaining";
      lines: RefundSelection[];
      shipping?: boolean;
    })
  | (Base & { action: "execute_refund"; intentId: string })
  | (Base & {
      action: "record_tracking";
      carrier: string;
      trackingReference: string;
      description: string;
    })
  | (Base & { action: "confirm_delivery"; description: string });
export type RefundSelection = { skuId: string; quantity: number };
export type AftercareChoice = {
  policyId: string;
  version: number;
  termsHash: string;
  acknowledged: true;
};
export function exact(
  record: Record<string, unknown>,
  keys: readonly string[],
) {
  if (Object.keys(record).some((key) => !keys.includes(key)))
    throw new SellerError("INVALID_INPUT");
}
export function boundedText(
  value: unknown,
  maximum: number,
  required = true,
): string {
  if (
    typeof value !== "string" ||
    value.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    throw new SellerError("INVALID_INPUT");
  const text = value.trim();
  if (required && !text) throw new SellerError("INVALID_INPUT");
  return text;
}
export function positive(value: unknown, maximum = 2147483646): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  )
    throw new SellerError("INVALID_INPUT");
  return value;
}
export function revision(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= 2147483647
  )
    throw new SellerError("INVALID_INPUT");
  return value;
}
export function parseScope(raw: unknown): Scope {
  if (
    !object(raw) ||
    typeof raw.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey) ||
    !validId(raw.orderId) ||
    (raw.sellerId !== null && !validId(raw.sellerId))
  )
    throw new SellerError("INVALID_INPUT");
  return {
    actorKey: raw.actorKey,
    orderId: raw.orderId,
    sellerId: raw.sellerId,
  };
}
export function parseRecovery(raw: unknown): OriginalRequest {
  if (!object(raw) || !validId(raw.requestId))
    throw new SellerError("INVALID_INPUT");
  exact(raw, ["actorKey", "orderId", "sellerId", "requestId"]);
  return { ...parseScope(raw), requestId: raw.requestId };
}
export function parseAftercareChoice(raw: unknown): AftercareChoice {
  if (
    !object(raw) ||
    !validId(raw.policyId) ||
    typeof raw.version !== "number" ||
    typeof raw.termsHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.termsHash) ||
    raw.acknowledged !== true
  )
    throw new SellerError("INVALID_INPUT");
  exact(raw, ["policyId", "version", "termsHash", "acknowledged"]);
  return {
    policyId: raw.policyId,
    version: positive(raw.version),
    termsHash: raw.termsHash,
    acknowledged: true,
  };
}
export function parseAftercareCommand(raw: unknown): AftercareCommand {
  if (
    !object(raw) ||
    !validId(raw.requestId) ||
    (raw.language !== "bg" && raw.language !== "en")
  )
    throw new SellerError("INVALID_INPUT");
  const base: Base = {
    ...parseScope(raw),
    requestId: raw.requestId,
    expectedRevision: revision(raw.expectedRevision),
    language: raw.language,
  };
  const keys = [
    "actorKey",
    "orderId",
    "sellerId",
    "requestId",
    "expectedRevision",
    "language",
    "action",
  ];
  if (raw.action === "open") {
    exact(raw, [
      ...keys,
      "reason",
      "body",
      "evidence",
      "servicePolicyId",
      "servicePolicyVersion",
      "serviceTermsHash",
      "acknowledged",
    ]);
    if (
      !validId(raw.servicePolicyId) ||
      typeof raw.serviceTermsHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(raw.serviceTermsHash) ||
      raw.acknowledged !== true
    )
      throw new SellerError("INVALID_INPUT");
    if (
      !CASE_REASONS.some((reason) => reason === raw.reason) ||
      !Array.isArray(raw.evidence) ||
      raw.evidence.length > 4
    )
      throw new SellerError("INVALID_INPUT");
    const reason = CASE_REASONS.find((reason) => reason === raw.reason);
    if (!reason) throw new SellerError("INVALID_INPUT");
    return {
      ...base,
      action: "open",
      reason,
      servicePolicyId: raw.servicePolicyId,
      servicePolicyVersion: positive(raw.servicePolicyVersion),
      serviceTermsHash: raw.serviceTermsHash,
      acknowledged: true,
      body: boundedText(raw.body, 2000),
      evidence: raw.evidence.map((e) => boundedText(e, 1200)),
    };
  }
  if (
    raw.action === "message" ||
    raw.action === "propose" ||
    raw.action === "accept" ||
    raw.action === "reopen" ||
    raw.action === "escalate" ||
    raw.action === "appeal"
  ) {
    exact(raw, [...keys, "caseId", "body"]);
    if (!validId(raw.caseId)) throw new SellerError("INVALID_INPUT");
    return {
      ...base,
      action: raw.action,
      caseId: raw.caseId,
      body: boundedText(raw.body, 2000, raw.action !== "accept"),
    };
  }
  if (raw.action === "prepare_refund") {
    exact(raw, [...keys, "caseId", "reason", "selection", "lines", "shipping"]);
    if (
      base.sellerId === null ||
      (raw.caseId !== null && !validId(raw.caseId)) ||
      (raw.selection !== "lines" && raw.selection !== "remaining") ||
      !Array.isArray(raw.lines) ||
      raw.lines.length > 30 ||
      (raw.shipping !== undefined && typeof raw.shipping !== "boolean") ||
      (raw.selection === "remaining" && raw.lines.length !== 0) ||
      (raw.selection === "lines" &&
        raw.lines.length === 0 &&
        raw.shipping !== true)
    )
      throw new SellerError("INVALID_INPUT");
    const seen = new Set<string>();
    const lines: RefundSelection[] = raw.lines.map((line) => {
      if (!object(line) || !validId(line.skuId) || seen.has(line.skuId))
        throw new SellerError("INVALID_INPUT");
      exact(line, ["skuId", "quantity"]);
      seen.add(line.skuId);
      return { skuId: line.skuId, quantity: positive(line.quantity, 100000) };
    });
    return {
      ...base,
      action: "prepare_refund",
      caseId: raw.caseId,
      reason: boundedText(raw.reason, 500),
      selection: raw.selection,
      lines,
      ...(raw.shipping === undefined ? {} : { shipping: raw.shipping }),
    };
  }
  if (raw.action === "execute_refund") {
    exact(raw, [...keys, "intentId"]);
    if (base.sellerId === null || !validId(raw.intentId))
      throw new SellerError("INVALID_INPUT");
    return { ...base, action: "execute_refund", intentId: raw.intentId };
  }
  if (raw.action === "record_tracking") {
    exact(raw, [...keys, "carrier", "trackingReference", "description"]);
    if (base.sellerId === null) throw new SellerError("INVALID_INPUT");
    return {
      ...base,
      action: "record_tracking",
      carrier: boundedText(raw.carrier, 80),
      trackingReference: boundedText(raw.trackingReference, 100),
      description: boundedText(raw.description, 500),
    };
  }
  if (raw.action === "confirm_delivery") {
    exact(raw, [...keys, "description"]);
    if (base.sellerId !== null) throw new SellerError("INVALID_INPUT");
    return {
      ...base,
      action: "confirm_delivery",
      description: boundedText(raw.description, 500, true),
    };
  }
  throw new SellerError("INVALID_INPUT");
}
export type FrozenRefundLine = {
  skuId: string;
  position: number;
  quantity: number;
  unitPriceMinor: number;
  reservedQuantity: number;
  originalPrefixMinor: number;
};
export type RefundPortion = {
  skuId: string;
  fromQuantity: number;
  quantity: number;
  amountMinor: number;
  feeMinor: number;
  taxMinor: null;
  taxBasis: "inclusive_unspecified";
};
function quotient(amount: bigint, fee: number, total: number) {
  return (amount * BigInt(fee) + BigInt(Math.floor(total / 2))) / BigInt(total);
}
export function refundPortions(
  original: FrozenRefundLine[],
  selection: RefundSelection[] | "remaining",
  totalMinor: number,
  feeMinor: number,
): RefundPortion[] {
  positive(totalMinor, 99999999);
  if (
    !Number.isSafeInteger(feeMinor) ||
    feeMinor < 0 ||
    feeMinor > totalMinor ||
    original.length < 1 ||
    original.length > 30
  )
    throw new SellerError("CONFLICT");
  const ordered = [...original].sort((a, b) => a.position - b.position);
  let originalTotal = 0;
  const skuIds = new Set<string>();
  for (const line of ordered) {
    if (
      !validId(line.skuId) ||
      skuIds.has(line.skuId) ||
      line.originalPrefixMinor !== originalTotal ||
      !Number.isSafeInteger(line.position) ||
      line.position < 0 ||
      !Number.isSafeInteger(line.reservedQuantity) ||
      line.reservedQuantity < 0 ||
      line.reservedQuantity > line.quantity
    )
      throw new SellerError("CONFLICT");
    skuIds.add(line.skuId);
    positive(line.quantity, 100000);
    if (
      !Number.isSafeInteger(line.unitPriceMinor) ||
      line.unitPriceMinor < 0 ||
      line.unitPriceMinor > 99999999
    )
      throw new SellerError("CONFLICT");
    originalTotal += line.quantity * line.unitPriceMinor;
    if (!Number.isSafeInteger(originalTotal)) throw new SellerError("CONFLICT");
  }
  if (originalTotal !== totalMinor) throw new SellerError("NOT_AVAILABLE");
  const selected =
    selection === "remaining"
      ? ordered
          .filter(
            (line) =>
              line.reservedQuantity < line.quantity && line.unitPriceMinor > 0,
          )
          .map((line) => ({
            skuId: line.skuId,
            quantity: line.quantity - line.reservedQuantity,
          }))
      : selection;
  if (
    !selected.length ||
    selected.length > 30 ||
    new Set(selected.map((line) => line.skuId)).size !== selected.length
  )
    throw new SellerError("INVALID_INPUT");
  return selected.map((input) => {
    const line = ordered.find((line) => line.skuId === input.skuId);
    if (
      !line ||
      positive(input.quantity, 100000) + line.reservedQuantity > line.quantity
    )
      throw new SellerError("CONFLICT");
    const start =
      BigInt(line.originalPrefixMinor) +
      BigInt(line.reservedQuantity) * BigInt(line.unitPriceMinor);
    const end = start + BigInt(input.quantity) * BigInt(line.unitPriceMinor);
    const fee = Number(
      quotient(end, feeMinor, totalMinor) -
        quotient(start, feeMinor, totalMinor),
    );
    const amount = input.quantity * line.unitPriceMinor;
    if (!Number.isSafeInteger(amount) || amount < 1 || fee < 0 || fee > amount)
      throw new SellerError("CONFLICT");
    return {
      skuId: line.skuId,
      fromQuantity: line.reservedQuantity,
      quantity: input.quantity,
      amountMinor: amount,
      feeMinor: fee,
      taxMinor: null,
      taxBasis: "inclusive_unspecified",
    };
  });
}
export function nextCaseState(
  state: CaseState,
  role: "buyer" | "merchant",
  action: "message" | "propose" | "accept" | "reopen" | "escalate" | "appeal",
): CaseState {
  if (action === "message") return state;
  if (action === "propose" && role === "merchant" && state !== "resolved")
    return "awaiting_buyer";
  if (action === "accept" && role === "buyer" && state === "awaiting_buyer")
    return "resolved";
  if (action === "reopen" && role === "buyer" && state === "resolved")
    return "open";
  if (action === "escalate" && state !== "resolved") return "review_requested";
  if (action === "appeal" && state === "reviewed") return "review_requested";
  throw new SellerError("CONFLICT");
}
