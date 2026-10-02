import { readSellerPage } from "@/features/catalog/seller-page.server";
import { StoreSearch } from "@/features/discovery/store";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { store, catalog } = await readSellerPage(id);
  return <StoreSearch key={store.id} store={store} catalog={catalog} />;
}
