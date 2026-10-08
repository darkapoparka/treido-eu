import { ToolHub } from "@/features/shopping-tools/tool-ui";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { readCatalog } from "@/features/catalog/queries.server";
import { Minis } from "@/features/discovery/minis";
export default async function Page() {
  if (!(await readBuyerReferenceMode())) return <ToolHub />;
  const catalog = await readCatalog();
  return <Minis android={Boolean(catalog.liveHomeStoreIds)} />;
}
