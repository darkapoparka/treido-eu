import { readSellerMetadata } from "@/features/catalog/public-metadata.server";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return readSellerMetadata((await params).id, "info");
}
import {
  MarketplacePage,
  type MarketplaceSearchParams,
} from "@/features/discovery/marketplace-page.server";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { readSellerPage } from "@/features/catalog/seller-page.server";
import { StoreInfo } from "@/features/discovery/store";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const { id } = await params;
  if (!referencePreviewEnabled())
    return <MarketplacePage raw={await searchParams} sellerId={id} info />;
  const { store, catalog } = await readSellerPage(id);
  return <StoreInfo store={store} catalog={catalog} />;
}
