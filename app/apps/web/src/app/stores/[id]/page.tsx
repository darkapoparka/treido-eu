import { readSellerMetadata } from "@/features/catalog/public-metadata.server";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return readSellerMetadata((await params).id, "store");
}
import {
  MarketplacePage,
  type MarketplaceSearchParams,
} from "@/features/discovery/marketplace-page.server";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { readSellerPage } from "@/features/catalog/seller-page.server";
import { Storefront } from "@/features/discovery/store";
import { Deals } from "@/features/discovery/deals";
import { dealStores } from "@/features/catalog/reference/deal-fixtures";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const { id } = await params;
  if (!referencePreviewEnabled())
    return <MarketplacePage raw={await searchParams} sellerId={id} />;
  const { store, catalog } = await readSellerPage(id);
  if (
    !catalog.liveHomeStoreIds &&
    dealStores.some((dealStore) => dealStore.id === id)
  )
    return <Deals initialStoreId={id} />;
  return <Storefront catalog={catalog} store={store} />;
}
