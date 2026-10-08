import "server-only";
import {
  publicInventoryJoin,
  publicInventoryPrice,
} from "../inventory/public-sql";
import { getBrowseLeafIds } from "@treido/contracts/categories";
import { DISCOVERY_LIMITS, type DiscoveryInput } from "./discovery-input";
import {
  bulgarianSearchLetters,
  discoveryTerms,
  foldDiscoveryText,
} from "./public-discovery-model";
import {
  publishedEligibility,
  publishedJoins,
} from "./publication-eligibility.server";
import type { DiscoveryPosition } from "../../server/discovery/cursor.server";

/** Only application-owned SQL expressions enter this function. */
function foldSql(expression: string): string {
  let result = `replace(lower(translate(coalesce(${expression},''),'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')),'ия','ia')`;
  for (const [letter, latin] of Object.entries(bulgarianSearchLetters)) {
    result = `replace(${result},'${letter}','${latin}')`;
  }
  return result;
}
// Publication keeps the accepted form strings. Match the form's trim and
// decimal-comma normalization before numeric validation, never after a cast.
// The explicit characters match ECMAScript trim, including tabs and NBSP.
function numericTextSql(expression: string): string {
  const whitespace =
    "\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
  return `replace(btrim(${expression},'${whitespace}'),',','.')`;
}
const title = foldSql("p.payload->>'title'");
const locality = foldSql("p.payload->>'locality'");
const searchable = foldSql(
  "concat_ws(' ',p.payload->>'title',p.payload->>'description',p.payload->'fields',category.labels->>'bg',category.labels->>'en')",
);
const price = publicInventoryPrice;
const created = "date_trunc('milliseconds',p.created_at)";
export type DiscoveryQueryOptions = {
  sellerId?: string;
  excludeId?: string;
  position?: DiscoveryPosition | null;
  limit?: number;
  /** Application-owned Explore branches, each sampled independently. */
  previewCategories?: readonly string[];
};

