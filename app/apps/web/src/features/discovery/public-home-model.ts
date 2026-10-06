import type {
  PublicDiscoveryPage,
  PublicListingCard,
} from "../catalog/public-discovery-model";
import type { PromotionPlacement } from "../promotions/placement";

export type PublicHomeSection =
  | {
      kind: "business";
      seller: PublicListingCard["seller"];
      placements: PromotionPlacement[];
    }
  | { kind: "personal"; placements: PromotionPlacement[] };

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
    if (seller.kind === "business") {
      if (previous?.kind === "business" && previous.seller.id === seller.id) {
        previous.placements.push(placement);
      } else {
        sections.push({ kind: "business", seller, placements: [placement] });
      }
    } else if (previous?.kind === "personal") {
      previous.placements.push(placement);
    } else {
      sections.push({ kind: "personal", placements: [placement] });
    }
  }
  return sections;
}
