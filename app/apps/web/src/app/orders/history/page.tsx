import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { OrdersPage } from "@/features/commerce/orders";
export default async function Page() {
  const catalog = await readCatalog();
  return <OrdersPage catalog={catalog} history />;
}
