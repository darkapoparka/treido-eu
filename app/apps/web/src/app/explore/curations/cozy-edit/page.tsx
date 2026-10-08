import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { CozyEdit } from "@/features/discovery/cozy-edit";
export default async function Page() {
  const catalog = await readCatalog();
  return <CozyEdit catalog={catalog} />;
}
