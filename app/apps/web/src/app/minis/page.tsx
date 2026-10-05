import { ToolHub } from "@/features/shopping-tools/tool-ui";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { readCatalog } from "@/features/catalog/queries.server";
import { Minis } from "@/features/discovery/minis";
export default async function Page() {
  if (!referencePreviewEnabled()) return <ToolHub />;
  const catalog = await readCatalog();
  return <Minis android={Boolean(catalog.liveHomeStoreIds)} />;
}
