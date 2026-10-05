import { referencePreviewEnabled } from "../../features/catalog/queries.server";
import { MarketplaceDeals } from "../../features/discovery/marketplace-deals";

export default async function Page() {
  if (referencePreviewEnabled()) {
    const { Deals } = await import("../../features/discovery/deals");
    return <Deals />;
  }
  return <MarketplaceDeals />;
}
