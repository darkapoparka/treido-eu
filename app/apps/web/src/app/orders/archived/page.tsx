import { readCatalog } from "@/features/catalog/queries.server";
import { OrdersPage } from "@/features/commerce/orders";
export default async function Page() {
  const catalog = await readCatalog();
  return <OrdersPage catalog={catalog} archive />;
}
