import type { Metadata } from "next";
import { pageLocale } from "@/features/locale/page-locale.server";
import { SellingForm } from "@/features/selling/selling-form";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkLocalization } from "@/features/locale/clerk-localization.server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import {
  requirePageIdentity,
  recoveryKey,
} from "@/features/sellers/page-context.server";
import { Workspace } from "@/features/sellers/workspace";
import { listOwnedSellers } from "@/features/sellers/persistence.server";
import { getDatabase } from "@/server/db/database";
import { DraftEditor } from "@/features/selling/draft-editor";
import { emptyDraft } from "@/features/selling/draft-model";

export const metadata: Metadata = {
  title: "Sell an item | Treido",
  description: "Prepare your item's category and details on Treido.",
  robots: { index: false, follow: false },
};

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{
    lang?: string | string[];
    intent?: string | string[];
  }>;
}) {
  const { lang, intent } = await searchParams;
  const language = await pageLocale(lang);
  if (backendConfigured()) {
    const identity = await requirePageIdentity(
      `/sell?${intent === "business" ? "intent=business&" : ""}lang=${language}`,
    );
    if (intent === "business") redirect(`/app/onboarding?lang=${language}`);
    const sellers = await listOwnedSellers(getDatabase(), identity);
    const personal = sellers.find((seller) => seller.kind === "personal");
    if (personal)
      redirect(
        `/app/sellers/${personal.sellerId}/listings/new?lang=${language}`,
      );
    const key = recoveryKey(identity.subject, "personal/new");
    return (
      <ClerkProvider
        localization={await clerkLocalization(language)}
        signInUrl={`/sign-in?lang=${language}`}
        signUpUrl={`/sign-up?lang=${language}`}
      >
        <Workspace
          title={language === "bg" ? "Продай артикул" : "Sell an item"}
          back="/"
          language={language}
        >
          <DraftEditor
            key={key}
            initial={emptyDraft}
            sellerId={null}
            requestId={randomUUID()}
            language={language}
            bufferKey={key}
            actorSubject={identity.subject}
          />
        </Workspace>
      </ClerkProvider>
    );
  }
  return <SellingForm initialLocale={language} />;
}
