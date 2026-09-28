import { readCatalog } from "@/features/catalog/queries.server";
import { OrderConfirmation } from "@/features/commerce/orders";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const catalog = await readCatalog();
  const { id } = await params;
  return <OrderConfirmation id={id} catalog={catalog} />;
}
