import { notFound } from "next/navigation";
import { readCatalog } from "@/features/catalog/queries.server";
import { MerchantPolicy } from "@/features/discovery/merchant-policy";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; policy: string }>;
}) {
  const { id, policy } = await params;
  const catalog = await readCatalog();
  const store = catalog.stores.find((item) => item.id === id);
  if (policy !== "refund" && policy !== "shipping") notFound();
  const document = store?.referencePolicies?.[policy];
  if (!document) notFound();
  return <MerchantPolicy policy={document} />;
}
