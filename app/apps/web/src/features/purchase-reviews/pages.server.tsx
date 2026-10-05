import "server-only";
import Link from "next/link";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { pageLocale } from "../locale/page-locale.server";
import { ShopSurface } from "../discovery/hydration-boundary";
import { FloatingNav } from "../discovery/components";
import { backendConfigured } from "../sellers/backend-status.server";
import { BackendUnavailable } from "../sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { readSellerContext } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { getDatabase } from "../../server/db/database";
import { PrivatePurchaseBoundary } from "./controls";
import { PurchaseReviewDetail } from "./detail";
import { ReservationsPanel } from "./reservations";
import { readPurchaseReview, readPurchaseReviews } from "./persistence.server";
import { readReservationQueue } from "./reservations.server";
import { readReviewRenewalContext } from "./renewal.server";
import s from "./reviews.module.css";
import a from "../sellers/admin.module.css";
type Query = {
  lang?: string;
  archived?: string;
  before?: string;
  view?: string;
  q?: string;
};
export type BuyerReviewPageProps = { searchParams: Promise<Query> };
async function BuyerShell({
  language,
  title,
  children,
}: {
  language: "bg" | "en";
  title: "title" | "detail" | "reservations";
  children: ReactNode;
}) {
  const t = await getTranslations({
    locale: language,
    namespace: "purchaseReviews",
  });
  return (
    <ShopSurface className={"shop-page " + s.page}>
      <header className={s.header}>
        <h1>{t(title)}</h1>
        <nav className={s.actions} aria-label={t("title")}>
          <Link
            className={s.secondary}
            href={"/checkout/reviews?lang=" + language}
          >
            {t("title")}
          </Link>
          <Link className={s.secondary} href={"/reservations?lang=" + language}>
            {t("reservations")}
          </Link>
          <Link className={s.secondary} href={"/cart?lang=" + language}>
            {t("cart")}
          </Link>
        </nav>
      </header>
      {children}
      <FloatingNav back marketplace />
    </ShopSurface>
  );
}
export async function PurchaseReviewsPage(props: BuyerReviewPageProps) {
  await connection();
  const query = await props.searchParams,
    language = await pageLocale(query.lang),
    t = await getTranslations({
      locale: language,
      namespace: "purchaseReviews",
    }),
    format = await getFormatter({ locale: language });
  if (!backendConfigured())
    return (
      <BuyerShell language={language} title="title">
        <p>{t("unavailable")}</p>
      </BuyerShell>
    );
  const identity = await requirePageIdentity(
      "/checkout/reviews?lang=" + language,
    ),
    data = await readPrivatePage(() =>
      readPurchaseReviews(getDatabase(), identity, {
        archived: query.archived === "1",
        before: query.before,
      }),
    );
  return (
    <BuyerShell language={language} title="title">
      <PrivatePurchaseBoundary actorSubject={identity.subject}>
        <nav className={s.actions} aria-label={t("history")}>
          <Link
            className={s.secondary}
            href={"/checkout/reviews?lang=" + language}
            aria-current={query.archived !== "1" ? "page" : undefined}
          >
            {t("active")}
          </Link>
          <Link
            className={s.secondary}
            href={"/checkout/reviews?archived=1&lang=" + language}
            aria-current={query.archived === "1" ? "page" : undefined}
          >
            {t("archived")}
          </Link>
        </nav>
        <p className={s.muted}>{t("contactOnly")}</p>
        {!data.items.length ? (
          <section className={s.card}>
            <h2>{t("empty")}</h2>
            <p>{t("emptyNote")}</p>
            <Link className={s.primary} href={"/search?lang=" + language}>
              {t("browse")}
            </Link>
          </section>
        ) : (
          <div className={s.list}>
            {data.items.map((item) => (
              <Link
                key={item.id}
                className={s.card}
                href={"/checkout/reviews/" + item.id + "?lang=" + language}
              >
                <div className={s.row}>
                  <h2>{item.sellerName}</h2>
                  <strong>
                    {format.number(item.merchandiseMinor / 100, {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </strong>
                </div>
                <p>
                  {t("lines", { count: item.lineCount })} · {t(item.source)}{" "}
                  {item.expired ? "· " + t("expired") : ""}
                </p>
                <small>
                  {t("reviewedAt", {
                    time: format.dateTime(new Date(item.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </small>
              </Link>
            ))}
          </div>
        )}
        {data.nextBefore && (
          <Link
            className={s.secondary}
            href={
              "/checkout/reviews?" +
              new URLSearchParams({
                lang: language,
                before: data.nextBefore,
                ...(query.archived === "1" ? { archived: "1" } : {}),
              })
            }
          >
            {t("older")}
          </Link>
        )}
      </PrivatePurchaseBoundary>
    </BuyerShell>
  );
}
export async function PurchaseReviewPage(
  props: BuyerReviewPageProps & { params: Promise<{ reviewId: string }> },
) {
  await connection();
  const query = await props.searchParams,
    { reviewId } = await props.params,
    language = await pageLocale(query.lang),
    t = await getTranslations({
      locale: language,
      namespace: "purchaseReviews",
    });
  if (!backendConfigured())
    return (
      <BuyerShell language={language} title="detail">
        <p>{t("unavailable")}</p>
      </BuyerShell>
    );
  const identity = await requirePageIdentity(
      "/checkout/reviews/" + reviewId + "?lang=" + language,
    ),
    initial = await readPrivatePage(() =>
      readPurchaseReview(getDatabase(), identity, reviewId),
    ),
    renewal = await readPrivatePage(() =>
      readReviewRenewalContext(getDatabase(), identity, reviewId),
    );
  return (
    <BuyerShell language={language} title="detail">
      <PrivatePurchaseBoundary actorSubject={identity.subject}>
        <PurchaseReviewDetail
          key={identity.subject + reviewId}
          actorSubject={identity.subject}
          actorKey={libraryActorKey(identity)}
          initial={initial}
          renewal={renewal}
        />
      </PrivatePurchaseBoundary>
    </BuyerShell>
  );
}
export async function BuyerReservationsPage(props: BuyerReviewPageProps) {
  await connection();
  const query = await props.searchParams,
    language = await pageLocale(query.lang),
    t = await getTranslations({
      locale: language,
      namespace: "purchaseReviews",
    });
  if (!backendConfigured())
    return (
      <BuyerShell language={language} title="reservations">
        <p>{t("unavailable")}</p>
      </BuyerShell>
    );
  const identity = await requirePageIdentity("/reservations?lang=" + language),
    view = query.view === "history" ? "history" : "active",
    data = await readPrivatePage(() =>
      readReservationQueue(getDatabase(), identity, {
        sellerId: null,
        view,
        before: query.before,
        q: query.q,
      }),
    );
  return (
    <BuyerShell language={language} title="reservations">
      <PrivatePurchaseBoundary actorSubject={identity.subject}>
        <ReservationsPanel
          key={identity.subject}
          data={data}
          actorSubject={identity.subject}
          view={view}
          q={query.q ?? ""}
        />
      </PrivatePurchaseBoundary>
    </BuyerShell>
  );
}
export async function SellerReservationsPage(
  props: BuyerReviewPageProps & { params: Promise<{ sellerId: string }> },
) {
  await connection();
  const query = await props.searchParams,
    { sellerId } = await props.params,
    language = await pageLocale(query.lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const identity = await requirePageIdentity(
      "/app/sellers/" + sellerId + "/reservations?lang=" + language,
    ),
    view = query.view === "history" ? "history" : "active",
    data = await readPrivatePage(() =>
      readReservationQueue(getDatabase(), identity, {
        sellerId,
        view,
        before: query.before,
        q: query.q,
      }),
    ),
    t = await getTranslations({
      locale: language,
      namespace: "purchaseReviews",
    });
  return (
    <main className={s.merchant}>
      <header className={a.pageBar}>
        <h1>{t("reservations")}</h1>
      </header>
      <div className={a.pageBody}>
        <PrivatePurchaseBoundary actorSubject={identity.subject}>
          <ReservationsPanel
            key={identity.subject + sellerId}
            data={data}
            actorSubject={identity.subject}
            view={view}
            q={query.q ?? ""}
          />
        </PrivatePurchaseBoundary>
      </div>
    </main>
  );
}
export async function SellerPaymentsPage(
  props: BuyerReviewPageProps & { params: Promise<{ sellerId: string }> },
) {
  await connection();
  const query = await props.searchParams,
    { sellerId } = await props.params,
    language = await pageLocale(query.lang);
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const identity = await requirePageIdentity(
      "/app/sellers/" + sellerId + "/settings/payments?lang=" + language,
    ),
    seller = await readPrivatePage(() =>
      readSellerContext(getDatabase(), identity, sellerId, "billing.manage"),
    ),
    t = await getTranslations({
      locale: language,
      namespace: "purchaseReviews",
    }),
    base = "/app/sellers/" + sellerId;
  return (
    <main className={s.merchant}>
      <header className={a.pageBar}>
        <h1>{t("payments")}</h1>
      </header>
      <div className={a.pageBody}>
        <PrivatePurchaseBoundary actorSubject={identity.subject}>
          <div className={s.stack}>
            <section className={s.card}>
              <div className={s.row}>
                <h2>{seller.name}</h2>
                <span className={s.badge}>{t("blocked")}</span>
              </div>
              <p>{t("providerBlock")}</p>
              <p>{t("publicationBlock")}</p>
              <p>{t("authenticationBlock")}</p>
              <div className={s.actions}>
                <button className={s.primary} disabled>
                  {t("onboard")}
                </button>
                <button className={s.secondary} disabled>
                  {t("refreshProvider")}
                </button>
              </div>
              <p className={s.muted}>{t("noReturnSuccess")}</p>
            </section>
            <section className={s.card}>
              <h2>{t("merchant")}</h2>
              <div className={s.actions}>
                {seller.capabilities.includes("inbox.read") &&
                  seller.capabilities.includes("listing.read") && (
                    <Link
                      className={s.secondary}
                      href={base + "/reservations?lang=" + language}
                    >
                      {t("reservations")}
                    </Link>
                  )}
                {seller.capabilities.includes("delivery.manage") && (
                  <Link
                    className={s.secondary}
                    href={base + "/settings/delivery?lang=" + language}
                  >
                    {t("deliverySettings")}
                  </Link>
                )}
                {seller.capabilities.includes("inbox.read") && (
                  <Link
                    className={s.secondary}
                    href={base + "/inbox?lang=" + language}
                  >
                    {t("openInbox")}
                  </Link>
                )}
              </div>
            </section>
          </div>
        </PrivatePurchaseBoundary>
      </div>
    </main>
  );
}
