import { readCatalog } from "@/features/catalog/queries.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { SecurityPage } from "@/features/account/pages";
import { pageLocale } from "@/features/locale/page-locale.server";
import { connection } from "next/server";
import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!(await readBuyerReferenceMode())) {
    await connection();
    redirect(
      "/account/privacy/security?lang=" +
        (await pageLocale((await searchParams).lang)),
    );
  }
  await readCatalog();
  return <SecurityPage />;
}
