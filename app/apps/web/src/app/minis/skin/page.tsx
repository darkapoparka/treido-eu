import { readCatalog } from "@/features/catalog/queries.server";
import { Skin } from "@/features/discovery/minis";
export default async function Page() {
  const catalog = await readCatalog();
  return <Skin catalog={catalog} />;
}
