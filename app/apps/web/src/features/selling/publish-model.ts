import {
  parseWithdrawalInput,
  type WithdrawalInput,
} from "./publication-model";
import { validId } from "./draft-model";
export const PUBLICATION_TERMS_VERSION = 1;
export type PublicationTerms = {
  version: 1;
  country: "BG";
  purchaseMode: "contact";
  handover: ("pickup" | "shipping")[];
  deliveryDetails: string;
  defects: string;
  ownsItem: true;
  photoRights: true;
  accurateDetails: true;
  personalSale: boolean;
};
export type MediaRevision = { id: string; revision: number };
export type PublishInput = WithdrawalInput & {
  media: MediaRevision[];
  terms: PublicationTerms;
};
export type PublishAcknowledgement = {
  listingId: string;
  revision: number;
  publishedAt: string;
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) =>
  typeof value === "string" &&
  value.length <= max &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
export function parsePublicationTerms(value: unknown): PublicationTerms | null {
  if (
    !object(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          "version",
          "country",
          "purchaseMode",
          "handover",
          "deliveryDetails",
          "defects",
          "ownsItem",
          "photoRights",
          "accurateDetails",
          "personalSale",
        ].includes(key),
    ) ||
    value.version !== 1 ||
    value.country !== "BG" ||
    value.purchaseMode !== "contact" ||
    value.ownsItem !== true ||
    value.photoRights !== true ||
    value.accurateDetails !== true ||
    typeof value.personalSale !== "boolean" ||
    !Array.isArray(value.handover) ||
    value.handover.length < 1 ||
    value.handover.length > 2 ||
    value.handover.some((mode) => !["pickup", "shipping"].includes(mode)) ||
    new Set(value.handover).size !== value.handover.length ||
    !text(value.deliveryDetails, 1000) ||
    !text(value.defects, 2000) ||
    (value.handover.includes("shipping") &&
      !(value.deliveryDetails as string).trim())
  )
    return null;
  return {
    version: 1,
    country: "BG",
    purchaseMode: "contact",
    handover: [...value.handover].sort(),
    deliveryDetails: (value.deliveryDetails as string).trim(),
    defects: (value.defects as string).trim(),
    ownsItem: true,
    photoRights: true,
    accurateDetails: true,
    personalSale: value.personalSale,
  };
}
export function parsePublishInput(value: unknown): PublishInput | null {
  if (!object(value)) return null;
  const { media, terms, ...command } = value;
  const base = parseWithdrawalInput(command),
    parsed = parsePublicationTerms(terms);
  if (
    !base ||
    !parsed ||
    !Array.isArray(media) ||
    media.length < 1 ||
    media.length > 12 ||
    media.some(
      (item) =>
        !object(item) ||
        Object.keys(item).some((key) => !["id", "revision"].includes(key)) ||
        !validId(item.id) ||
        !Number.isSafeInteger(item.revision) ||
        Number(item.revision) < 1 ||
        Number(item.revision) >= 2147483647,
    ) ||
    new Set(media.map((item) => item.id)).size !== media.length
  )
    return null;
  return {
    ...base,
    terms: parsed,
    media: media.map((item) => ({
      id: item.id.toLowerCase(),
      revision: item.revision,
    })),
  };
}
export function policyAllowsContact(
  rules: Record<string, unknown>,
  sellerKind: "personal" | "business",
  condition: string,
  terms: PublicationTerms,
) {
  const includes = (key: string, value: string) =>
    Array.isArray(rules[key]) && rules[key].includes(value);
  return (
    includes("sellerKinds", sellerKind) &&
    includes("conditions", condition) &&
    includes("countries", terms.country) &&
    includes("purchaseModes", terms.purchaseMode) &&
    terms.handover.every((mode) => includes("handoverModes", mode)) &&
    (sellerKind !== "personal" || terms.personalSale)
  );
}
