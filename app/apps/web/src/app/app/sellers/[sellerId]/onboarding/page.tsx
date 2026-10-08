import { pageLocale } from "@/features/locale/page-locale.server";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { BackendUnavailable, Workspace } from "@/features/sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "@/features/sellers/page-context.server";
import {
  readSellerReadiness,
  readSellerSetupReview,
} from "@/features/sellers/setup.server";
import { parseSetupStep } from "@/features/sellers/setup-model";
import { BusinessSetupForm } from "@/features/sellers/setup-form";
import { OwnDeclarationDecisionNotice } from "@/features/seller-declarations/own-decision";
import {
  SetupChecklist,
  OperationReadiness,
  declarationLabel,
} from "@/features/sellers/setup-checklist";
import { getDatabase } from "@/server/db/database";
import styles from "@/features/sellers/workspace.module.css";

export default async function ResumeBusinessSetup({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ step?: string; lang?: string }>;
}) {
  if (!backendConfigured()) return <BackendUnavailable />;
  const { sellerId } = await params;
  const { lang, step: requestedStep } = await searchParams;
  const language = await pageLocale(lang);
  const bg = language === "bg";
  const requested = parseSetupStep(requestedStep);
  const identity = await requirePageIdentity(
    `/app/sellers/${sellerId}/onboarding?${requested ? `step=${requested}&` : ""}lang=${language}`,
  );
  const database = getDatabase();
  const setup = await readPrivatePage(() =>
    readSellerSetupReview(database, identity, sellerId),
  );
  const step = requested ?? setup.lastStep;
  const titles = {
    details: bg ? "Данни за бизнеса" : "Business details",
    declaration: bg ? "Данни за търговец" : "Trader declaration",
    review: bg ? "Преглед на настройките" : "Review setup",
  };
  const base = `/app/sellers/${sellerId}`;
  return (
    <Workspace
      title={titles[step]}
      back={`${base}?lang=${language}`}
      language={language}
    >
      <nav
        className={styles.tabs}
        aria-label={bg ? "Стъпки за настройване" : "Setup steps"}
      >
        {(["details", "declaration", "review"] as const).map((item) => (
          <Link
            key={item}
            className={styles.link}
            aria-current={step === item ? "step" : undefined}
            href={`${base}/onboarding?step=${item}&lang=${language}`}
          >
            {titles[item]}
          </Link>
        ))}
      </nav>
      {step === "review" ? (
        <>
          <p className={styles.status}>
            {declarationLabel(setup.declarationStatus, bg)}
          </p>
          <OwnDeclarationDecisionNotice
            decision={setup.declarationDecision}
            language={language}
          />
          <SetupChecklist setup={setup} language={language} />
          <OperationReadiness
            readiness={await readPrivatePage(() =>
              readSellerReadiness(database, identity, sellerId),
            )}
            language={language}
          />
        </>
      ) : (
        <BusinessSetupForm
          key={`${sellerId}/${step}`}
          initial={setup}
          section={step}
          requestId={randomUUID()}
          actorSubject={identity.subject}
          language={language}
        />
      )}
      <div className={styles.actions}>
        {setup.canCreateDraft && (
          <Link
            className={styles.link}
            href={`${base}/listings/new?lang=${language}`}
          >
            {bg ? "Продължи с артикул" : "Continue with an item"}
          </Link>
        )}
        <Link className={styles.link} href={`${base}?lang=${language}`}>
          {bg ? "Запазените настройки и чернови" : "Saved setup and drafts"}
        </Link>
      </div>
    </Workspace>
  );
}
