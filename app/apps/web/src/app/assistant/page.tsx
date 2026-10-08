import { readCatalog } from "@/features/catalog/queries.server";
import { readBuyerReferenceMode } from "@/features/catalog/buyer-data-mode.server";
import { Assistant } from "@/features/discovery/assistant";
import { legacyAssistantDestination } from "@/features/assistant-runs/legacy-routes";
import { pageLocale } from "@/features/locale/page-locale.server";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await readBuyerReferenceMode())) {
    await connection();
    const source = await searchParams;
    const destination = legacyAssistantDestination(
      "assistant",
      source,
      await pageLocale(source.lang),
    );
    if (!destination) notFound();
    redirect(destination);
  }
  const catalog = await readCatalog();
  return <Assistant catalog={catalog} />;
}
