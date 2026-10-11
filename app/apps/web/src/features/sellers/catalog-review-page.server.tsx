import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageLocale } from "../locale/page-locale.server";
import { getDatabase } from "../../server/db/database";
import { requirePageIdentity, readPrivatePage } from "./page-context.server";
import { parseCatalogSelection } from "./catalog-navigation";
import { readPublicationReview } from "../selling/publication.server";
import { PublicationReviewPanel } from "../selling/publication-review";
import { PaymentBoundary } from "../payments/controls";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";
import { randomUUID } from "node:crypto";

/** Selection is a review queue, not permission to copy attestations between products. */
export async function CatalogReviewPage({ params, searchParams }: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sellerId } = await params, query = await searchParams;
  const ids = parseCatalogSelection(query.ids);
  if (!ids) notFound();
  const language = await pageLocale(query.lang), bg = language === "bg";
  const search = new URLSearchParams({ lang: language, ids: ids.join(",") });
  const identity = await requirePageIdentity(`/app/sellers/${sellerId}/catalog/review?${search}`);
  const database = getDatabase();
  const reviews = await readPrivatePage(() => Promise.all(ids.map((id) => readPublicationReview(database, identity, sellerId, id))));
  return <main>
    <header className={admin.pageBar}><h1>{bg ? "Преглед на избраните продукти" : "Review selected products"}</h1><Link className={admin.secondary} href={`/app/sellers/${sellerId}/catalog?lang=${language}`}>{bg ? "Към каталога" : "Back to catalog"}</Link></header>
    <PaymentBoundary actorSubject={identity.subject} language={language}>
      <div className={admin.pageBody}><div className={styles.stack}>
        <section className={editor.panel}>
          <p>{bg ? "Прегледай запазените данни и снимки на всеки продукт. Потвържденията, начините за предаване и описаните недостатъци се задават отделно за всеки продукт." : "Review each product's saved details and photos. Confirmations, handover options, and disclosed defects are specified separately for each product."}</p>
          <nav className={styles.actions} aria-label={bg ? "Избрани продукти" : "Selected products"}>{reviews.map((review) => <a key={review.listingId} className={admin.secondary} href={`#review-${review.listingId}`}>{review.payload.title || (bg ? "Без заглавие" : "Untitled")}</a>)}</nav>
        </section>
        {reviews.map((review) => <section key={`${identity.subject}/${review.listingId}/${review.revision}/${review.publication}/${language}`} className={editor.panel} id={`review-${review.listingId}`} aria-labelledby={`review-title-${review.listingId}`}>
          <div className={styles.heading}><h2 id={`review-title-${review.listingId}`}>{review.payload.title || (bg ? "Продукт без заглавие" : "Untitled product")}</h2><Link className={admin.secondary} href={`/app/sellers/${sellerId}/listings/${review.listingId}/review?lang=${language}`}>{bg ? "Отвори продукта и наличностите" : "Open product and inventory"}</Link></div>
          <PublicationReviewPanel review={review} requestId={randomUUID()} language={language} />
        </section>)}
      </div></div>
    </PaymentBoundary>
  </main>;
}
