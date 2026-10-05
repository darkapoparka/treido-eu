import { readBuyerPageMetadata } from "@/features/catalog/public-metadata.server";
export const generateMetadata = () => readBuyerPageMetadata("following");
import { connection } from "next/server";
import {
  readCatalog,
  referencePreviewEnabled,
} from "@/features/catalog/queries.server";
import { Following } from "@/features/discovery/saved";
import { BuyerSavedPage } from "@/features/library/page";
export default async function Page() {
  await connection();
  if (referencePreviewEnabled())
    return <Following catalog={await readCatalog()} />;
  return <BuyerSavedPage following />;
}
