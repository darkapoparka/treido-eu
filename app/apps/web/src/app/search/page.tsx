import { readBuyerPageMetadata } from "@/features/catalog/public-metadata.server";
export const generateMetadata = () => readBuyerPageMetadata("search");
import { readBuyerPublicView } from "@/features/catalog/buyer-entry.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { readSearchCatalog } from "@/features/catalog/queries.server";
import { Search } from "@/features/discovery/search";
import { readSearchFilters } from "@/features/discovery/search-model";
import { redirect } from "next/navigation";
import { readDiscoveryInput } from "@/features/catalog/discovery-input";
import { readLocaleRequest } from "@/features/locale/request.server";
import { marketplaceResultsHref } from "@/features/discovery/marketplace-navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  if (!(await readBuyerReferenceMode())) {
    const parsed = readDiscoveryInput(raw);
    if (parsed.input.category) {
      const { locale } = await readLocaleRequest();
      redirect(
        marketplaceResultsHref({ ...parsed.input, locale }, parsed.cursor),
      );
    }
    return <Search publicView={await readBuyerPublicView(raw)} />;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const query = params.get("q") ?? "";
  return (
    <Search
      catalog={await readSearchCatalog()}
      query={query}
      filters={readSearchFilters(params)}
    />
  );
}
