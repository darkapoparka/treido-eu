import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { Receipt } from "@/features/commerce/orders";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const catalog = await readCatalog();
  const { id } = await params;
  return <Receipt id={id} catalog={catalog} />;
}
