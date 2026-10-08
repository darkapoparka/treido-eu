import { LanguagePreferences } from "@/features/locale/preferences";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
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
      "/account/privacy/preferences?lang=" +
        (await pageLocale((await searchParams).lang)),
    );
  }
  return <LanguagePreferences />;
}
