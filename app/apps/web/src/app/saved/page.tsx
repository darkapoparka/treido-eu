import { readBuyerPageMetadata } from "@/features/catalog/public-metadata.server";
export const generateMetadata = () => readBuyerPageMetadata("saved");
import { connection } from "next/server";
import { readCatalog } from "@/features/catalog/queries.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { Saved } from "@/features/discovery/saved";
import { BuyerSavedPage } from "@/features/library/page";
export default async function Page() {
  await connection();
  if (await readBuyerReferenceMode())
    return <Saved catalog={await readCatalog()} />;
  return <BuyerSavedPage />;
}
