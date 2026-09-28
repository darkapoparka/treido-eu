import { readCatalog } from "@/features/catalog/queries.server";
import { SupportPage } from "@/features/account/support";
export default async function Page() {
  const catalog = await readCatalog();
  return <SupportPage android={Boolean(catalog.liveHomeStoreIds)} />;
}
