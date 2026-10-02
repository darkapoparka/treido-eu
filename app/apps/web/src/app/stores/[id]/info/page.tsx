import { readSellerPage } from "@/features/catalog/seller-page.server";
import { StoreInfo } from "@/features/discovery/store";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { store, catalog } = await readSellerPage(id);
  return <StoreInfo store={store} catalog={catalog} />;
}
