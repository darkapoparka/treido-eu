import { notFound } from "next/navigation";
import { readCatalog } from "@/features/catalog/queries.server";
import { Storefront } from "@/features/discovery/store";
import { Deals } from "@/features/discovery/deals";
import { dealStores } from "@/features/catalog/reference/deal-fixtures";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const catalog = await readCatalog();
  const { id } = await params;
  const store = catalog.stores.find((s) => s.id === id);
  if (!store) notFound();
  if (dealStores.some((dealStore) => dealStore.id === id))
    return <Deals initialStoreId={id} />;
  return <Storefront catalog={catalog} store={store} />;
}
