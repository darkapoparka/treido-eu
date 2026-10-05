import "server-only";
import Link from "next/link";
import { OperationsRefresh } from "./operations-feedback";
import { connection } from "next/server";
import { getTranslations, getFormatter } from "next-intl/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { BackendUnavailable } from "../sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { getDatabase } from "../../server/db/database";
import { PrivatePurchaseBoundary } from "../purchase-reviews/controls";
import { readSellerModerationQueue } from "./seller-moderation.server";
import a from "../sellers/admin.module.css";
import r from "../purchase-reviews/reviews.module.css";
import s from "./operations.module.css";
export async function SellerModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{
    lang?: string;
    state?: string;
    q?: string;
    before?: string;
  }>;
}) {
  await connection();
  const { sellerId } = await params,
    raw = await searchParams,
    language = await pageLocale(raw.lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const base = "/app/sellers/" + sellerId + "/moderation";
  const actor = await requirePageIdentity(base + "?lang=" + language);
  const data = await readPrivatePage(() =>
    readSellerModerationQueue(getDatabase(), actor, {
      sellerId,
      state: raw.state,
      q: raw.q,
      before: raw.before,
    }),
  );
  const t = await getTranslations({
      locale: language,
      namespace: "trustOperations",
    }),
    format = await getFormatter({ locale: language });
  const url = (before: string | null) =>
    base +
    "?" +
    new URLSearchParams({
      lang: language,
      state: data.query.state,
      ...(data.query.q ? { q: data.query.q } : {}),
      ...(before ? { before } : {}),
    });
  return (
    <main className={r.merchant + " " + s.merchant}>
      <header className={a.pageBar}>
        <h1>{t("sellerModeration")}</h1>
      </header>
      <div className={a.pageBody}>
        <PrivatePurchaseBoundary actorSubject={actor.subject}>
          <div className={s.stack}>
            <p>{t("sellerNote")}</p>
            <OperationsRefresh className={r.secondary} />
            <div className={s.actions}>
              <span className={s.badge}>
                {t("restrictedCount", { count: data.counts.restricted })}
              </span>
              <span className={s.badge}>
                {t("removedCount", { count: data.counts.removed })}
              </span>
            </div>
            <form action={base} className={s.toolbar}>
              <label>
                {t("search")}
                <input
                  type="search"
                  name="q"
                  maxLength={80}
                  defaultValue={data.query.q}
                  placeholder={t("sellerSearch")}
                />
              </label>
              <label>
                {t("state")}
                <select name="state" defaultValue={data.query.state}>
                  {(["all", "restricted", "removed", "clear"] as const).map(
                    (value) => (
                      <option key={value} value={value}>
                        {t(value)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <input type="hidden" name="lang" value={language} />
              <button className={r.secondary}>{t("search")}</button>
            </form>
            {!data.items.length && <p className={s.card}>{t("emptySeller")}</p>}
            <ul className={s.list}>
              {data.items.map((item) => (
                <li key={item.actionId} className={s.card}>
                  <div className={s.row}>
                    <h2>{item.title ?? t("missingTitle")}</h2>
                    <span className={s.badge}>{t(item.state)}</span>
                  </div>
                  <p className={s.text}>{item.reason}</p>
                  <p className={s.muted}>
                    {format.dateTime(new Date(item.at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {t("revision", { revision: item.revision })}
                  </p>
                  {item.ownAppeals > 0 && (
                    <p>{t("yourAppeals", { count: item.ownAppeals })}</p>
                  )}
                  <Link
                    className={r.secondary}
                    href={
                      "/app/sellers/" +
                      sellerId +
                      "/listings/" +
                      item.id +
                      "/moderation?lang=" +
                      language
                    }
                  >
                    {t("openHistory")}
                  </Link>
                </li>
              ))}
            </ul>
            <div className={s.actions}>
              {data.query.before && (
                <Link className={r.secondary} href={url(null)}>
                  {t("newest")}
                </Link>
              )}
              {data.nextBefore && (
                <Link className={r.secondary} href={url(data.nextBefore)}>
                  {t("older")}
                </Link>
              )}
            </div>
          </div>
        </PrivatePurchaseBoundary>
      </div>
    </main>
  );
}
