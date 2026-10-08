import { readCatalog } from "@/features/catalog/queries.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { PrivacyPage } from "@/features/account/privacy";
import { pageLocale } from "@/features/locale/page-locale.server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!(await readBuyerReferenceMode())) {
    await connection();
    const locale = await pageLocale((await searchParams).lang);
    redirect("/account/privacy/data?lang=" + locale);
  }
  await readCatalog();
  return <PrivacyPage />;
}