/** One SQL snapshot supplies results, count and facets; no per-card queries. */
export function buildPublicDiscoveryQuery(
  input: DiscoveryInput,
  options: DiscoveryQueryOptions = {},
) {
  const values: unknown[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const where = [publishedEligibility, "p.payload->>'currency'='EUR'"];
  if (options.sellerId) where.push(`s.id=${bind(options.sellerId)}::uuid`);
  if (options.excludeId) where.push(`l.id<>${bind(options.excludeId)}::uuid`);
  if (input.seller !== "all") where.push(`s.kind=${bind(input.seller)}`);
  if (input.condition)
    where.push(`p.payload->>'condition'=${bind(input.condition)}`);
  if (input.category) {
    const ids = getBrowseLeafIds(input.category);
    where.push(`p.category_id=ANY(${bind(ids)}::text[])`);
  }
  if (input.minPriceMinor !== null)
    where.push(`${price}>=${bind(input.minPriceMinor)}`);
  if (input.maxPriceMinor !== null)
    where.push(`${price}<=${bind(input.maxPriceMinor)}`);
  if (input.location)
    where.push(
      `strpos(${locality},${bind(foldDiscoveryText(input.location))})>0`,
    );
  for (const term of discoveryTerms(input.q))
    where.push(`strpos(${searchable},${bind(term)})>0`);
  // Accepted attributes retain form strings; compare validated values, not JSON types.
  for (const [field, value] of Object.entries(input.attributes)) {
    const key = bind(field);
    if (Array.isArray(value)) {
      where.push(
        `(p.payload->'fields'->${key}) @> ${bind(JSON.stringify(value))}::jsonb`,
      );
    } else if (value && typeof value === "object") {
      for (const [part, expected] of Object.entries(value)) {
        const partKey = bind(part);
        const actual = `p.payload->'fields'->${key}->>${partKey}`;
        if (part === "unit") where.push(`${actual}=${bind(String(expected))}`);
        else {
          const normalized = numericTextSql(actual);
          where.push(
            `CASE WHEN ${normalized} ~ '^[0-9]+([.][0-9]+)?$' THEN (${normalized})::numeric END=${bind(Number(expected))}::numeric`,
          );
        }
      }
    } else if (typeof value === "number") {
      const actual = numericTextSql(`p.payload->'fields'->>${key}`);
      where.push(
        `CASE WHEN ${actual} ~ '^[0-9]+$' THEN (${actual})::numeric END=${bind(value)}::numeric`,
      );
    } else if (typeof value === "boolean")
      where.push(`p.payload->'fields'->>${key}=${bind(value ? "yes" : "no")}`);
    else where.push(`p.payload->'fields'->>${key}=${bind(String(value))}`);
  }
  const folded = foldDiscoveryText(input.q);
  const ranking = folded
    ? `CASE WHEN ${title}=${bind(folded)} THEN 1000 WHEN strpos(${title},${bind(folded)})>0 THEN 100 ELSE 0 END`
    : "0";
  const ascending = input.sort === "price_asc";
  const metric = input.sort.startsWith("price_")
    ? '"priceMinor"'
    : input.sort === "relevance"
      ? "rank"
      : null;
  const order = [
    metric ? `${metric} ${ascending ? "ASC" : "DESC"}` : "",
    '"createdAt" DESC',
    "id DESC",
  ]
    .filter(Boolean)
    .join(",");
  let after = "true";
  if (options.position) {
    const position = options.position;
    const time = bind(position.createdAt),
      id = bind(position.id);
    const tie = `("createdAt",id)<(${time}::timestamptz,${id}::uuid)`;
    if (metric) {
      const anchor = bind(
        input.sort.startsWith("price_") ? position.priceMinor : position.rank,
      );
      after = `(${metric}${ascending ? ">" : "<"}${anchor} OR (${metric}=${anchor} AND ${tie}))`;
    } else after = tie;
  }
  const pageLimit = Math.min(
    DISCOVERY_LIMITS.pageSize,
    Math.max(1, Math.trunc(options.limit ?? DISCOVERY_LIMITS.pageSize)),
  );
  const previews = options.previewCategories;
  if (
    previews &&
    (!previews.length ||
      previews.length > 17 ||
      new Set(previews).size !== previews.length)
  )
    throw new Error("Invalid Explore preview scope.");
  const previewScope = previews?.flatMap((categoryId, ordinal) => {
    const leaves = getBrowseLeafIds(categoryId);
    if (!leaves.length) throw new Error("Invalid Explore preview category.");
    return leaves.map((leafId) => ({ categoryId, leafId, ordinal }));
  });
  const limit = previews ? previews.length * 6 : pageLimit;
  const pageSql = previewScope
    ? `preview_scope AS (
      SELECT * FROM jsonb_to_recordset(${bind(JSON.stringify(previewScope))}::jsonb)
        AS branches("categoryId" text,"leafId" text,ordinal integer)
    ), preview_ranked AS (
      SELECT matched.*,preview_scope.ordinal AS "previewOrder",
        row_number() OVER(PARTITION BY preview_scope."categoryId" ORDER BY ${order}) AS "previewPosition"
      FROM matched JOIN preview_scope ON preview_scope."leafId"=matched."categoryId"
    ), page AS (SELECT * FROM preview_ranked WHERE "previewPosition"<=6)`
    : `page AS (SELECT * FROM matched WHERE ${after} ORDER BY ${order} LIMIT ${bind(limit + 1)})`;
  const pageOrder = previews ? '"previewOrder","previewPosition"' : order;
  const sql = `WITH matched AS MATERIALIZED (
    SELECT l.id,s.id AS "sellerId",s.name AS "sellerName",s.kind AS "sellerKind",p.revision,
      p.payload->>'title' AS title,${price} AS "priceMinor",p.category_id AS "categoryId",
      p.payload->>'condition' AS condition,p.payload->>'locality' AS locality,
      ${created} AS "createdAt",${ranking} AS rank,stock.price_from AS "priceFrom",stock.state AS "stockState",
      (SELECT pm.asset_id FROM treido.listing_publication_media pm
       WHERE pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision
       ORDER BY pm.position LIMIT 1) AS "photoId"
    ${publishedJoins}
    ${publicInventoryJoin}
    JOIN treido.categories category ON category.registry_version=p.registry_version AND category.id=p.category_id
    WHERE ${where.join(" AND ")}
  ), ${pageSql}
  SELECT (SELECT count(*)::int FROM matched) AS total,
    coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY ${pageOrder}) FROM page),'[]'::jsonb) AS items,
    coalesce((SELECT jsonb_agg(f ORDER BY f.count DESC,f.value) FROM
      (SELECT "categoryId" AS value,count(*)::int AS count FROM matched GROUP BY "categoryId" ORDER BY count DESC,"categoryId" LIMIT 152) f),'[]'::jsonb) AS categories,
    coalesce((SELECT jsonb_agg(f ORDER BY f.count DESC,f.value) FROM
      (SELECT condition AS value,count(*)::int AS count FROM matched GROUP BY condition) f),'[]'::jsonb) AS conditions,
    coalesce((SELECT jsonb_agg(f ORDER BY f.value) FROM
      (SELECT "sellerKind" AS value,count(*)::int AS count FROM matched GROUP BY "sellerKind") f),'[]'::jsonb) AS sellers`;
  return { text: sql, values, limit };
}
