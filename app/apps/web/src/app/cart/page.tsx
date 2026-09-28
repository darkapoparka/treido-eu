import { readCatalog } from "@/features/catalog/queries.server";
import { CartPage } from "@/features/commerce/checkout";
export default async function Page() {
  const catalog = await readCatalog();
  return <CartPage catalog={catalog} />;
}
