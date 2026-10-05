import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { object, type ReviewSource } from "../purchase-reviews/model";

export type Language = "bg" | "en";
export type Localized = { bg: string; en: string };
export const RECIPIENT_FIELDS = [
  "name",
  "phone",
  "address",
  "city",
  "postalCode",
  "officeCode",
] as const;
export type RecipientField = (typeof RECIPIENT_FIELDS)[number];
export type Recipient = Partial<Record<RecipientField, string>>;
export type TaxBasis =
  "inclusive_known" | "inclusive_unspecified" | "exclusive_known";
export type ShippingCosts = {
  merchandiseMinor: number;
  shippingMinor: number;
  buyerFeeMinor: number;
  taxMinor: number | null;
  taxBasis: TaxBasis;
  totalMinor: number;
  applicationFeeMinor: number;
};
export type ShippingChoice = {
  id: string;
  revision: number;
  snapshotHash: string;
  acknowledged: true;
};
export type ShippingSourceInput = { source: ReviewSource; language: Language };
type Request = { actorKey: string; requestId: string };
export type PrepareShipping = Request &
  ShippingSourceInput & {
    action: "prepare";
    sourceHash: string;
    policyId: string;
    rateId: string;
    optionHash: string;
    country: string;
    recipient: Recipient;
    acknowledgedPurpose: true;
  };
export type AcceptShipping = Request & {
  action: "accept";
  choice: ShippingChoice;
};
export type ShippingCommand = PrepareShipping | AcceptShipping;

export function exact(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new SellerError("INVALID_INPUT");
}
export function integer(
  value: unknown,
  maximum = 99999999,
  minimum = 0,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    throw new SellerError("INVALID_INPUT");
  return value;
}
export function text(value: unknown, maximum: number): string {
  if (
    typeof value !== "string" ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.length > maximum ||
    !value.trim()
  )
    throw new SellerError("INVALID_INPUT");
  return value.trim();
}
export function hash(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new SellerError("INVALID_INPUT");
  return value;
}
export function parseSource(
  input: unknown,
  language: unknown,
): ShippingSourceInput {
  if (!object(input) || (language !== "bg" && language !== "en"))
    throw new SellerError("INVALID_INPUT");
  if (input.kind === "cart") {
    exact(input, ["kind", "sellerId", "cartRevision"]);
    if (!validId(input.sellerId)) throw new SellerError("INVALID_INPUT");
    return {
      language,
      source: {
        kind: "cart",
        sellerId: input.sellerId,
        cartRevision: integer(input.cartRevision, 2147483646, 1),
      },
    };
  }
  exact(input, ["kind", "threadId", "offerId"]);
  if (
    input.kind !== "offer" ||
    !validId(input.threadId) ||
    !validId(input.offerId)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    language,
    source: { kind: "offer", threadId: input.threadId, offerId: input.offerId },
  };
}
export function parseChoice(raw: unknown): ShippingChoice {
  if (!object(raw) || !validId(raw.id) || raw.acknowledged !== true)
    throw new SellerError("INVALID_INPUT");
  exact(raw, ["id", "revision", "snapshotHash", "acknowledged"]);
  return {
    id: raw.id,
    revision: integer(raw.revision, 2147483646),
    snapshotHash: hash(raw.snapshotHash),
    acknowledged: true,
  };
}
export function parseRecipient(
  raw: unknown,
  allowed: readonly RecipientField[],
  required: readonly RecipientField[],
): Recipient {
  if (!object(raw)) throw new SellerError("INVALID_INPUT");
  exact(raw, allowed);
  const recipient: Recipient = {};
  for (const field of allowed) {
    const value = raw[field];
    if (value === undefined || value === "") {
      if (required.includes(field)) throw new SellerError("INVALID_INPUT");
      continue;
    }
    recipient[field] = text(
      value,
      field === "address" ? 300 : field === "phone" ? 40 : 100,
    );
  }
  if (!Object.keys(recipient).length) throw new SellerError("INVALID_INPUT");
  return recipient;
}
export function parseCommand(raw: unknown): ShippingCommand {
  if (!object(raw) || !validId(raw.requestId))
    throw new SellerError("INVALID_INPUT");
  const base = { actorKey: hash(raw.actorKey), requestId: raw.requestId };
  if (raw.action === "accept") {
    exact(raw, ["action", "actorKey", "requestId", "choice"]);
    return { ...base, action: "accept", choice: parseChoice(raw.choice) };
  }
  if (
    raw.action !== "prepare" ||
    !validId(raw.policyId) ||
    !validId(raw.rateId) ||
    raw.acknowledgedPurpose !== true ||
    !object(raw.recipient)
  )
    throw new SellerError("INVALID_INPUT");
  exact(raw, [
    "action",
    "actorKey",
    "requestId",
    "source",
    "language",
    "sourceHash",
    "policyId",
    "rateId",
    "optionHash",
    "country",
    "recipient",
    "acknowledgedPurpose",
  ]);
  const country = text(raw.country, 2);
  if (!/^[A-Z]{2}$/.test(country)) throw new SellerError("INVALID_INPUT");
  return {
    ...base,
    ...parseSource(raw.source, raw.language),
    action: "prepare",
    sourceHash: hash(raw.sourceHash),
    policyId: raw.policyId,
    rateId: raw.rateId,
    optionHash: hash(raw.optionHash),
    country,
    recipient: parseRecipient(raw.recipient, RECIPIENT_FIELDS, []),
    acknowledgedPurpose: true,
  };
}
export function parseRecovery(raw: unknown): Request {
  if (!object(raw) || !validId(raw.requestId))
    throw new SellerError("INVALID_INPUT");
  exact(raw, ["actorKey", "requestId"]);
  return { actorKey: hash(raw.actorKey), requestId: raw.requestId };
}
export function shippingCosts(
  input: Omit<ShippingCosts, "totalMinor">,
): ShippingCosts {
  integer(input.merchandiseMinor, 99999999, 1);
  integer(input.shippingMinor);
  integer(input.buyerFeeMinor);
  integer(input.applicationFeeMinor);
  if (input.taxBasis === "inclusive_unspecified") {
    if (input.taxMinor !== null) throw new SellerError("NOT_AVAILABLE");
  } else if (
    input.taxBasis === "inclusive_known" ||
    input.taxBasis === "exclusive_known"
  )
    integer(input.taxMinor);
  else throw new SellerError("NOT_AVAILABLE");
  const beforeTax =
    input.merchandiseMinor + input.shippingMinor + input.buyerFeeMinor;
  const totalMinor = integer(
    beforeTax + (input.taxBasis === "exclusive_known" ? input.taxMinor! : 0),
    99999999,
    50,
  );
  if (
    input.applicationFeeMinor > totalMinor ||
    (input.taxBasis === "inclusive_known" && input.taxMinor! > beforeTax)
  )
    throw new SellerError("NOT_AVAILABLE");
  return { ...input, totalMinor };
}
