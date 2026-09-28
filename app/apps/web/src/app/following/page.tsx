import { readCatalog } from "@/features/catalog/queries.server";
import { Following } from "@/features/discovery/saved";
export default async function Page() {
  return <Following catalog={await readCatalog()} />;
}
