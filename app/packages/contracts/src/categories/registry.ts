import { categoryCatalogue } from "./catalogue";
import { profileForLeaf } from "./profiles";
import type {
  Category,
  CategoryLeaf,
  CategoryPolicy,
  CategoryRoot,
  ItemCondition,
} from "./types";

export const CATEGORY_REGISTRY_VERSION = 1 as const;
export const itemConditions = Object.freeze([
  "new",
  "new_other",
  "like_new",
  "good",
  "fair",
  "for_parts",
  "refurbished",
] as const);
export const sellerKinds = Object.freeze(["personal", "business"] as const);
const standardConditions: readonly ItemCondition[] = Object.freeze([
  "new",
  "new_other",
  "like_new",
  "good",
  "fair",
]);
const repairableRoots = new Set([
  "electronics",
  "appliances",
  "garden-diy",
  "music",
  "gaming",
  "motors-parts",
  "business-equipment",
]);
const rootRestrictions: Readonly<Record<string, readonly string[]>> = {
  electronics: ["battery_shipping_review", "private_serials_not_public"],
  fashion: ["no_counterfeit_goods"],
  "baby-kids": ["safety_and_recall_review", "no_used_child_car_seats"],
  "beauty-care": [
    "no_opened_cosmetics",
    "no_medical_products",
    "expiry_and_batch_review",
  ],
  "hobbies-collectibles": [
    "no_financial_assets",
    "no_protected_antiquities",
    "provenance_review",
  ],
  gaming: ["physical_media_only", "no_digital_keys", "no_account_transfers"],
  "motors-parts": [
    "no_whole_vehicles",
    "no_airbags",
    "safety_component_review",
    "declared_fitment_only",
  ],
  "pet-supplies": ["no_live_animals", "no_pet_food", "no_veterinary_products"],
  "business-equipment": [
    "industrial_hazards_review",
    "no_medical_equipment",
    "no_controlled_goods",
  ],
  "art-handmade": ["maker_claim_evidence"],
};

function policyForLeaf(root: string, slug: string): CategoryPolicy {
  const sealed = root === "beauty-care" && slug.startsWith("sealed-");
  const unworn = root === "fashion" && slug === "unworn-intimates-swimwear";
  const conditions = sealed
    ? Object.freeze(["new"] as const)
    : unworn
      ? Object.freeze(["new", "new_other"] as const)
      : repairableRoots.has(root)
        ? itemConditions
        : standardConditions;
  return Object.freeze({
    version: 1,
    // Only a reviewed policy migration plus a real selling path can enable a leaf.
    reviewStatus: "pending",
    enabledForPublish: false,
    sellerKinds,
    conditions,
    countries: Object.freeze(["BG"] as const),
    handoverModes: Object.freeze(["shipping", "pickup"] as const),
    purchaseModes: Object.freeze(["contact", "checkout"] as const),
    restrictions: Object.freeze([
      "physical_goods_only",
      "no_prohibited_items",
      ...(rootRestrictions[root] ?? []),
      ...(sealed ? ["factory_sealed_required"] : []),
      ...(unworn ? ["unworn_required"] : []),
      ...(slug === "sealed-fragrance"
        ? ["dangerous_goods_shipping_review"]
        : []),
    ]),
  });
}

export const categoryRoots: readonly CategoryRoot[] = Object.freeze(
  categoryCatalogue.map((root) =>
    Object.freeze({
      id: root.id,
      kind: "root" as const,
      parentId: null,
      slug: root.slug,
      labels: Object.freeze({ ...root.labels }),
    }),
  ),
);
export const categoryLeaves: readonly CategoryLeaf[] = Object.freeze(
  categoryCatalogue.flatMap((root) =>
    root.leaves.map((leaf) =>
      Object.freeze({
        id: leaf.id,
        kind: "leaf" as const,
        parentId: root.id,
        slug: leaf.slug,
        labels: Object.freeze({ ...leaf.labels }),
        profile: profileForLeaf(root.slug, leaf.slug),
        policy: policyForLeaf(root.slug, leaf.slug),
      }),
    ),
  ),
);
const categories = new Map<string, Category>(
  [...categoryRoots, ...categoryLeaves].map((category) => [
    category.id,
    category,
  ]),
);

export function getCategory(id: string): Category | undefined {
  return categories.get(id);
}

export function getCategoryLabel(
  id: string,
  locale: string = "bg",
): string | undefined {
  const category = getCategory(id);
  return category?.labels[locale === "en" ? "en" : "bg"];
}

export function getCategoryAncestry(id: string): readonly Category[] {
  const category = getCategory(id);
  if (!category) return [];
  if (category.kind === "root") return [category];
  const parent = getCategory(category.parentId);
  return parent ? [parent, category] : [];
}

/** Planned leaves for draft preparation, never a public inventory/count query. */
export function searchDraftCategories(
  query: string,
  limit = 24,
): readonly CategoryLeaf[] {
  if (
    query.length > 200 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 48
  )
    return [];
  const terms = query
    .normalize("NFKC")
    .toLocaleLowerCase("bg")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return categoryLeaves
    .filter((leaf) => {
      const parent = categories.get(leaf.parentId);
      const haystack =
        `${leaf.labels.bg} ${leaf.labels.en} ${leaf.slug} ${parent?.labels.bg ?? ""} ${parent?.labels.en ?? ""}`.toLocaleLowerCase(
          "bg",
        );
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
}

export function getChildren(parentId: string): readonly CategoryLeaf[] {
  return categoryLeaves.filter((leaf) => leaf.parentId === parentId);
}
