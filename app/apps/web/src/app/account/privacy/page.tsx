import { readCatalog } from "@/features/catalog/queries.server";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { PrivacyPage } from "@/features/account/privacy";
import { pageLocale } from "@/features/locale/page-locale.server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!referencePreviewEnabled()) {
    await connection();
    const locale = await pageLocale((await searchParams).lang);
    redirect("/account/privacy/data?lang=" + locale);
  }
  await readCatalog();
  return <PrivacyPage />;
}
