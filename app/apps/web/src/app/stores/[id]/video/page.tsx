import { notFound } from "next/navigation";
import { readCatalog } from "@/features/catalog/queries.server";
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
