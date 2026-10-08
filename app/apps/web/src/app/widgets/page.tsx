import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { Widgets } from "@/features/discovery/widgets";
export default async function Page() {
  await readCatalog();
  return <Widgets />;
}
