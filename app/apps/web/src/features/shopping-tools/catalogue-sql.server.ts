import "server-only";
import { getCategory, getChildren } from "@treido/contracts/categories";
import {
  bulgarianSearchLetters,
  discoveryTerms,
  foldDiscoveryText,
} from "../catalog/public-discovery-model";
import {
  publishedEligibility,
  publishedJoins,
} from "../catalog/publication-eligibility.server";
import { reservedSql } from "../inventory/queries.server";
import { TOOL_LIMITS, type ToolIntent } from "./intent";
import type { ToolPosition } from "./cursor.server";

/** Expressions are fixed application SQL, never request-supplied SQL or identifiers. */
function fold(expression: string) {
  let result = `replace(lower(translate(coalesce(${expression},''),'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')),'ия','ia')`;
  for (const [letter, latin] of Object.entries(bulgarianSearchLetters))
    result = `replace(${result},'${letter}','${latin}')`;
  return result;
}
const title = fold("p.payload->>'title'");
const searchable = fold(
  "concat_ws(' ',p.payload->>'title',p.payload->>'description',p.payload->'fields')",
);
/** Read the accepted SKU definition with current canonical stock/paid-risk holds.
 * A sold-out cheap variant cannot become the representative available price. */
const inventoryJoin = `LEFT JOIN treido.inventory_publications ip
 ON ip.seller_id=l.seller_id AND ip.listing_id=l.id AND ip.publication_revision=p.revision
 LEFT JOIN LATERAL (
 SELECT count(*)::int AS variants,coalesce(sum(sk.available),0)::int AS available,
   coalesce(bool_or(sk.on_hand>0),false) AS held,
   (jsonb_agg(jsonb_build_object('id',sk.id,'options',sk.options,'priceMinor',sk.price_minor,'available',sk.available)
     ORDER BY sk.price_minor,sk.id) FILTER(WHERE sk.available>0))->0 AS variant
 FROM (SELECT ps.sku_id AS id,ps.options,ps.price_minor,
   CASE WHEN i.active THEN i.on_hand ELSE 0 END AS on_hand,
   CASE WHEN i.active THEN greatest(0,i.on_hand-${reservedSql("i.id")}) ELSE 0 END AS available
   FROM treido.inventory_publication_skus ps JOIN treido.inventory_skus i
    ON i.seller_id=ps.seller_id AND i.listing_id=ps.listing_id AND i.id=ps.sku_id
   WHERE ps.seller_id=l.seller_id AND ps.listing_id=l.id AND ps.publication_revision=p.revision
 ) sk) stock ON true`;
const price =
  "coalesce((stock.variant->>'priceMinor')::integer,(p.payload->>'priceMinor')::integer)";
const stockState =
  "CASE WHEN ip.mode IS NULL THEN 'unknown' WHEN stock.available>0 THEN 'available' WHEN stock.held THEN 'reserved' ELSE 'out_of_stock' END";
