import { readSellerMetadata } from "@/features/catalog/public-metadata.server";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return readSellerMetadata((await params).id, "store");
}
import { readPublicStoreView } from "@/features/discovery/public-store.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { readSellerPage } from "@/features/catalog/seller-page.server";
import { Storefront } from "@/features/discovery/store";
import { Deals } from "@/features/discovery/deals";
import { dealStores } from "@/features/catalog/reference/deal-fixtures";
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
      <Storefront
        publicView={await readPublicStoreView(id, await searchParams)}
      />
    );
  const { store, catalog } = await readSellerPage(id);
  if (
    !catalog.liveHomeStoreIds &&
    dealStores.some((dealStore) => dealStore.id === id)
  )
    return <Deals initialStoreId={id} />;
  return <Storefront catalog={catalog} store={store} />;
}
