import { LanguagePreferences } from "@/features/locale/preferences";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { connection } from "next/server";
import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!referencePreviewEnabled()) {
    await connection();
    redirect(
      "/account/privacy/preferences?lang=" +
        (await pageLocale((await searchParams).lang)),
    );
  }
  return <LanguagePreferences />;
}
