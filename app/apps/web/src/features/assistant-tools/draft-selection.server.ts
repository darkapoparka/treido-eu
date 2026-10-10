import "server-only";
import { getCategory } from "@treido/contracts/categories";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { inputHash, listOwnedSellers, readSellerContext } from "../sellers/persistence.server";
import { readListingDraft, listListingDrafts } from "../selling/drafts.server";
import { toCategoryAttributes } from "../selling/form-model";
import { searchToolCatalogue } from "../shopping-tools/catalogue.server";
import { editableDraft, inspectHelperDraft } from "./sell-helper-model";
export async function helperSellerChoices(database: SellerDatabase, identity: VerifiedIdentity) {
  return (await listOwnedSellers(database, identity))
    .filter((seller) => seller.capabilities.includes("listing.write") && seller.capabilities.includes("listing.read"))
    .map((seller) => ({ id: seller.sellerId, name: seller.name, kind: seller.kind }));
}
export const helperDraftChoices = listListingDrafts;
export async function helperDraftSelection(database: SellerDatabase, identity: VerifiedIdentity, sellerId: string, draftId: string) {
  const seller = await readSellerContext(database, identity, sellerId, "listing.write");
  const draft = await readListingDraft(database, identity, sellerId, draftId);
  const category = draft.payload.categoryId ? getCategory(draft.payload.categoryId) : null;
  const base = { draft, sellerKind: seller.kind, baseHash: inputHash(draft.payload), edit: editableDraft(draft.payload), issues: inspectHelperDraft(draft.payload) };
  const asking: { listingId: string; revision: number; priceMinor: number; checkedAt: string }[] = [];
  if (category?.kind !== "leaf") return { ...base, asking, askingStatus: "insufficient" as const };
  const attributes = toCategoryAttributes(category, draft.payload.fields);
  // Comparable asking amounts use exact brand/model, category and condition.
  // They are observations, never an automatic price recommendation or sale fact.
  if (typeof attributes.brand !== "string" || typeof attributes.model !== "string" || !attributes.brand.trim() || !attributes.model.trim() || !draft.payload.condition)
    return { ...base, asking, askingStatus: "insufficient" as const };
  const params = new URLSearchParams({ category: category.id, condition: draft.payload.condition, currency: "EUR", "attr.brand": attributes.brand, "attr.model": attributes.model });
  try {
    const results = await searchToolCatalogue(database, params.toString(), "find-for-me");
    for (const item of results.items.filter((item) => item.card.id !== draftId).slice(0, 4))
      asking.push({ listingId: item.card.id, revision: item.revision, priceMinor: item.card.price.amount, checkedAt: item.checkedAt });
    return { ...base, asking, askingStatus: asking.length ? "observed" as const : "insufficient" as const };
  } catch {
    return { ...base, asking, askingStatus: "unavailable" as const };
  }
}
