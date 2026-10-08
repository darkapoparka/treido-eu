import { readSellerMetadata } from "@/features/catalog/public-metadata.server";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return readSellerMetadata((await params).id, "info");
}
import { readPublicStoreView } from "@/features/discovery/public-store.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { readSellerPage } from "@/features/catalog/seller-page.server";
import { StoreInfo } from "@/features/discovery/store";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!(await readBuyerReferenceMode()))
    return (
      <StoreInfo
        publicView={await readPublicStoreView(id, await searchParams, true)}
      />
    );
  const { store, catalog } = await readSellerPage(id);
  return <StoreInfo store={store} catalog={catalog} />;
}