const timestamp = `to_char(p.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const projection = `l.id,s.id AS "sellerId",s.name AS "sellerName",s.kind AS "sellerKind",p.revision,p.payload,p.terms,
 p.created_at AS "createdAt",${timestamp} AS at,${price} AS "priceMinor",
 ip.mode,stock.variants,stock.available,stock.variant,${stockState} AS "stockState",
 statement_timestamp() AS "checkedAt",
 (SELECT pm.asset_id FROM treido.listing_publication_media pm
  WHERE pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision ORDER BY pm.position LIMIT 1) AS "photoId"`;
export function buildToolQuery(
  intent: ToolIntent,
  position: ToolPosition | null,
  internal?: {
    ids?: string[];
    ceiling?: string;
  },
) {
  const values: unknown[] = [],
    bind = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
  const input = intent.discovery,
    where = [
      publishedEligibility,
      "p.payload->>'currency'='EUR'",
      `(${stockState}) IN ('unknown','available')`,
    ];
  if (internal?.ids) where.push(`l.id=ANY(${bind(internal.ids)}::uuid[])`);
  if (internal?.ceiling)
    where.push(`p.created_at<=${bind(internal.ceiling)}::timestamptz`);
  if (intent.availability === "known")
    where.push("stock.available>0 AND ip.mode IS NOT NULL");
  if (intent.handover !== "any")
    where.push(`p.terms->'handover' ? ${bind(intent.handover)}`);
  if (input.seller !== "all") where.push(`s.kind=${bind(input.seller)}`);
  if (input.condition)
    where.push(`p.payload->>'condition'=${bind(input.condition)}`);
  if (input.category) {
    const category = getCategory(input.category);
    where.push(
      `p.category_id=ANY(${bind(category?.kind === "root" ? getChildren(category.id).map((x) => x.id) : [input.category])}::text[])`,
    );
  }
  if (input.location)
    where.push(
      `strpos(${fold("p.payload->>'locality'")},${bind(foldDiscoveryText(input.location))})>0`,
    );
  if (input.minPriceMinor !== null)
    where.push(`${price}>=${bind(input.minPriceMinor)}::integer`);
  if (input.maxPriceMinor !== null)
    where.push(`${price}<=${bind(input.maxPriceMinor)}::integer`);
  for (const term of discoveryTerms(input.q))
    where.push(`strpos(${searchable},${bind(term)})>0`);
  for (const [field, value] of Object.entries(input.attributes)) {
    const key = bind(field),
      raw = `p.payload->'fields'->>${key}`;
    const numeric = (expression: string) =>
      `CASE WHEN replace(btrim(${expression}),',','.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(btrim(${expression}),',','.')::numeric END`;
    if (Array.isArray(value))
      where.push(
        `p.payload->'fields'->${key} @> ${bind(JSON.stringify(value))}::jsonb`,
      );
    else if (typeof value === "boolean")
      where.push(`${raw}=${bind(value ? "yes" : "no")}`);
    else if (typeof value === "number")
      where.push(`${numeric(raw)}=${bind(value)}::numeric`);
    else if (typeof value === "object" && "value" in value) {
      where.push(
        `${numeric(`p.payload->'fields'->${key}->>'value'`)}=${bind(value.value)}::numeric`,
      );
      where.push(`p.payload->'fields'->${key}->>'unit'=${bind(value.unit)}`);
    } else if (typeof value === "object") {
      const scale = { mm: 1, cm: 10, m: 1000 }[value.unit];
      const actualScale = `CASE p.payload->'fields'->${key}->>'unit' WHEN 'mm' THEN 1 WHEN 'cm' THEN 10 WHEN 'm' THEN 1000 END`;
      for (const axis of ["width", "height", "depth"] as const)
        where.push(
          `(${numeric(`p.payload->'fields'->${key}->>'${axis}'`)})*(${actualScale})=${bind(value[axis] * scale)}::numeric`,
        );
    } else where.push(`btrim(${raw})=${bind(value)}`);
  }
  const q = foldDiscoveryText(input.q),
    rank = q
      ? `CASE WHEN ${title}=${bind(q)} THEN 1000 WHEN strpos(${title},${bind(q)})>0 THEN 100 ELSE 0 END`
      : "0";
  const metric = input.sort.startsWith("price_")
    ? '"priceMinor"'
    : input.sort === "relevance"
      ? "rank"
      : null;
  const ascending = input.sort === "price_asc",
    order = [
      metric ? `${metric} ${ascending ? "ASC" : "DESC"}` : "",
      '"createdAt" DESC',
      "id DESC",
    ]
      .filter(Boolean)
      .join(",");
  let after = "true";
  if (position) {
    const tie = `("createdAt",id)<(${bind(position.at)}::timestamptz,${bind(position.id)}::uuid)`;
    if (metric) {
      const anchor = bind(metric === "rank" ? position.rank : position.price);
      after = `(${metric}${ascending ? ">" : "<"}${anchor} OR (${metric}=${anchor} AND ${tie}))`;
    } else after = tie;
  }
  return {
    text: `WITH matched AS (SELECT ${projection},${rank} AS rank ${publishedJoins} ${inventoryJoin} WHERE ${where.join(" AND ")}) SELECT * FROM matched WHERE ${after} ORDER BY ${order} LIMIT ${bind(TOOL_LIMITS.results + 1)}`,
    values,
  };
}
/** At most four owned IDs, no visibility fallback; withdrawn facts are redacted. */
export function buildComparisonFactsQuery(ids: string[]) {
  return {
    text: `SELECT ${projection},0 AS rank ${publishedJoins} ${inventoryJoin} WHERE l.id=ANY($1::uuid[]) AND ${publishedEligibility} ORDER BY l.id LIMIT 4`,
    values: [ids],
  };
}
