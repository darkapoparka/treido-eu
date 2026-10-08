import { notFound } from "next/navigation";
import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { LivingRoomCuration } from "@/features/discovery/living-room";
export default async function Page() {
  const catalog = await readCatalog();
  if (!catalog.liveHomeStoreIds) notFound();
  return <LivingRoomCuration catalog={catalog} />;
}
