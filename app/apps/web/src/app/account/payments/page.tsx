import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { PaymentsPage } from "@/features/account/pages";
export default async function Page() {
  await readCatalog();
  return <PaymentsPage />;
}
