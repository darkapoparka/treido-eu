import { readCatalog } from "@/features/catalog/queries.server";
import { OrderReview } from "@/features/commerce/orders";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const catalog = await readCatalog();
  const { id } = await params;
  return <OrderReview id={id} catalog={catalog} />;
}
