import { notFound } from "next/navigation";
import { readCatalog } from "@/features/catalog/queries.server";
import { StoreSearch } from "@/features/discovery/store";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const catalog = await readCatalog();
  const { id } = await params;
  const store = catalog.stores.find((s) => s.id === id);
  if (!store) notFound();
  return <StoreSearch key={store.id} store={store} catalog={catalog} />;
}
