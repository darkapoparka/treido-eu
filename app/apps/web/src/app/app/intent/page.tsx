import { pageLocale } from "@/features/locale/page-locale.server";
import { randomUUID } from "node:crypto";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable, Workspace } from "@/features/sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import { SignupIntentForm } from "@/features/sellers/intent-form";
import { readSignupIntent } from "@/features/sellers/setup.server";
import { getDatabase } from "@/server/db/database";

export default async function SignupIntentPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  if (!backendConfigured()) return <BackendUnavailable />;
  const { lang } = await searchParams;
  const language = await pageLocale(lang);
  const identity = await requirePageIdentity(`/app/intent?lang=${language}`);
  const initial = await readPrivatePage(() =>
    readSignupIntent(getDatabase(), identity),
  );
  return (
    <Workspace
      title={language === "bg" ? "Добре дошли в Treido" : "Welcome to Treido"}
      language={language}
    >
      <SignupIntentForm
        initial={initial}
        requestId={randomUUID()}
        language={language}
        actorSubject={identity.subject}
      />
    </Workspace>
  );
}
