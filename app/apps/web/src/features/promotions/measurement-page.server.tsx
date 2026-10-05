import "server-only";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { pageLocale } from "../locale/page-locale.server";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { getDatabase } from "../../server/db/database";
import { readPrivatePage } from "../sellers/page-context.server";
import { readPromotionMeasurementChoice } from "./measurement-policy.server";
import { MeasurementControls } from "./measurement-controls";
import { AccountPage } from "../account/forms";
export async function PromotionMeasurementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const raw = await searchParams,
    language = await pageLocale(raw.lang);
  if (
    Object.keys(raw).some((key) => key !== "lang") ||
    (raw.lang !== undefined && raw.lang !== "bg" && raw.lang !== "en") ||
    !backendConfigured() ||
    referencePreviewEnabled()
  )
    return (
      <AccountPage
        title={
          language === "bg"
            ? "Поверителност при промотиране"
            : "Promotion measurement privacy"
        }
        dock={false}
      >
        <p role="status">
          {language === "bg"
            ? "Настройките не са достъпни."
            : "Settings are unavailable."}
        </p>
      </AccountPage>
    );
  const identity = await readVerifiedIdentity();
  if (!identity)
    redirect(
      `/sign-in?returnTo=${encodeURIComponent(`/account/privacy/promotions?lang=${language}`)}&lang=${language}`,
    );
  const view = await readPrivatePage(() =>
    readPromotionMeasurementChoice(getDatabase(), identity),
  );
  return (
    <MeasurementControls
      key={identity.subject}
      initial={view}
      subject={identity.subject}
      language={language}
    />
  );
}
