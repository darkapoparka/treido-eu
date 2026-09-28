import { readCatalog } from "@/features/catalog/queries.server";
import { OrderDetail } from "@/features/commerce/orders";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const catalog = await readCatalog();
  const { id } = await params;
  return <OrderDetail id={id} catalog={catalog} />;
}
