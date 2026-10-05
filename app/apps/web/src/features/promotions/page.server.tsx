import "server-only";
import { connection } from "next/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { getDatabase } from "../../server/db/database";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { readPromotions } from "./queries.server";
import { PromotionManager } from "./manager";
import { promotionCopy } from "./copy";
import a from "../sellers/admin.module.css";
export async function PromotionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { sellerId } = await params,
    input = await searchParams,
    language = await pageLocale(input.lang),
    c = promotionCopy(language);
  if (referencePreviewEnabled() || !backendConfigured())
    return (
      <main lang={language}>
        <header className={a.pageBar}>
          <h1>{c.ui.title}</h1>
        </header>
        <div className={a.pageBody}>
          <p role="status">{c.ui.failed}</p>
        </div>
      </main>
    );
  const identity = await requirePageIdentity(
    `/app/sellers/${sellerId}/promotions?lang=${language}`,
  );
  const view = await readPrivatePage(() =>
    readPromotions(getDatabase(), identity, sellerId),
  );
  return (
    <PromotionManager
      key={identity.subject + sellerId}
      initial={view}
      subject={identity.subject}
      language={language}
    />
  );
}
