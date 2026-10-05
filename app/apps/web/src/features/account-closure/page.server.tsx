import "server-only";
import { connection } from "next/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { AccountSettingsManager, AccountSettingsUnavailable } from "./manager";
import type { SettingsMode } from "./actions";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function SettingsPage({ searchParams }: Props, mode: SettingsMode) {
  await connection();
  const params = await searchParams,
    locale = (await pageLocale(params.lang)) === "en" ? "en" : "bg";
  const invalid =
    Object.keys(params).some((key) => key !== "lang") ||
    (params.lang !== undefined && params.lang !== "bg" && params.lang !== "en");
  if (invalid || referencePreviewEnabled() || !backendConfigured())
    return <AccountSettingsUnavailable mode={mode} locale={locale} />;
  return <AccountSettingsManager mode={mode} locale={locale} />;
}
export function ClosurePage(props: Props) {
  return SettingsPage(props, "closure");
}
export function AccountPreferencesPage(props: Props) {
  return SettingsPage(props, "preferences");
}
export function AccountSecurityPage(props: Props) {
  return SettingsPage(props, "security");
}
