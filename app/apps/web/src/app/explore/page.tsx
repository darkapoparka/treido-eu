import {
  readCatalog,
  referencePreviewEnabled,
} from "../../features/catalog/queries.server";
import {
  MarketplacePage,
  type MarketplaceSearchParams,
} from "../../features/discovery/marketplace-page.server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  if (!referencePreviewEnabled())
    return <MarketplacePage raw={await searchParams} />;
  const { Explore } = await import("../../features/discovery/explore");
  const catalog = await readCatalog();
  return <Explore catalog={catalog} />;
}
