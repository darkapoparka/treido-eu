import { readCatalog } from "@/features/catalog/queries.server";
import { CozyEdit } from "@/features/discovery/cozy-edit";
export default async function Page() {
  const catalog = await readCatalog();
  return <CozyEdit catalog={catalog} />;
}
