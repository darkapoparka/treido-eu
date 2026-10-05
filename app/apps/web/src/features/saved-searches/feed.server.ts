import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { readToolFacts } from "../shopping-tools/catalogue.server";
import { validId } from "../selling/draft-model";
import { onlyKeys } from "../inventory/model";
import { SellerError } from "../sellers/errors";
import { SEARCH_LIMITS, type MatchFeed, type MatchItem } from "./model";
import { searchStorageReady, searchActorKey } from "./storage.server";
export type MatchQuery = {
  filter: "all" | "unread";
  q: string;
  cursor: string | null;
};
type Position = { at: string; id: string; ceiling: string; issuedAt: number };
function parseQuery(raw: unknown): MatchQuery {
  if (
    !onlyKeys(raw, ["filter", "q", "cursor"]) ||
    !["all", "unread"].includes(String(raw.filter)) ||
    typeof raw.q !== "string" ||
    raw.q.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(raw.q) ||
    (raw.cursor !== null &&
      (typeof raw.cursor !== "string" || raw.cursor.length > 1024))
  )
    throw new SellerError("INVALID_INPUT");
  return {
    filter: raw.filter as MatchQuery["filter"],
    q: raw.q.trim(),
    cursor: raw.cursor as string | null,
  };
}
function signature(body: string, actor: string, query: MatchQuery) {
  return createHmac("sha256", publicDiscoveryKey())
    .update(
      JSON.stringify([
        "buyer-search-feed-v1",
        actor,
        query.filter,
        query.q,
        body,
      ]),
    )
    .digest();
}
function decode(query: MatchQuery, actor: string): Position | null {
  if (!query.cursor) return null;
  try {
    const [body, mac, ...rest] = query.cursor.split("."),
      expected = signature(body, actor, query),
      received = Buffer.from(mac ?? "", "base64url");
    if (
      rest.length ||
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      throw Error();
    const raw: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );
    const stamp = (value: unknown): value is string =>
      typeof value === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value) &&
      Number.isFinite(Date.parse(value));
    if (
      !onlyKeys(raw, ["at", "id", "ceiling", "issuedAt"]) ||
      !validId(raw.id) ||
      !stamp(raw.at) ||
      !stamp(raw.ceiling) ||
      raw.at > raw.ceiling ||
      !Number.isSafeInteger(raw.issuedAt) ||
      Number(raw.issuedAt) > Date.now() ||
      Date.now() - Number(raw.issuedAt) > 86400000
    )
      throw Error();
    return {
      at: raw.at,
      id: raw.id,
      ceiling: raw.ceiling,
      issuedAt: Number(raw.issuedAt),
    };
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
}
const unavailable: MatchFeed = {
  items: [],
  nextCursor: null,
  unreadCount: 0,
  available: false,
};
/** Consumes the existing buyer notification transaction, never seller scope. */
export async function readSearchMatchFeed(
  tx: SellerTransaction,
  userId: string,
  actor: string,
  raw: unknown,
): Promise<MatchFeed> {
  const query = parseQuery(raw),
    position = decode(query, actor);
  if (!(await searchStorageReady(tx))) return unavailable;
  const ceiling =
    position?.ceiling ??
    (
      await tx.client.query<{ at: string }>(
        `SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at`,
      )
    ).rows[0].at;
  const rows = (
    await tx.client.query<Omit<MatchItem, "current">>(
      `SELECT n.id,n.search_id AS "searchId",s.name AS "searchName",n.kind,n.criteria_version AS version,
    n.criteria_version<>s.criteria_version AS "previousCriteria",s.status='paused' AS paused,n.listing_id AS "listingId",n.previous_fact AS previous,n.observed_fact AS observed,
    to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,n.read_at IS NULL AS unread
    FROM treido.buyer_search_notifications n JOIN treido.buyer_saved_searches s ON s.user_id=n.user_id AND s.id=n.search_id
    WHERE n.user_id=$1 AND s.status<>'removed' AND ($2='all' OR n.read_at IS NULL) AND ($3='' OR strpos(lower(s.name),lower($3))>0)
    AND NOT EXISTS(SELECT 1 FROM treido.listings source JOIN treido.contact_preferences cp ON cp.seller_id=source.seller_id AND cp.buyer_id=$1 WHERE source.id=n.listing_id AND (cp.buyer_blocked OR cp.seller_blocked))
    AND n.created_at<=$4::timestamptz AND ($5::timestamptz IS NULL OR (n.created_at,n.id)<($5::timestamptz,$6::uuid))
    ORDER BY n.created_at DESC,n.id DESC LIMIT $7`,
      [
        userId,
        query.filter,
        query.q,
        ceiling,
        position?.at ?? null,
        position?.id ?? null,
        SEARCH_LIMITS.page + 1,
      ],
    )
  ).rows;
  const selected = rows.slice(0, SEARCH_LIMITS.page),
    facts = new Map<string, MatchItem["current"]>();
  const ids = [...new Set(selected.map((row) => row.listingId))];
  for (let i = 0; i < ids.length; i += SEARCH_LIMITS.observedBatch)
    for (const [id, item] of await readToolFacts(
      tx,
      ids.slice(i, i + SEARCH_LIMITS.observedBatch),
    ))
      facts.set(id, item);
  const items = selected.map((row) => {
    const current = facts.get(row.listingId) ?? null;
    return {
      ...row,
      current,
      previous: current ? row.previous : null,
      observed: current ? row.observed : null,
    };
  });
  const count = (
    await tx.client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM treido.buyer_search_notifications n JOIN treido.buyer_saved_searches s ON s.user_id=n.user_id AND s.id=n.search_id WHERE n.user_id=$1 AND n.read_at IS NULL AND s.status<>'removed' AND NOT EXISTS(SELECT 1 FROM treido.listings source JOIN treido.contact_preferences cp ON cp.seller_id=source.seller_id AND cp.buyer_id=$1 WHERE source.id=n.listing_id AND (cp.buyer_blocked OR cp.seller_blocked))",
      [userId],
    )
  ).rows[0].count;
  const last = selected.at(-1);
  let nextCursor: string | null = null;
  if (rows.length > SEARCH_LIMITS.page && last) {
    const body = Buffer.from(
      JSON.stringify({
        at: last.at,
        id: last.id,
        ceiling,
        issuedAt: position?.issuedAt ?? Date.now(),
      }),
    ).toString("base64url");
    nextCursor =
      body + "." + signature(body, actor, query).toString("base64url");
  }
  return { items, nextCursor, unreadCount: count, available: true };
}
export async function readSearchUpdates(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<MatchFeed> {
  return inTransaction(database, async (tx) => {
    parseQuery(raw);
    if (!(await searchStorageReady(tx))) throw new SellerError("NOT_AVAILABLE");
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return { items: [], nextCursor: null, unreadCount: 0, available: true };
      throw error;
    }
    return readSearchMatchFeed(tx, user.id, searchActorKey(identity), raw);
  });
}
