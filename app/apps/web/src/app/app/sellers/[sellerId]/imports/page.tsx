import { pageLocale } from "@/features/locale/page-locale.server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable } from "@/features/sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { readCatalogueImports } from "@/features/catalogue-import/queries.server";
import { CatalogueImports } from "@/features/catalogue-import";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ lang?: string; before?: string }>;
}) {
  const { sellerId } = await params,
    input = await searchParams,
    language = await pageLocale(input.lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const actor = await requirePageIdentity(
    "/app/sellers/" + sellerId + "/imports?lang=" + language,
  );
  const initial = await readPrivatePage(() =>
    readCatalogueImports(getDatabase(), actor, {
      sellerId,
      before: input.before ?? null,
    }),
  );
  return (
    <CatalogueImports
      key={sellerId + "/" + actor.subject + "/" + (input.before ?? "")}
      initial={initial}
      actorSubject={actor.subject}
      before={input.before ?? null}
    />
  );
}
