import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { NewOrder } from "@/features/commerce/orders";
export default async function Page() {
  await readCatalog();
  return <NewOrder />;
}
