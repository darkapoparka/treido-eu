import { readBuyerExploreData } from "../../features/catalog/buyer-entry.server";
import { Explore } from "../../features/discovery/explore";
import type { MarketplaceSearchParams } from "../../features/discovery/marketplace-page.server";
import { redirect } from "next/navigation";
import { readDiscoveryInput } from "../../features/catalog/discovery-input";
import { readLocaleRequest } from "../../features/locale/request.server";
import { marketplaceResultsHref } from "../../features/discovery/marketplace-navigation";
import { readExploreMetadata } from "../../features/catalog/public-metadata.server";
import { cache } from "react";
type Props = {
  searchParams: Promise<MarketplaceSearchParams>;
};
// Metadata and the body share one fresh, eligible snapshot for this request.
// Normalized public criteria exclude private and unrecognized URL values.
const readExploreData = cache((criteria: string) =>
  readBuyerExploreData(criteria),
);
export async function generateMetadata({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = readDiscoveryInput(raw);
  if (parsed.input.category) return readExploreMetadata(raw, false);
  const data = await readExploreData(parsed.canonical);
  return readExploreMetadata(
    raw,
    !!data.publicView?.page && !data.publicView.unavailable,
  );
}
export default async function Page({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = readDiscoveryInput(raw);
  if (parsed.input.category) {
    const { locale } = await readLocaleRequest();
    redirect(
      marketplaceResultsHref({ ...parsed.input, locale }, parsed.cursor),
    );
  }
  return <Explore {...await readExploreData(parsed.canonical)} />;
}
