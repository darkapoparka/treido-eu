import { readBuyerPageMetadata } from "@/features/catalog/public-metadata.server";
export const generateMetadata = () => readBuyerPageMetadata("search");
import { MarketplacePage } from "@/features/discovery/marketplace-page.server";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { readSearchCatalog } from "@/features/catalog/queries.server";
import { Search } from "@/features/discovery/search";
import { readSearchFilters } from "@/features/discovery/search-model";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  if (!referencePreviewEnabled()) return <MarketplacePage raw={raw} />;
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
