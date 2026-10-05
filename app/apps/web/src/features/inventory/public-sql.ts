import "server-only";
import { reservedSql } from "./queries.server";
/** Fixed aliases l/p belong to the accepted-publication query. Never used without its eligibility predicate. */
export const publicInventoryJoin = `LEFT JOIN LATERAL (
  SELECT coalesce(
      min(ps.price_minor) FILTER (WHERE i.active AND i.on_hand-${reservedSql("i.id")}>0),
      min(ps.price_minor)
    )::bigint AS price,
    CASE WHEN bool_or(i.active AND i.on_hand-${reservedSql("i.id")}>0)
      THEN coalesce(
        max(ps.price_minor) FILTER (WHERE i.active AND i.on_hand-${reservedSql("i.id")}>0)>
        min(ps.price_minor) FILTER (WHERE i.active AND i.on_hand-${reservedSql("i.id")}>0),false)
      ELSE coalesce(max(ps.price_minor)>min(ps.price_minor),false)
    END AS price_from,
    CASE WHEN count(*)=0 THEN 'unknown'
      WHEN bool_or(i.active AND i.on_hand-${reservedSql("i.id")}>0) THEN 'available'
      WHEN bool_or(i.active AND i.on_hand>0) THEN 'reserved'
      ELSE 'out_of_stock' END AS state
  FROM treido.inventory_publication_skus ps JOIN treido.inventory_skus i
    ON i.seller_id=ps.seller_id AND i.listing_id=ps.listing_id AND i.id=ps.sku_id
  WHERE ps.seller_id=l.seller_id AND ps.listing_id=l.id AND ps.publication_revision=p.revision
) stock ON true`;
export const publicInventoryPrice =
  "coalesce(stock.price,(p.payload->>'priceMinor')::bigint)";
