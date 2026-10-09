import "server-only";
import { ClerkProvider } from "@clerk/nextjs";
import { connection } from "next/server";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { pageLocale } from "../locale/page-locale.server";
import { clerkLocalization } from "../locale/clerk-localization.server";
import { NotificationPreferencesPanel } from "./preferences-panel";

export async function NotificationPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  await connection();
  const language = await pageLocale((await searchParams).lang);
  if (referencePreviewEnabled() || !backendConfigured())
    return (
      <NotificationPreferencesPanel language={language} state="unavailable" />
    );
  let subject: string | undefined;
  try {
    subject = (await readVerifiedIdentity())?.subject;
  } catch {
    return (
      <NotificationPreferencesPanel language={language} state="unavailable" />
    );
  }
  return (
    <ClerkProvider
      localization={await clerkLocalization(language)}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <NotificationPreferencesPanel
        language={language}
        state={subject ? "ready" : "signed-out"}
        actorSubject={subject}
      />
    </ClerkProvider>
  );
}
