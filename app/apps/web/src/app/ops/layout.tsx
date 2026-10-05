import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { requirePageIdentity } from "@/features/sellers/page-context.server";
import { parseWorkspaceContinuation } from "@/features/sellers/workspace-continuation";
import { pageLocale } from "@/features/locale/page-locale.server";
import { clerkLocalization } from "@/features/locale/clerk-localization.server";
import { libraryActorKey } from "@/features/library/cursor.server";
import { OperationsSession } from "@/features/trust/operations-session";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = {
  title: "Treido",
  robots: { index: false, follow: false },
};
export default async function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!backendConfigured()) return children;
  const language = await pageLocale(undefined);
  const entry = new URL(
    (await headers()).get("x-treido-entry") ?? "/ops",
    "https://treido.invalid",
  );
  const target =
    parseWorkspaceContinuation(entry.pathname + "?lang=" + language) ?? "/ops";
  const actor = await requirePageIdentity(target);
  return (
    <ClerkProvider
      localization={await clerkLocalization(language)}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <OperationsSession
        actorSubject={actor.subject}
        actorKey={libraryActorKey(actor)}
      >
        {children}
      </OperationsSession>
    </ClerkProvider>
  );
}
