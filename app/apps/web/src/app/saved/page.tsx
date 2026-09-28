import { readCatalog } from "@/features/catalog/queries.server";
import { Saved } from "@/features/discovery/saved";
export default async function Page() {
  return <Saved catalog={await readCatalog()} />;
}
