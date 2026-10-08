import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { AboutPage } from "@/features/account/support";
export default async function Page() {
  await readCatalog();
  return <AboutPage />;
}
