import { readCatalog } from "@/features/catalog/queries.server";
import { AboutPage } from "@/features/account/support";
export default async function Page() {
  await readCatalog();
  return <AboutPage />;
}
