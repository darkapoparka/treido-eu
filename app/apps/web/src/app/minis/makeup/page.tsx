import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { MakeupMaster } from "@/features/discovery/native-minis";
export default async function Page() {
  await readCatalog();
  return <MakeupMaster />;
}
