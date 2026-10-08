import type {
  PublicDiscoveryPage,
  PublicListingCard,
} from "../catalog/public-discovery-model";
import type { PromotionPlacement } from "../promotions/placement";

export type PublicHomeSection = {
  kind: PublicListingCard["seller"]["kind"];
  seller: PublicListingCard["seller"];
  placements: PromotionPlacement[];
};

/** Group adjacent display positions only. Pulling all of a merchant's products
 * into one shelf would change ranking and the server's sponsored positions. */
export function publicHomeSections(
  page: Pick<PublicDiscoveryPage, "items" | "placements">,
): PublicHomeSection[] {
  const display =
    page.placements ??
    page.items.map((listing) => ({ listing, sponsored: null }));
  const sections: PublicHomeSection[] = [];
  for (const placement of display) {
    const seller = placement.listing.seller;
    const previous = sections.at(-1);
    if (previous?.seller.id === seller.id && previous.kind === seller.kind) {
      previous.placements.push(placement);
    } else {
      sections.push({ kind: seller.kind, seller, placements: [placement] });
    }
  }
  return sections;
}
