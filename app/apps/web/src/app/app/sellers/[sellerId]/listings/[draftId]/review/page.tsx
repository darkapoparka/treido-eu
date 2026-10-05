import { readInventory } from "@/features/inventory/queries.server";
import { InventoryEditor } from "@/features/inventory/editor";
import { pageLocale } from "@/features/locale/page-locale.server";
import { randomUUID } from "node:crypto";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable, Workspace } from "@/features/sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { readPublicationReview } from "@/features/selling/publication.server";
import { PublicationReviewPanel } from "@/features/selling/publication-review";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string; draftId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const language = await pageLocale(lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const { sellerId, draftId } = await params;
  const identity = await requirePageIdentity(
    `/app/sellers/${sellerId}/listings/${draftId}/review?lang=${language}`,
  );
  const review = await readPrivatePage(() =>
    readPublicationReview(getDatabase(), identity, sellerId, draftId),
  );
  const inventory = await readPrivatePage(() =>
    readInventory(getDatabase(), identity, { sellerId, listingId: draftId }),
  );
  return (
    <Workspace
      title={
        language === "bg" ? "Преглед на запазения артикул" : "Review saved item"
      }
      back={`/app/sellers/${sellerId}?lang=${language}`}
      language={language}
    >
      <PublicationReviewPanel
        review={review}
        requestId={randomUUID()}
        language={language}
      />
      <section id="inventory">
        <InventoryEditor
          key={identity.subject + ":" + draftId}
          initial={inventory}
          actorSubject={identity.subject}
        />
      </section>
    </Workspace>
  );
}
