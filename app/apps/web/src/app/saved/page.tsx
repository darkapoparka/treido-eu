import { readBuyerPageMetadata } from "@/features/catalog/public-metadata.server";
export const generateMetadata = () => readBuyerPageMetadata("saved");
import { connection } from "next/server";
import {
  readCatalog,
  referencePreviewEnabled,
} from "@/features/catalog/queries.server";
import { Saved } from "@/features/discovery/saved";
import { BuyerSavedPage } from "@/features/library/page";
export default async function Page() {
  await connection();
  if (referencePreviewEnabled()) return <Saved catalog={await readCatalog()} />;
  return <BuyerSavedPage />;
}
