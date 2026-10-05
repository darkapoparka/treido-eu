import "server-only";
import { connection } from "next/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { BackendUnavailable, Workspace } from "../sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { PrivatePurchaseBoundary } from "../purchase-reviews/controls";
import { OperationsNav } from "../trust/operations-ui.server";
import { getDatabase } from "../../server/db/database";
import { readInsights } from "./queries.server";
import { InsightScreen } from "./view.server";
import { insightCopy, type InsightLanguage } from "./copy";
import {
  parseInsightQuery,
  insightParams,
  scopeBase,
  type InsightScope,
} from "./model";
import a from "../sellers/admin.module.css";
import s from "./insights.module.css";

type Search = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: Promise<Search> };
// Exports use the same current-authority query boundary, with a smaller cap.
const exportsReady = true;
function continuation(
  scope: InsightScope,
  raw: Search,
  language: InsightLanguage,
) {
  const base = scopeBase(scope);
  try {
    return (
      base +
      "?" +
      insightParams(parseInsightQuery(raw, scope, new Date()), language)
    );
  } catch {
    return base + "?lang=" + language;
  }
}
export async function SellerInsightsPage({
  params,
  searchParams,
}: PageProps & { params: Promise<{ sellerId: string }> }) {
  await connection();
  const { sellerId } = await params,
    raw = await searchParams,
    language = await pageLocale(
      typeof raw.lang === "string" ? raw.lang : undefined,
    );
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const scope: InsightScope = { kind: "seller", sellerId },
    identity = await requirePageIdentity(continuation(scope, raw, language));
  const view = await readPrivatePage(() =>
    readInsights(getDatabase(), identity, scope, raw),
  );
  return (
    <main className={s.merchant}>
      <header className={a.pageBar}>
        <h1>{insightCopy(language).ui.title}</h1>
      </header>
      <div className={a.pageBody}>
        <PrivatePurchaseBoundary
          key={identity.subject + sellerId}
          actorSubject={identity.subject}
        >
          <InsightScreen
            view={view}
            language={language}
            actorSubject={identity.subject}
            exportsReady={exportsReady}
          />
        </PrivatePurchaseBoundary>
      </div>
    </main>
  );
}
export async function OperatorInsightsPage({ searchParams }: PageProps) {
  await connection();
  const raw = await searchParams,
    language = await pageLocale(
      typeof raw.lang === "string" ? raw.lang : undefined,
    );
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const scope: InsightScope = { kind: "operator" },
    identity = await requirePageIdentity(continuation(scope, raw, language));
  const view = await readPrivatePage(() =>
    readInsights(getDatabase(), identity, scope, raw),
  );
  return (
    <Workspace
      title={insightCopy(language).ui.operatorTitle}
      language={language}
      back="/ops"
    >
      <PrivatePurchaseBoundary
        key={identity.subject + ":operator-insights"}
        actorSubject={identity.subject}
      >
        <div className={s.stack}>
          <OperationsNav language={language} active="insights" />
          <InsightScreen
            view={view}
            language={language}
            actorSubject={identity.subject}
            exportsReady={exportsReady}
          />
        </div>
      </PrivatePurchaseBoundary>
    </Workspace>
  );
}
