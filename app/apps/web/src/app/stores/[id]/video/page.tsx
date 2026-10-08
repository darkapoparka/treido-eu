import { notFound } from "next/navigation";
import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { StoreVideo } from "@/features/discovery/store";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await readCatalog();
  if ((await params).id !== "chemical-guys") notFound();
  return <StoreVideo />;
}
