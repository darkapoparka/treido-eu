import { readSellerPage } from "@/features/catalog/seller-page.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { PublicCatalogCollectionPage } from "@/features/sellers/catalog-presentation.server";
import { FirstCollectionPrompt } from "@/features/discovery/first-collection";
import { StoreCollection } from "@/features/discovery/store";

export default async function Page(props: {
  params: Promise<{ id: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await readBuyerReferenceMode())) return <PublicCatalogCollectionPage {...props} />;
  const { id, slug } = await props.params;
  const { store, catalog } = await readSellerPage(id);
  return <>
    <StoreCollection store={store} catalog={catalog} slug={slug} />
    <FirstCollectionPrompt key={`${id}/${slug}`} catalog={catalog} />
  </>;
}
