import { readSellerPage } from "@/features/catalog/seller-page.server";
import { FirstCollectionPrompt } from "@/features/discovery/first-collection";
import { StoreCollection } from "@/features/discovery/store";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  const { store, catalog } = await readSellerPage(id);
  return (
    <>
      <StoreCollection store={store} catalog={catalog} slug={slug} />
      <FirstCollectionPrompt key={`${id}/${slug}`} catalog={catalog} />
    </>
  );
}
