import { notFound } from "next/navigation";
import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { StaudCuration } from "@/features/discovery/staud-curation";
export default async function Page() {
  const catalog = await readCatalog();
  if (!catalog.liveHomeStoreIds) notFound();
  return <StaudCuration catalog={catalog} />;
}
