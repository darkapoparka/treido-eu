import { readSellerPage } from "@/features/catalog/seller-page.server";
import { Reviews } from "@/features/discovery/reviews";
import { NativeStoreReviews } from "@/features/discovery/native-merchant-reviews";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { store, catalog } = await readSellerPage(id);
  if (store.referenceStyle === "android")
    return <NativeStoreReviews store={store} catalog={catalog} />;
  return <Reviews store available={id === "kitsch"} />;
}
