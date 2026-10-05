import "server-only";
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { backendConfigured } from "../sellers/backend-status.server";
import { pageLocale } from "../locale/page-locale.server";
import { clerkLocalization } from "../locale/clerk-localization.server";
/** Contact-only routes supply the provider their existing interaction islands need.
 * Pages and commands still authenticate and authorize independently. This does
 * not wrap the payment checkout route or establish recent authentication. */
export async function ContactReviewSessionLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!backendConfigured()) return children;
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
