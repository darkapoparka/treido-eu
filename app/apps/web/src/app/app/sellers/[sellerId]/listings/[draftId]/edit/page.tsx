import { redirect } from "next/navigation";
import { pageLocale } from "@/features/locale/page-locale.server";
import { randomUUID } from "node:crypto";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable, Workspace } from "@/features/sellers/workspace";
import {
  requirePageIdentity,
  recoveryKey,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { readSellerContext } from "@/features/sellers/persistence.server";
import { readListingDraft } from "@/features/selling/drafts.server";
import { DraftEditor } from "@/features/selling/draft-editor";
import { ProductOrganizationPanel } from "@/features/sellers/product-organization-panel.server";
import { getDatabase } from "@/server/db/database";
import { mediaConfigured } from "@/server/media/status.server";

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string; draftId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  if (!backendConfigured()) return <BackendUnavailable />;
  const { sellerId, draftId } = await params;
  const { lang } = await searchParams;
  const language = await pageLocale(lang);
  const identity = await requirePageIdentity(
    `/app/sellers/${sellerId}/listings/${draftId}/edit?lang=${language}`,
  );
  const database = getDatabase();
  const { seller, draft } = await readPrivatePage(async () => {
    const seller = await readSellerContext(
      database,
      identity,
      sellerId,
      "listing.read",
    );
    const draft = await readListingDraft(database, identity, sellerId, draftId);
    return { seller, draft };
  });
  if (draft.publication === "published")
    redirect(
      `/app/sellers/${sellerId}/listings/${draftId}/review?lang=${language}`,
    );
  const key = recoveryKey(identity.subject, `${sellerId}/${draftId}`);
  return (
    <Workspace
      title={language === "bg" ? "Редактирай продукт" : "Edit product"}
      back={`/app/sellers/${sellerId}/listings?lang=${language}`}
      language={language}
    >
      <DraftEditor
        admin
        key={key}
        initial={draft}
        sellerId={sellerId}
        requestId={randomUUID()}
        language={language}
        bufferKey={key}
        actorSubject={identity.subject}
        canWrite={seller.capabilities.includes("listing.write")}
        mediaAvailable={mediaConfigured()}
      />
      <ProductOrganizationPanel identity={identity} sellerId={sellerId} listingId={draftId} language={language} canWrite={seller.capabilities.includes("listing.write")} />
    </Workspace>
  );
}
