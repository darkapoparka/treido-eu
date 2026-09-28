import { readCatalog } from "@/features/catalog/queries.server";
import { PaymentsPage } from "@/features/account/pages";
export default async function Page() {
  await readCatalog();
  return <PaymentsPage />;
}
