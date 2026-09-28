import { readCatalog } from "@/features/catalog/queries.server";
import { Assistant } from "@/features/discovery/assistant";
export default async function Page() {
  const catalog = await readCatalog();
  return <Assistant catalog={catalog} />;
}
