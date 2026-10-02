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
import { DraftEditor } from "@/features/selling/draft-editor";
import { emptyDraft } from "@/features/selling/draft-model";
import { getDatabase } from "@/server/db/database";
import { mediaConfigured } from "@/server/media/status.server";

export default async function NewListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  if (!backendConfigured()) return <BackendUnavailable />;
  const { sellerId } = await params;
  const { lang } = await searchParams;
  const language = await pageLocale(lang);
  const identity = await requirePageIdentity(
    `/app/sellers/${sellerId}/listings/new?lang=${language}`,
  );
  const seller = await readPrivatePage(() =>
    readSellerContext(getDatabase(), identity, sellerId, "listing.write"),
  );
  const key = recoveryKey(
    identity.subject,
    `${seller.kind === "personal" ? "personal" : sellerId}/new`,
  );
  return (
    <Workspace
      title={language === "bg" ? "Добави продукт" : "Add product"}
      back={`/app/sellers/${sellerId}/listings?lang=${language}`}
      language={language}
    >
      <DraftEditor
        admin
        key={key}
        initial={emptyDraft}
        sellerId={sellerId}
        requestId={randomUUID()}
        language={language}
        bufferKey={key}
        actorSubject={identity.subject}
        mediaAvailable={mediaConfigured()}
      />
    </Workspace>
  );
}
