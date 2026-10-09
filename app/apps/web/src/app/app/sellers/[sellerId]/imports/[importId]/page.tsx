import { pageLocale } from "@/features/locale/page-locale.server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable } from "@/features/sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { readCatalogueImport } from "@/features/catalogue-import/queries.server";
import { CatalogueImportDetail } from "@/features/catalogue-import/detail";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string; importId: string }>;
  searchParams: Promise<{ lang?: string; after?: string }>;
}) {
  const { sellerId, importId } = await params,
    input = await searchParams,
    language = await pageLocale(input.lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const actor = await requirePageIdentity(
    "/app/sellers/" + sellerId + "/imports/" + importId + "?lang=" + language,
  );
  const initial = await readPrivatePage(() =>
    readCatalogueImport(getDatabase(), actor, {
      sellerId,
      importId,
      after:
        input.after === undefined
          ? 0
          : /^\d{1,4}$/.test(input.after)
            ? Number(input.after)
            : -1,
    }),
  );
  return (
    <CatalogueImportDetail
      key={sellerId + "/" + importId + "/" + actor.subject}
      initial={initial}
      actorSubject={actor.subject}
    />
  );
}
