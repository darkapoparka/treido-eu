import { readSellerPage } from "@/features/catalog/seller-page.server";
import { Storefront } from "@/features/discovery/store";
import { Deals } from "@/features/discovery/deals";
import { dealStores } from "@/features/catalog/reference/deal-fixtures";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { store, catalog } = await readSellerPage(id);
  if (
    !catalog.liveHomeStoreIds &&
    dealStores.some((dealStore) => dealStore.id === id)
  )
    return <Deals initialStoreId={id} />;
  return <Storefront catalog={catalog} store={store} />;
}
