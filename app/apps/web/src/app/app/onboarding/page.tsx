import { pageLocale } from "@/features/locale/page-locale.server";
import { randomUUID } from "node:crypto";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable, Workspace } from "@/features/sellers/workspace";
import { requirePageIdentity } from "@/features/sellers/page-context.server";
import { BusinessOnboardingForm } from "@/features/sellers/onboarding-form";
import Link from "next/link";
import { listOwnedSellers } from "@/features/sellers/persistence.server";
import { readPrivatePage } from "@/features/sellers/page-context.server";
import { getDatabase } from "@/server/db/database";
import styles from "@/features/sellers/workspace.module.css";

export default async function BusinessSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  if (!backendConfigured()) return <BackendUnavailable />;
  const { lang } = await searchParams;
  const language = await pageLocale(lang);
  const identity = await requirePageIdentity(
    `/app/onboarding?lang=${language}`,
  );
  const businesses = (
    await readPrivatePage(() => listOwnedSellers(getDatabase(), identity))
  ).filter((seller) => seller.kind === "business");
  return (
    <Workspace
      title={language === "bg" ? "Добави бизнес" : "Add a business"}
      language={language}
    >
      {businesses.length > 0 && (
        <section className="account-panel">
          <h2>
            {language === "bg"
              ? "Продължи с наличен бизнес"
              : "Continue with an existing business"}
          </h2>
          {businesses.map((seller) => (
            <div key={seller.sellerId} className={styles.row}>
              <strong>{seller.name}</strong>
              <Link
                className={styles.link}
                href={`/app/sellers/${seller.sellerId}/onboarding?lang=${language}`}
              >
                {language === "bg" ? "Продължи" : "Resume"}
              </Link>
            </div>
          ))}
        </section>
      )}
      <BusinessOnboardingForm
        requestId={randomUUID()}
        language={language}
        actorSubject={identity.subject}
      />
    </Workspace>
  );
}
