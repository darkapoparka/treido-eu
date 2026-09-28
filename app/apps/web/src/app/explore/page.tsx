import { readCatalog } from "@/features/catalog/queries.server";
import { Explore } from "@/features/discovery/explore";
export default async function Page() {
  const catalog = await readCatalog();
  return <Explore catalog={catalog} />;
}
