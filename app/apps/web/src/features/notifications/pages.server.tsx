import { readDecisionUpdates } from "../trust/decision-updates.server";
import { DecisionUpdatesPanel } from "../trust/decision-updates-panel";
import "server-only";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "../locale/page-locale.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { Notifications } from "../discovery/notifications";
import { ShopSurface } from "../discovery/hydration-boundary";
import { FloatingNav } from "../discovery/components";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { getDatabase } from "../../server/db/database";
import { readNotificationFeed } from "./queries.server";
import { NotificationPanel } from "./panel";
import { notificationsHref, parseNotificationQuery } from "./model";
import s from "../purchase-reviews/reviews.module.css";
import a from "../sellers/admin.module.css";
import n from "./notifications.module.css";
type Query = {
  lang?: string;
  filter?: string;
  kind?: string;
  q?: string;
  before?: string;
};
async function content(
  sellerId: string | null,
  query: Query,
  language: "bg" | "en",
) {
  const t = await getTranslations({
    locale: language,
    namespace: "notifications",
  });
  if (!backendConfigured()) return <p role="status">{t("unavailable")}</p>;
  const normalized = await readPrivatePage(async () =>
    parseNotificationQuery({
      sellerId,
      filter: query.filter,
      kind: query.kind,
      q: query.q,
      before: query.before,
    }),
  );
  const actor = await requirePageIdentity(
    notificationsHref(sellerId, language, normalized),
  );
  const initial = await readPrivatePage(() =>
    readNotificationFeed(getDatabase(), actor, normalized),
  );
  const decisions = await readPrivatePage(() =>
    readDecisionUpdates(getDatabase(), actor, sellerId),
  );
  return (
    <>
      <NotificationPanel
        key={
          initial.actorKey +
          ":" +
          sellerId +
          ":" +
          JSON.stringify(initial.query)
        }
        initial={initial}
        actorSubject={actor.subject}
      />
      <DecisionUpdatesPanel
        key={decisions.actorKey + ":decisions:" + sellerId}
        initial={decisions}
        actorSubject={actor.subject}
      />
    </>
  );
}
export async function BuyerNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  await connection();
  if (referencePreviewEnabled()) return <Notifications />;
  const query = await searchParams,
    language = await pageLocale(query.lang),
    t = await getTranslations({ locale: language, namespace: "notifications" });
  return (
    <ShopSurface className={"shop-page " + n.page}>
      <h1>{t("title")}</h1>
      {await content(null, query, language)}
      <FloatingNav back marketplace />
    </ShopSurface>
  );
}
export async function SellerNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<Query>;
}) {
  await connection();
  const { sellerId } = await params,
    query = await searchParams,
    language = await pageLocale(query.lang),
    t = await getTranslations({ locale: language, namespace: "notifications" });
  return (
    <main className={s.merchant}>
      <header className={a.pageBar}>
        <h1>{t("title")}</h1>
      </header>
      <div className={a.pageBody}>
        {await content(sellerId, query, language)}
      </div>
    </main>
  );
}
