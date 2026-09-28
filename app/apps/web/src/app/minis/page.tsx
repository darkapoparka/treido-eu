import { readCatalog } from "@/features/catalog/queries.server";
import { Minis } from "@/features/discovery/minis";
export default async function Page() {
  const catalog = await readCatalog();
  return <Minis android={Boolean(catalog.liveHomeStoreIds)} />;
}
