import { readCatalog } from "@/features/catalog/queries.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { GiftSense } from "@/features/discovery/minis";
import { NativeMiniSignIn } from "@/features/discovery/native-minis";
import { redirect } from "next/navigation";
import { pageLocale } from "@/features/locale/page-locale.server";
import { connection } from "next/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!(await readBuyerReferenceMode())) {
    await connection();
    redirect(
      "/minis/gift-finder?lang=" +
        (await pageLocale((await searchParams).lang)),
    );
  }
  const catalog = await readCatalog();
  return catalog.liveHomeStoreIds ? (
    <NativeMiniSignIn name="Gift Sense" />
  ) : (
    <GiftSense catalog={catalog} />
  );
}
