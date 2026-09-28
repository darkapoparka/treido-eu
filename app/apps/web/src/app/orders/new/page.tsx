import { readCatalog } from "@/features/catalog/queries.server";
import { NewOrder } from "@/features/commerce/orders";
export default async function Page() {
  await readCatalog();
  return <NewOrder />;
}
