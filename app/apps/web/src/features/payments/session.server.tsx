import "server-only";
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { backendConfigured } from "../sellers/backend-status.server";
import { pageLocale } from "../locale/page-locale.server";
import { clerkLocalization } from "../locale/clerk-localization.server";
export async function PaymentSessionLayout({
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
