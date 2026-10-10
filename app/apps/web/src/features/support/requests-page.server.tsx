import "server-only";
import { connection } from "next/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { ShopSurface } from "../discovery/hydration-boundary";
import { SupportScreen } from "./screen";
import { supportCopy } from "./copy";
import s from "./support.module.css";
export async function SupportRequestsPage({searchParams, params, operator = false}: {
  searchParams: Promise<{lang?: string; before?: string; beforeSequence?: string; state?: string}>;
  params?: Promise<{ticketId: string}>;
  operator?: boolean;
}) {
  await connection();
  const query = await searchParams, language = await pageLocale(query.lang), ticketId = params ? (await params).ticketId : null;
  if (!backendConfigured()) return <ShopSurface className={s.page}><h1>{supportCopy[language].title}</h1><p role="status">{supportCopy[language].unavailable}</p></ShopSurface>;
  return <ShopSurface className="account-page"><SupportScreen language={language} operator={operator} ticketId={ticketId} before={query.before ?? null} beforeSequence={query.beforeSequence ? Number(query.beforeSequence) : null} state={query.state ?? "all"}/></ShopSurface>;
}
