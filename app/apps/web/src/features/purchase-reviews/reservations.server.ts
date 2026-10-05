import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, authorizeSeller } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import type { ReservationItem, ReservationQueue } from "./reservation-model";
export async function readReservationQueue(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  query: {
    sellerId: string | null;
    view: "active" | "history";
    before?: string | null;
    q?: string;
  },
): Promise<ReservationQueue> {
  if (
    (query.sellerId !== null && !validId(query.sellerId)) ||
    !["active", "history"].includes(query.view) ||
    (query.before && !validId(query.before)) ||
    (query.q !== undefined &&
      (typeof query.q !== "string" || query.q.length > 80))
  )
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const empty: ReservationQueue = {
      actorKey: libraryActorKey(identity),
      sellerId: query.sellerId,
      items: [],
      nextBefore: null,
      activeCount: 0,
      reconciliationCount: 0,
    };
    let user,
      canManage = false;
    if (query.sellerId) {
      const access = await authorizeSeller(
        tx,
        identity,
        query.sellerId,
        "inbox.read",
      );
      await authorizeSeller(tx, identity, query.sellerId, "listing.read");
      user = access.user;
      canManage =
        access.context.capabilities.includes("inbox.reply") &&
        access.context.capabilities.includes("listing.publish") &&
        (access.seller.kind === "personal" ||
          access.context.capabilities.includes("inventory.manage"));
    } else {
      try {
        user = await authorizeHuman(tx, identity, false);
      } catch (error) {
        if (error instanceof SellerError && error.code === "NOT_FOUND")
          return empty;
        throw error;
      }
      canManage = true;
    }
    // The same fixed predicate governs the page, anchor and totals. No buyer identity is projected.
    const scope = query.sellerId
      ? "a.seller_id=$1"
      : "a.buyer_id=$1 AND NOT EXISTS(SELECT 1 FROM treido.personal_seller_owners own WHERE own.seller_id=a.seller_id AND own.user_id=$1) AND NOT EXISTS(SELECT 1 FROM treido.seller_memberships sm WHERE sm.seller_id=a.seller_id AND sm.user_id=$1 AND sm.status='active')";
    const scopeId = query.sellerId ?? user.id;
    if (
      query.before &&
      (
        await tx.client.query(
          `SELECT a.id FROM treido.inventory_allocations a WHERE ${scope} AND a.id=$2`,
          [scopeId, query.before],
        )
      ).rowCount !== 1
    )
      throw new SellerError("INVALID_INPUT");
    const counts = (
      await tx.client.query<{
        activeCount: number;
        reconciliationCount: number;
      }>(
        `SELECT count(*) FILTER(WHERE state='active' AND expires_at>statement_timestamp())::int AS "activeCount",count(*) FILTER(WHERE state='reconciliation')::int AS "reconciliationCount" FROM treido.inventory_allocations a WHERE ${scope}`,
        [scopeId],
      )
    ).rows[0];
    const rows = (
      await tx.client.query<
        Omit<
          ReservationItem,
          "createdAt" | "expiresAt" | "canCancel" | "merchandiseMinor"
        > & { createdAt: Date; expiresAt: Date; merchandiseMinor: string }
      >(
        `SELECT a.id,a.seller_id AS "sellerId",s.name AS "sellerName",a.purpose,a.created_at AS "createdAt",a.expires_at AS "expiresAt",CASE WHEN a.state='active' AND a.expires_at<=statement_timestamp() THEN 'expired' ELSE a.state END AS state,
      o.thread_id AS "threadId",o.id AS "offerId",t.offer_revision AS "offerRevision",line.items AS lines,line.total AS "merchandiseMinor"
      FROM treido.inventory_allocations a JOIN treido.seller_accounts s ON s.id=a.seller_id LEFT JOIN treido.listing_offers o ON o.id=a.source_id AND o.allocation_id=a.id AND a.purpose='offer' LEFT JOIN treido.conversation_threads t ON t.id=o.thread_id
      JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('listingId',al.listing_id,'skuId',al.sku_id,'title',p.payload->>'title','options',ps.options,'quantity',al.quantity,'unitPriceMinor',al.unit_price_minor) ORDER BY al.listing_id,al.sku_id) AS items,sum(al.quantity::bigint*al.unit_price_minor) AS total
      FROM treido.inventory_allocation_lines al JOIN treido.listing_publications p ON p.seller_id=al.seller_id AND p.listing_id=al.listing_id AND p.revision=al.publication_revision JOIN treido.inventory_publication_skus ps ON ps.seller_id=al.seller_id AND ps.listing_id=al.listing_id AND ps.publication_revision=al.publication_revision AND ps.sku_id=al.sku_id WHERE al.allocation_id=a.id) line ON true
      WHERE ${scope} AND ((a.state='active' AND a.expires_at>statement_timestamp())=$2)
      AND ($3::uuid IS NULL OR (a.created_at,a.id)<(SELECT created_at,id FROM treido.inventory_allocations WHERE id=$3))
      AND ($4='' OR EXISTS(SELECT 1 FROM treido.inventory_allocation_lines al JOIN treido.listing_publications p ON p.seller_id=al.seller_id AND p.listing_id=al.listing_id AND p.revision=al.publication_revision WHERE al.allocation_id=a.id AND strpos(lower(translate(p.payload->>'title','АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')),lower(translate($4,'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ')))>0))
      ORDER BY a.created_at DESC,a.id DESC LIMIT 21`,
        [
          scopeId,
          query.view === "active",
          query.before ?? null,
          (query.q ?? "").trim(),
        ],
      )
    ).rows;
    const items = rows.slice(0, 20).map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      merchandiseMinor: Number(r.merchandiseMinor),
      canCancel:
        canManage && r.state === "active" && !!r.offerId && !!r.threadId,
    }));
    return {
      ...empty,
      ...counts,
      items,
      nextBefore: rows.length > 20 ? items.at(-1)!.id : null,
    };
  });
}
