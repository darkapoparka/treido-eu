import "server-only";
import { createHash } from "node:crypto";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { BackendUnavailable } from "../sellers/workspace";
import { requirePageIdentity } from "../sellers/page-context.server";
import { SellerError } from "../sellers/errors";
import { getDatabase } from "../../server/db/database";
import { readVerifiedRecipient } from "./recipient.server";
import { readIncomingInvitations } from "./persistence.server";
import { Invitations } from "./invitations";
import type { IncomingInvitation } from "./model";
export async function InvitationPage({
  searchParams,
  selectedId,
}: {
  searchParams: Promise<{ lang?: string }>;
  selectedId?: string;
}) {
  const language = await pageLocale((await searchParams).lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const actor = await requirePageIdentity(
    "/app/invitations" +
      (selectedId ? "/" + selectedId : "") +
      "?lang=" +
      language,
  );
  let initial: IncomingInvitation[] = [];
  let initialError: string | null = null;
  try {
    const recipient = await readVerifiedRecipient(actor);
    if (recipient.verifiedEmails.length)
      initial = await readIncomingInvitations(getDatabase(), recipient);
  } catch (error) {
    initialError = error instanceof SellerError ? error.code : "NOT_AVAILABLE";
  }
  // This island keeps local items. A changed current recipient projection must
  // replace that state and retire callbacks belonging to the former projection.
  const projection = createHash("sha256")
    .update(JSON.stringify({ initial, initialError }))
    .digest("hex");
  return (
    <Invitations
      key={actor.subject + "/" + (selectedId ?? "all") + "/" + projection}
      initial={initial}
      actorSubject={actor.subject}
      language={language}
      selectedId={selectedId}
      initialError={initialError}
    />
  );
}
