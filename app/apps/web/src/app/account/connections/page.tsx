import { readCatalog } from "@/features/catalog/queries.server";
import { ConnectionsPage } from "@/features/account/pages";
export default async function Page() {
  await readCatalog();
  return <ConnectionsPage />;
}
