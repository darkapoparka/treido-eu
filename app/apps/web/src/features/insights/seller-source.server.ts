import "server-only";
import type { SellerCapability } from "../sellers/capabilities";
import { reservedSql } from "../inventory/queries.server";
import { inRange, emptyValues, type InsightSource } from "./sql.server";
import type { SellerDataset } from "./model";

export const sellerInsightCapability: Readonly<
  Record<SellerDataset, SellerCapability>
> = {
  publications: "listing.read",
  listing_status: "listing.read",
  stock: "listing.read",
  offers: "inbox.read",
  conversations: "inbox.read",
  inquiries: "inbox.read",
  inquiry_activity: "inbox.read",
  imports: "import.run",
};
/** Every source is restricted to the already-authorized current seller. Human,
 * buyer, reporter and private message/evidence columns are never projected. */
export function sellerInsightSource(
  sellerId: string,
  dataset: Exclude<SellerDataset, "inquiries">,
): InsightSource {
  const reviewHref =
    "'/app/sellers/'||$1::text||'/listings/'||l.id::text||'/review'";
  const title = "left(coalesce(d.payload->>'title',''),180)";
  let sql: string;
  switch (dataset) {
    case "publications":
      // Withdrawal no-ops and draft edits can leave later receipts. Take the
      // earliest accepted withdrawal revision within each publication cycle.
      sql = `SELECT 'publication:'||p.listing_id::text||':'||p.revision::text AS id,p.listing_id::text AS "resourceId",left(coalesce(p.payload->>'title',''),180) AS label,
        'published'::text AS status,''::text AS kind,p.created_at AS at,'/app/sellers/'||$1::text||'/listings/'||p.listing_id::text||'/review' AS href,''::text AS reason,${emptyValues}
        FROM treido.listing_publications p WHERE p.seller_id=$1::uuid AND ${inRange("p.created_at")}
        UNION ALL
        SELECT 'withdrawal:'||p.listing_id::text||':'||w.revision::text,p.listing_id::text,left(coalesce(p.payload->>'title',''),180),'withdrawn','',w.at,
        '/app/sellers/'||$1::text||'/listings/'||p.listing_id::text||'/review','', '{}'::jsonb
        FROM treido.listing_publications p JOIN LATERAL (
          SELECT r.accepted_revision AS revision,min(r.created_at) AS at FROM treido.listing_withdrawal_receipts r
          WHERE r.seller_id=p.seller_id AND r.listing_id=p.listing_id AND r.accepted_revision>p.revision
            AND NOT EXISTS(SELECT 1 FROM treido.listing_publications later WHERE later.seller_id=p.seller_id
              AND later.listing_id=p.listing_id AND later.revision>p.revision AND later.revision<r.accepted_revision)
          GROUP BY r.accepted_revision ORDER BY r.accepted_revision LIMIT 1
        ) w ON w.at IS NOT NULL WHERE p.seller_id=$1::uuid AND ${inRange("w.at")}`;
      break;
    case "listing_status":
      sql = `SELECT l.id::text AS id,l.id::text AS "resourceId",${title} AS label,l.publication AS status,l.moderation_state AS kind,
        transaction_timestamp() AS at,${reviewHref} AS href,''::text AS reason,${emptyValues}
        FROM treido.listings l JOIN treido.listing_drafts d ON d.seller_id=l.seller_id AND d.listing_id=l.id WHERE l.seller_id=$1::uuid`;
      break;
    case "stock":
      sql = `SELECT stock.id,stock."resourceId",stock.label,
        CASE WHEN stock.mode IS NULL OR stock."onHand" IS NULL THEN 'unknown' WHEN stock.available>0 THEN 'available' WHEN stock."onHand">0 THEN 'reserved' ELSE 'out_of_stock' END AS status,
        coalesce(stock.mode,'unknown') AS kind,transaction_timestamp() AS at,stock.href,''::text AS reason,
        jsonb_build_object('onHand',stock."onHand",'held',stock.held,'available',stock.available) AS "values"
        FROM (SELECT coalesce(i.id,l.id)::text AS id,l.id::text AS "resourceId",
          left(${title}||CASE WHEN i.seller_sku IS NULL THEN '' ELSE ' · '||i.seller_sku END,320) AS label,c.mode,
          i.on_hand AS "onHand",CASE WHEN i.id IS NULL THEN NULL ELSE h.held END AS held,
          CASE WHEN i.id IS NULL THEN NULL ELSE greatest(0,i.on_hand-h.held) END AS available,${reviewHref} AS href
          FROM treido.listings l JOIN treido.listing_drafts d ON d.seller_id=l.seller_id AND d.listing_id=l.id
          LEFT JOIN treido.inventory_catalogues c ON c.seller_id=l.seller_id AND c.listing_id=l.id
          LEFT JOIN treido.inventory_skus i ON i.seller_id=l.seller_id AND i.listing_id=l.id AND i.active
          CROSS JOIN LATERAL (SELECT ${reservedSql("i.id")} AS held) h
          WHERE l.seller_id=$1::uuid) stock`;
      break;
    case "offers":
      sql = `SELECT e.id::text AS id,o.id::text AS "resourceId",o.listing_id::text AS label,e.kind AS status,o.proposer_side AS kind,e.created_at AS at,
        '/app/sellers/'||$1::text||'/inbox/'||o.thread_id::text AS href,''::text AS reason,${emptyValues}
        FROM treido.offer_events e JOIN treido.listing_offers o ON o.id=e.offer_id AND o.thread_id=e.thread_id
        WHERE o.seller_id=$1::uuid AND ${inRange("e.created_at")}`;
      break;
    case "conversations":
      sql = `SELECT t.id::text AS id,t.id::text AS "resourceId",t.listing_id::text AS label,t.state AS status,''::text AS kind,t.created_at AS at,
        '/app/sellers/'||$1::text||'/inbox/'||t.id::text AS href,''::text AS reason,${emptyValues}
        FROM treido.conversation_threads t WHERE t.seller_id=$1::uuid AND ${inRange("t.created_at")}`;
      break;
    case "inquiry_activity":
      sql = `SELECT r.review_id::text||':'||r.accepted_revision::text AS id,r.review_id::text AS "resourceId",r.review_id::text AS label,r.to_status AS status,r.kind,
        r.created_at AS at,'/app/sellers/'||$1::text||'/inquiries/'||r.review_id::text AS href,''::text AS reason,${emptyValues}
        FROM treido.merchant_inquiry_receipts r WHERE r.seller_id=$1::uuid AND ${inRange("r.created_at")}`;
      break;
    case "imports":
      sql = `SELECT i.id::text AS id,i.id::text AS "resourceId",left(i.source_name,180) AS label,i.state AS status,
        CASE WHEN stats.failed>0 THEN 'with_failed_rows' WHEN stats.invalid>0 THEN 'with_invalid_rows' ELSE 'without_row_errors' END AS kind,i.created_at AS at,
        '/app/sellers/'||$1::text||'/imports/'||i.id::text AS href,''::text AS reason,
        jsonb_build_object('totalRows',i.total_rows,'createdRows',stats.created,'failedRows',stats.failed,'invalidRows',stats.invalid,'readyRows',stats.ready) AS "values"
        FROM treido.catalogue_imports i CROSS JOIN LATERAL (
          SELECT count(*) FILTER(WHERE r.state='created')::int AS created,count(*) FILTER(WHERE r.state='failed')::int AS failed,
          count(*) FILTER(WHERE r.state='invalid')::int AS invalid,count(*) FILTER(WHERE r.state='ready')::int AS ready
          FROM treido.catalogue_import_rows r WHERE r.seller_id=i.seller_id AND r.import_id=i.id
        ) stats WHERE i.seller_id=$1::uuid AND ${inRange("i.created_at")}`;
      break;
  }
  return { sql, params: [sellerId] };
}
