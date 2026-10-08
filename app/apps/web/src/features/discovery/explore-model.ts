import {
  getBrowseCategory,
  getBrowseChildren,
  getBrowseAncestry,
  getBrowseLeafIds,
  browseCategoryRoots,
} from "@treido/contracts/categories";
import type { BuyerPublicView } from "../catalog/buyer-entry-model";
import {
  discoverySearchParams,
  type DiscoveryInput,
} from "../catalog/discovery-input";
import { discoveryDockDestination } from "./browse-scope-route";
import {
  marketplaceHref,
  marketplaceResultsHref,
} from "./marketplace-navigation";
import type { ExploreCategoryTile } from "./explore-category-tiles";
import type { PromotionPlacement } from "../promotions/placement";
import { categoryArtwork } from "./category-artwork";
const colors = [
  "#013888",
  "#9fa5ac",
  "#cd6001",
  "#bb405a",
  "#5d4c98",
  "#90a59c",
];
export function exploreHref(
  input: DiscoveryInput,
  cursor: string | null = null,
) {
  return marketplaceHref(
    input.category
      ? `/explore/${encodeURIComponent(input.category)}`
      : "/explore",
    input,
    cursor,
  );
}
/** Direct category entries have no owned browsing return. Keep the hierarchy
 * in the existing dock Back instead of adding a second exit above the rail. */
export function publicExploreBackHref(input: DiscoveryInput) {
  const selected = input.category ? getBrowseCategory(input.category) : null;
  if (selected?.parentId)
    return exploreHref({
      ...input,
      category: selected.parentId,
      attributes: {},
    });
  const params = discoverySearchParams(input);
  params.set("lang", input.locale);
  return discoveryDockDestination("/explore", params);
}
export function exploreCategoryTiles(
  view: BuyerPublicView,
): ExploreCategoryTile[] {
  const selected = view.input.category
    ? getBrowseCategory(view.input.category)
    : null;
  const categories =
    selected && selected.kind !== "leaf"
      ? getBrowseChildren(selected.id)
      : selected
        ? []
        : browseCategoryRoots;
  return categories.map((category, index) => ({
    id: category.id,
    title: category.labels[view.input.locale],
    href: exploreHref({ ...view.input, category: category.id, attributes: {} }),
    color: colors[index % colors.length],
    artwork: categoryArtwork(category.id),
    photos: (view.page?.items ?? [])
      .filter(
        (item) =>
          item.categoryId === category.id ||
          getBrowseLeafIds(category.id).some((id) => id === item.categoryId),
      )
      .flatMap((item) => item.images.slice(0, 1))
      .slice(0, 2),
  }));
}

/** Real shelves group each immediate browse branch without rating or
 * campaign claims that the eligible publication projection does not contain. */
export function publicExploreShelves(view: BuyerPublicView) {
  const shelves: {
    categoryId: string;
    title: string;
    href: string;
    placements: PromotionPlacement[];
  }[] = [];
  const display =
    view.page?.placements ??
    view.page?.items.map((listing) => ({ listing, sponsored: null })) ??
    [];
  for (const placement of display) {
    const leaf = getBrowseCategory(placement.listing.categoryId);
    const ancestry = leaf ? getBrowseAncestry(leaf.id) : [];
    const selectedIndex = ancestry.findIndex(
      (category) => category.id === view.input.category,
    );
    const category = !view.input.category
      ? ancestry[0]
      : selectedIndex < 0
        ? null
        : (ancestry[selectedIndex + 1] ?? leaf);
    if (!category) continue;
    const previous = shelves.find((shelf) => shelf.categoryId === category.id);
    if (previous?.categoryId === category.id)
      previous.placements.push(placement);
    else
      shelves.push({
        categoryId: category.id,
        title: category.labels[view.input.locale],
        href: marketplaceResultsHref({
          ...view.input,
          category: category.id,
          attributes:
            view.input.category === category.id ? view.input.attributes : {},
        }),
        placements: [placement],
      });
  }
  return shelves;
}
