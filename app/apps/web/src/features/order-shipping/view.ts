import type { ReviewLine, ReviewSource } from "../purchase-reviews/model";
import type {
  Language,
  Localized,
  Recipient,
  RecipientField,
  ShippingChoice,
  ShippingCosts,
  TaxBasis,
} from "./model";
export type ShippingPolicy = {
  id: string;
  version: number;
  basePolicyId: string;
  financialPolicyId: string;
  environment: string;
  applicationId: string;
  platformAccount: string;
  livemode: boolean;
  countries: string[];
  fields: RecipientField[];
  requiredFields: RecipientField[];
  recipientPurpose: Localized;
  retentionDescription: Localized;
  terms: Localized;
  rights: Localized;
  refundTerms: Localized;
  taxDescription: Localized;
  taxBasis: TaxBasis;
  shippingRefund: {
    beforeDispatch: "refundable" | "not_refundable";
    afterDispatch: "refundable" | "not_refundable";
    return: "refundable" | "not_refundable";
  };
  commissionBasis: "merchandise" | "merchandise_and_shipping";
  quoteValidity: "original_allocation_within_tariff";
  reviewSeconds: number;
  unacceptedRecipientSeconds: number;
  acceptedRecipientSeconds: number;
  retentionVersion: "order-shipping-v1";
  termsHash: string;
};
export type CarrierBinding = {
  id: string;
  policyId: string;
  sellerId: string;
  version: number;
  country: string;
  method: "address" | "collection_office";
  carrierCode: string;
  carrierLabel: Localized;
  officeCodes: string[] | null;
  sourceKind: "approved_seller_tariff";
  bindingHash: string;
};
export type ShippingRate = {
  id: string;
  bindingId: string;
  version: number;
  shippingMinor: number;
  buyerFeeMinor: number;
  taxMinor: number | null;
  taxBasis: TaxBasis;
  maximumUnits: number;
  sourceHash: string | null;
  merchandiseMinor: number | null;
  maximumMerchandiseMinor: number;
  validUntil: string;
  sourceReference: string;
  rateHash: string;
};
export type ShippingOption = {
  policy: ShippingPolicy;
  binding: CarrierBinding;
  rate: ShippingRate;
  financial: {
    id: string;
    version: number;
    termsHash: string;
    terms: Localized;
    retentionDescription: Localized;
  };
  optionHash: string;
  costs: ShippingCosts;
};
export type ShippingContext = {
  actorKey: string;
  actorSubject: string;
  language: Language;
  source: ReviewSource;
  available: boolean;
  sourceHash: string | null;
  sellerId: string | null;
  sellerName: string | null;
  lines: ReviewLine[];
  options: ShippingOption[];
};
export type ShippingSnapshot = {
  format: "goods-shipping-v1";
  source: ReviewSource;
  sourceHash: string;
  sellerId: string;
  currency: "EUR";
  language: Language;
  country: string;
  option: ShippingOption;
  lines: ReviewLine[];
  allocationId: string | null;
  originalSourceExpiresAt: string | null;
};
export type ShippingReview = {
  actorKey: string;
  actorSubject: string;
  id: string;
  revision: number;
  state: "reviewed" | "accepted" | "bound";
  snapshotHash: string;
  snapshot: ShippingSnapshot;
  expiresAt: string;
  expired: boolean;
  recipient: Recipient | null;
  recipientExpiresAt: string | null;
  quoteId: string | null;
  canAccept: boolean;
};
export type ShippingBridge = {
  format: "goods-shipping-v1";
  choice: ShippingChoice;
  policyId: string;
  policyVersion: number;
  policyHash: string;
  financialPolicyId: string;
  carrierBindingId: string;
  carrierBindingHash: string;
  rateId: string;
  rateHash: string;
  recipientRef: string;
  country: string;
  method: "shipping";
  sourceHash: string;
  costs: ShippingCosts;
  shippingRefund: ShippingPolicy["shippingRefund"];
  terms: string;
  rights: string;
  refundTerms: string;
  taxDescription: string;
  recipientPurpose: string;
  retentionDescription: string;
  aftercare: {
    policyId: string;
    version: number;
    termsHash: string;
    acknowledged: true;
    buyerTerms: string;
  };
};
