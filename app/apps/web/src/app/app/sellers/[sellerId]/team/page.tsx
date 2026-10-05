import { pageLocale } from "@/features/locale/page-locale.server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable } from "@/features/sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { readTeam } from "@/features/team/persistence.server";
import { Team } from "@/features/team/team";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { sellerId } = await params,
    language = await pageLocale((await searchParams).lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const actor = await requirePageIdentity(
    "/app/sellers/" + sellerId + "/team?lang=" + language,
  );
  const initial = await readPrivatePage(() =>
    readTeam(getDatabase(), actor, sellerId),
  );
  return (
    <Team
      key={sellerId + "/" + actor.subject}
      initial={initial}
      actorSubject={actor.subject}
      language={language}
    />
  );
}
