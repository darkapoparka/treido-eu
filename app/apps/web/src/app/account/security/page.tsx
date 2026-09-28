import { readCatalog } from "@/features/catalog/queries.server";
import { SecurityPage } from "@/features/account/pages";
export default async function Page() {
  await readCatalog();
  return <SecurityPage />;
}
