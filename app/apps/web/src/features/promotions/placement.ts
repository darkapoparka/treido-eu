import type { PublicListingCard } from "../catalog/public-discovery-model";
import type { ProductId } from "./model";

export type SponsoredCandidate = {
  campaignId: string;
  listingId: string;
  token: string;
  productId: ProductId;
  promotedFreshnessAt?: string | null;
};
export type PromotionPlacement = {
  listing: PublicListingCard;
  sponsored: null | {
    campaignId: string;
    token: string;
    label: "Sponsored";
    labelBg: "Спонсорирано";
    promotedFreshnessAt: string | null;
  };
};
/** Reorders only already matched genuine supply. Organic cursor/count/filter semantics and exact card dimensions stay with the catalogue owner. */
export function placeSponsored(
  organic: readonly PublicListingCard[],
  candidates: readonly SponsoredCandidate[],
): PromotionPlacement[] {
  const unique = organic.filter(
    (item, index) =>
      organic.findIndex((other) => other.id === item.id) === index,
  );
  const maximum = Math.floor(unique.length / 8);
  if (unique.length < 8 || maximum === 0)
    return unique.map((listing) => ({ listing, sponsored: null }));
  const selected: SponsoredCandidate[] = [];
  for (const candidate of candidates) {
    if (
      !unique.some((item) => item.id === candidate.listingId) ||
      selected.some((item) => item.listingId === candidate.listingId)
    )
      continue;
    selected.push(candidate);
    if (selected.length >= maximum) break;
  }
  const remaining = unique.filter(
    (item) => !selected.some((candidate) => candidate.listingId === item.id),
  );
  const placed: PromotionPlacement[] = remaining.map((listing) => ({
    listing,
    sponsored: null,
  }));
  selected.forEach((candidate, index) => {
    const listing = unique.find((item) => item.id === candidate.listingId)!;
    placed.splice((index + 1) * 8 - 1, 0, {
      listing,
      sponsored: {
        campaignId: candidate.campaignId,
        token: candidate.token,
        label: "Sponsored",
        labelBg: "Спонсорирано",
        promotedFreshnessAt: candidate.promotedFreshnessAt ?? null,
      },
    });
  });
  return placed;
}
