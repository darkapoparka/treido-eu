import { readBuyerReferenceMode } from "../../features/catalog/buyer-data-mode.server";
import { MarketplaceDeals } from "../../features/discovery/marketplace-deals";

export default async function Page() {
  if (await readBuyerReferenceMode()) {
    const { Deals } = await import("../../features/discovery/deals");
    return <Deals />;
  }
  return <MarketplaceDeals />;
}
