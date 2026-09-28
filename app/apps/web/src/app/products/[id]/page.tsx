import { notFound } from "next/navigation";
import { readCatalog } from "@/features/catalog/queries.server";
import { ProductDetail } from "@/features/discovery/product";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const catalog = await readCatalog();
  const { id } = await params;
  const product = catalog.products.find((p) => p.id === id);
  if (!product) notFound();
  return <ProductDetail key={product.id} catalog={catalog} product={product} />;
}
