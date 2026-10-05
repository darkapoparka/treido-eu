import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { MessagingSession } from "@/features/messaging/session";
import { parseMessagingContinuation } from "@/features/messaging/navigation-model";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { requirePageIdentity } from "@/features/sellers/page-context.server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { clerkLocalization } from "@/features/locale/clerk-localization.server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = {
  title: "Treido",
  robots: { index: false, follow: false },
};
export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!backendConfigured()) return children;
  const entry = new URL(
    (await headers()).get("x-treido-entry") ?? "/messages",
    "https://treido.invalid",
  );
  const params = new URLSearchParams();
  for (const key of entry.pathname === "/messages/report"
    ? ["lang", "kind", "id"]
    : entry.pathname === "/messages/new"
      ? ["lang", "listing"]
      : ["lang"])
    if (entry.searchParams.has(key))
      params.set(key, entry.searchParams.get(key)!);
  const target =
    parseMessagingContinuation(
      entry.pathname + (params.size ? "?" + params : ""),
    ) ?? "/messages";
  const actor = await requirePageIdentity(target);
  return (
    <ClerkProvider
      localization={await clerkLocalization(await pageLocale(undefined))}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <MessagingSession actorSubject={actor.subject}>
        {children}
      </MessagingSession>
    </ClerkProvider>
  );
}
