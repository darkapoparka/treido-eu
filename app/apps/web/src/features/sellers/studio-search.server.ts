import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "./persistence.server";
import { SellerError } from "./errors";
import { sellerCustomerReference } from "./customers.server";
import { merchantNavigation } from "./merchant-navigation";
import { paymentText } from "../payments/messages";
import type { OrderView } from "../payments/model";
import {
  matchesStudioText,
  parseStudioSearch,
  studioSearchGroups,
  type StudioSearchItem,
  type StudioSearchView,
} from "./studio-search-model";

/** One short, current-authority transaction. No global search index, preview
 * records, customer contacts, provider calls or write-side effects are involved. */
export async function readStudioSearch(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<StudioSearchView> {
  const input = parseStudioSearch(raw);
  if (!input) throw new SellerError("INVALID_INPUT");
  if (input.actorSubject !== identity.subject)
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    await tx.client.query("SET LOCAL statement_timeout = '2500ms'");
    await tx.client.query("SET LOCAL lock_timeout = '1500ms'");
    const { context } = await authorizeSeller(
      tx,
      identity,
      input.sellerId,
      "seller.read",
    );
    const groups = studioSearchGroups(context.capabilities);
    if (!groups.includes(input.group)) throw new SellerError("FORBIDDEN");
    const requested = (group: (typeof groups)[number]) =>
      groups.includes(group) &&
      (input.group === "all" || input.group === group);
    const bg = input.language === "bg",
      suffix = `?lang=${input.language}`,
      base = `/app/sellers/${input.sellerId}`;
    const items: StudioSearchItem[] = [];
    if (requested("navigation")) {
      items.push(
        ...merchantNavigation(context, input.language)
          .filter((item) => matchesStudioText(item.label, input.q))
          .slice(0, 24)
          .map((item) => ({
            id: "navigation:" + item.key,
            group: "navigation" as const,
            title: item.label,
            description: bg ? "Работно пространство" : "Workspace",
            href: item.href,
          })),
      );
    }
    if (requested("products")) {
      const rows = (
        await tx.client.query<{
          id: string;
          title: string;
          status: "draft" | "published" | "withdrawn" | "restricted";
        }>(
          `SELECT l.id,coalesce(d.payload->>'title','') AS title,CASE WHEN l.moderation_state<>'clear' THEN 'restricted' ELSE l.publication END AS status
         FROM treido.listings l JOIN treido.listing_drafts d ON d.seller_id=l.seller_id AND d.listing_id=l.id
         WHERE l.seller_id=$1 AND ($2='' OR position(lower($2) in lower(coalesce(d.payload->>'title','')))>0 OR EXISTS(
           SELECT 1 FROM treido.inventory_skus sku WHERE sku.seller_id=l.seller_id AND sku.listing_id=l.id
           AND sku.active AND position(lower($2) in lower(sku.seller_sku))>0))
         ORDER BY d.updated_at DESC,l.id DESC LIMIT 8`,
          [input.sellerId, input.q],
        )
      ).rows;
      const labels = bg
        ? {
            draft: "Чернова",
            published: "Публикуван",
            withdrawn: "Свален",
            restricted: "Ограничен",
          }
        : {
            draft: "Draft",
            published: "Published",
            withdrawn: "Withdrawn",
            restricted: "Restricted",
          };
      items.push(
        ...rows.map((row) => ({
          id: "product:" + row.id,
          group: "products" as const,
          title: row.title || (bg ? "Артикул без заглавие" : "Untitled item"),
          description: labels[row.status],
          href: `${base}/listings/${row.id}/${context.capabilities.includes("listing.write") ? "edit" : "review"}${suffix}`,
        })),
      );
    }
    if (requested("orders")) {
      const rows = (
        await tx.client.query<{
          id: string;
          totalMinor: number;
          paymentState: OrderView["paymentState"];
        }>(
          `SELECT o.id,q.total_minor AS "totalMinor",o.payment_state AS "paymentState"
         FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id AND q.seller_id=o.seller_id
         WHERE o.seller_id=$1 AND ($2='' OR position(lower($2) in lower(o.id::text))>0 OR EXISTS(
           SELECT 1 FROM treido.payable_quote_lines l WHERE l.quote_id=o.quote_id AND position(lower($2) in lower(l.title))>0))
         ORDER BY o.created_at DESC,o.id DESC LIMIT 8`,
          [input.sellerId, input.q],
        )
      ).rows;
      const t = paymentText(input.language),
        money = new Intl.NumberFormat(input.language, {
          style: "currency",
          currency: "EUR",
        });
      items.push(
        ...rows.map((row) => ({
          id: "order:" + row.id,
          group: "orders" as const,
          title: `${bg ? "Поръчка" : "Order"} ${row.id.slice(0, 8).toUpperCase()}`,
          description: `${money.format(row.totalMinor / 100)} · ${t.statuses[row.paymentState]}`,
          href: `${base}/orders/${row.id}${suffix}`,
        })),
      );
    }
    if (requested("customers")) {
      // Customer identities are seller-local references. Explicitly bounded to
      // the most recent 30 customers, not a fictional global CRM/name directory.
      const rows = (
        await tx.client.query<{ buyerId: string; lastOrderId: string }>(
          `WITH latest AS (SELECT DISTINCT ON (buyer_id) buyer_id,id,created_at FROM treido.paid_orders WHERE seller_id=$1 ORDER BY buyer_id,created_at DESC,id DESC)
         SELECT buyer_id AS "buyerId",id AS "lastOrderId" FROM latest ORDER BY created_at DESC,id DESC LIMIT 30`,
          [input.sellerId],
        )
      ).rows;
      items.push(
        ...rows
          .map((row) => ({
            id: "customer:" + row.lastOrderId,
            group: "customers" as const,
            title: sellerCustomerReference(input.sellerId, row.buyerId),
            description: bg
              ? "Скорошна активност на клиент"
              : "Recent customer activity",
            href: `${base}/orders${suffix}&customerOrder=${row.lastOrderId}`,
          }))
          .filter((item) => matchesStudioText(item.title, input.q))
          .slice(0, 8),
      );
    }
    return {
      sellerId: input.sellerId,
      actorSubject: identity.subject,
      q: input.q,
      group: input.group,
      groups,
      items,
      customerScope: "recent_30",
    };
  });
}
