import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { PublicProfile } from "@/features/account/pages";
export default async function Page() {
  const catalog = await readCatalog();
  return <PublicProfile catalog={catalog} />;
}
