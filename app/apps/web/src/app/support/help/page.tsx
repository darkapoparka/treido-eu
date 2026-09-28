import { readCatalog } from "@/features/catalog/queries.server";
import { HelpPage } from "@/features/account/support";
export default async function Page() {
  await readCatalog();
  return <HelpPage />;
}
