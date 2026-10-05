import "server-only";
import { connection } from "next/server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { pageLocale } from "../locale/page-locale.server";
import { PrivacyManager, PrivacyUnavailable } from "./manager";
export async function PrivacyDataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams,
    locale = await pageLocale(params.lang);
  const invalid =
    Object.keys(params).some((key) => key !== "lang") ||
    (params.lang !== undefined && params.lang !== "bg" && params.lang !== "en");
  if (invalid || referencePreviewEnabled() || !backendConfigured())
    return (
      <PrivacyUnavailable
        locale={locale === "en" ? "en" : "bg"}
        invalid={invalid}
      />
    );
  return <PrivacyManager />;
}
