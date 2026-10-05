import { pageLocale } from "@/features/locale/page-locale.server";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable } from "@/features/sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { readInventoryIndex } from "@/features/inventory/index.server";
import { SellerInventory } from "@/features/inventory";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sellerId } = await params,
    input = await searchParams,
    language = await pageLocale(input.lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const actor = await requirePageIdentity(
    "/app/sellers/" + sellerId + "/inventory?lang=" + language,
  );
  const initial = await readPrivatePage(() =>
    readInventoryIndex(getDatabase(), actor, sellerId, input),
  );
  return (
    <SellerInventory
      key={sellerId + "/" + actor.subject + "/" + JSON.stringify(initial.query)}
      initial={initial}
      actorSubject={actor.subject}
    />
  );
}
