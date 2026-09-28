import { notFound } from "next/navigation";
import { readCatalog } from "@/features/catalog/queries.server";
import { FirstCollectionPrompt } from "@/features/discovery/first-collection";
import { StoreCollection } from "@/features/discovery/store";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const catalog = await readCatalog();
  const { id, slug } = await params;
  const store = catalog.stores.find((s) => s.id === id);
  if (!store) notFound();
  return (
    <>
      <StoreCollection store={store} catalog={catalog} slug={slug} />
      <FirstCollectionPrompt key={`${id}/${slug}`} catalog={catalog} />
    </>
  );
}
