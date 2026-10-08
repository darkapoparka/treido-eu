import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { Skin } from "@/features/discovery/minis";
export default async function Page() {
  const catalog = await readCatalog();
  return <Skin catalog={catalog} />;
}
