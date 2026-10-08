import { readBuyerExploreData } from "../../features/catalog/buyer-entry.server";
import { Explore } from "../../features/discovery/explore";
import type { MarketplaceSearchParams } from "../../features/discovery/marketplace-page.server";
import { redirect } from "next/navigation";
import { readDiscoveryInput } from "../../features/catalog/discovery-input";
import { readLocaleRequest } from "../../features/locale/request.server";
import { marketplaceResultsHref } from "../../features/discovery/marketplace-navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const raw = await searchParams;
  const parsed = readDiscoveryInput(raw);
  if (parsed.input.category) {
    const { locale } = await readLocaleRequest();
    redirect(
      marketplaceResultsHref({ ...parsed.input, locale }, parsed.cursor),
    );
  }
  return <Explore {...await readBuyerExploreData(raw)} />;
}
