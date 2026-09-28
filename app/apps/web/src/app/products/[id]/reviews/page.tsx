import { notFound } from "next/navigation";
import { readCatalog } from "@/features/catalog/queries.server";
import { Reviews } from "@/features/discovery/reviews";
import { ProductRatings } from "@/features/discovery/product-ratings";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const catalog = await readCatalog();
  const product = catalog.products.find((item) => item.id === id);
  if (!product) notFound();
  return id === "shea-butter" ? (
    <Reviews productId={id} />
  ) : (
    <ProductRatings product={product} />
  );
}
