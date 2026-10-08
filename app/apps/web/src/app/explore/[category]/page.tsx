import { notFound, redirect } from "next/navigation";
import {
  readBuyerExploreData,
  readBuyerPublicView,
} from "@/features/catalog/buyer-entry.server";
import { getBrowseCategory } from "@treido/contracts/categories";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import type { MarketplaceSearchParams } from "@/features/discovery/marketplace-page.server";
import { Explore } from "@/features/discovery/explore";
import { Search } from "@/features/discovery/search";
import { readDiscoveryInput } from "@/features/catalog/discovery-input";
import { readLocaleRequest } from "@/features/locale/request.server";
import { marketplaceResultsHref } from "@/features/discovery/marketplace-navigation";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  // This installed router retains URI escapes in dynamic segment values.
  // Decode once at the route boundary, before rendering or building Search.
  let category: string;
  try {
    category = decodeURIComponent((await params).category);
  } catch {
    notFound();
  }
  const canonical = category.startsWith("cat:") || category.startsWith("nav:");
  if (canonical && !getBrowseCategory(category)) notFound();
  const raw = await searchParams;
  if (canonical) {
    // The path owns the category. Repair absent/conflicting query state before
    // loading results so every client control sees the same applied category.
    const parsed = readDiscoveryInput(raw);
    if (parsed.input.category !== category) {
      const { locale } = await readLocaleRequest();
      const next = readDiscoveryInput({ ...raw, category, lang: locale });
      redirect(marketplaceResultsHref(next.input, next.cursor));
    }
    return <Search publicView={await readBuyerPublicView(raw, { category })} />;
  }
  if (!canonical && !(await readBuyerReferenceMode())) notFound();
  const data = await readBuyerExploreData(raw, category);
  return <Explore {...data} category={category} />;
}
