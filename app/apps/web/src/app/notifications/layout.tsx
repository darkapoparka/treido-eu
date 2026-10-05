import { ClerkProvider } from "@clerk/nextjs";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { pageLocale } from "@/features/locale/page-locale.server";
import { clerkLocalization } from "@/features/locale/clerk-localization.server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = {
  title: "Treido",
  robots: { index: false, follow: false },
};
export default async function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!backendConfigured() || referencePreviewEnabled()) return children;
  return (
    <ClerkProvider
      localization={await clerkLocalization(await pageLocale(undefined))}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      {children}
    </ClerkProvider>
  );
}
