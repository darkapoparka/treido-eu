import { notFound } from "next/navigation";
import { readCatalog } from "@/features/catalog/queries.server";
import { LivingRoomCuration } from "@/features/discovery/living-room";
export default async function Page() {
  const catalog = await readCatalog();
  if (!catalog.liveHomeStoreIds) notFound();
  return <LivingRoomCuration catalog={catalog} />;
}
