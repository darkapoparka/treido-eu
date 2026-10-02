import { ClerkProvider } from "@clerk/nextjs";
import { clerkLocalization } from "@/features/locale/clerk-localization.server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { AdminShell } from "@/features/sellers/admin-shell";
import { listOwnedSellers } from "@/features/sellers/persistence.server";
import { readPrivatePage } from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import { parseSellContinuation } from "@/features/sellers/sell-entry";
import { readVerifiedIdentity } from "@/server/identity/clerk.server";
import { parseWorkspaceContinuation } from "@/features/sellers/workspace-continuation";
import { WorkspaceSession } from "@/features/sellers/workspace-session";

export const metadata: Metadata = {
  title: "Treido admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!backendConfigured())
    return (
      <AdminShell sellers={[]} unavailable>
        {children}
      </AdminShell>
    );
  const identity = await readVerifiedIdentity();
  if (!identity) {
    const path = (await headers()).get("x-treido-entry") ?? "/app";
    const continuation = parseSellContinuation(path);
    redirect(
      `/sign-in?returnTo=${encodeURIComponent(continuation.ok ? continuation.continuation.target : (parseWorkspaceContinuation(path) ?? "/app"))}`,
    );
  }
  const sellers = await readPrivatePage(() =>
    listOwnedSellers(getDatabase(), identity),
  );
  return (
    <ClerkProvider
      localization={await clerkLocalization(await pageLocale(undefined))}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <WorkspaceSession actorSubject={identity.subject}>
        <AdminShell
          sellers={sellers.map(({ sellerId, name, kind, capabilities }) => ({
            sellerId,
            name,
            kind,
            capabilities,
          }))}
        >
          {children}
        </AdminShell>
      </WorkspaceSession>
    </ClerkProvider>
  );
}
