import { readCatalog } from "@/features/catalog/queries.server";
import { Widgets } from "@/features/discovery/widgets";
export default async function Page() {
  await readCatalog();
  return <Widgets />;
}
