import { readCatalog } from "@/features/catalog/queries.server";
import { Reviews } from "@/features/discovery/reviews";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await readCatalog();
  const { id } = await params;
  return <Reviews store available={id === "kitsch"} />;
}
