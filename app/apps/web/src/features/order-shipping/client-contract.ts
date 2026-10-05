import type { ShippingContext, ShippingOption, ShippingReview } from "./view";
export function shippingOptionForClient(
  option: ShippingOption,
  language: "bg" | "en",
) {
  const p = option.policy;
  return {
    policyId: p.id,
    rateId: option.rate.id,
    optionHash: option.optionHash,
    country: option.binding.country,
    carrier: option.binding.carrierLabel[language],
    method: option.binding.method,
    officeCodes: option.binding.officeCodes,
    fields: p.fields,
    requiredFields: p.requiredFields,
    costs: option.costs,
    recipientPurpose: p.recipientPurpose[language],
    retentionDescription: p.retentionDescription[language],
    terms: p.terms[language],
    rights: p.rights[language],
    refundTerms: p.refundTerms[language],
    taxDescription: p.taxDescription[language],
    aftercareTerms: option.financial.terms[language],
  };
}
export function shippingContextForClient(context: ShippingContext) {
  return {
    actorKey: context.actorKey,
    actorSubject: context.actorSubject,
    language: context.language,
    source: context.source,
    sourceHash: context.sourceHash,
    available: context.available,
    options: context.options.map((option) =>
      shippingOptionForClient(option, context.language),
    ),
  };
}
export function shippingAcceptanceForClient(
  review: ShippingReview,
  bridgeReady: boolean,
) {
  return {
    actorKey: review.actorKey,
    actorSubject: review.actorSubject,
    language: review.snapshot.language,
    id: review.id,
    revision: review.revision,
    snapshotHash: review.snapshotHash,
    state: review.state,
    source: review.snapshot.source,
    basePolicyId: review.snapshot.option.policy.basePolicyId,
    aftercare: {
      policyId: review.snapshot.option.financial.id,
      version: review.snapshot.option.financial.version,
      termsHash: review.snapshot.option.financial.termsHash,
      acknowledged: true as const,
    },
    canAccept: review.canAccept,
    bridgeReady,
    quoteId: review.quoteId,
    expired: review.expired,
  };
}
export type ShippingClientContext = ReturnType<typeof shippingContextForClient>;
export type ShippingClientAcceptance = ReturnType<
  typeof shippingAcceptanceForClient
>;
