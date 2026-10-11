import "server-only";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { getDatabase } from "../../server/db/database";
import { readCustomerHistory } from "./customer-history.server";
import { SellerError } from "./errors";
import { merchantCsv } from "./merchant-csv";
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
const failure = (code: string, status: number) => Response.json({ ok: false, code }, { status, headers });
export async function exportCustomerHistory(request: Request, sellerId: string, anchorId: string) {
  try {
    const url = new URL(request.url), site = request.headers.get("sec-fetch-site"), origin = request.headers.get("origin");
    if ((site && !["same-origin", "none"].includes(site)) || (origin && origin !== url.origin)) return failure("FORBIDDEN", 403);
    if (url.search.length > 2000) return failure("INVALID_INPUT", 400);
    const seen = new Set<string>();
    for (const [key] of url.searchParams) { if (seen.has(key)) return failure("INVALID_INPUT", 400); seen.add(key); }
    const raw = Object.fromEntries(url.searchParams), actor = raw.actor;
    delete raw.actor;
    if (!actor || !/^[a-f0-9]{64}$/.test(actor)) return failure("FORBIDDEN", 403);
    const identity = await readVerifiedIdentity();
    if (!identity) return failure("UNAUTHENTICATED", 401);
    const view = await readCustomerHistory(getDatabase(), identity, sellerId, anchorId, raw, actor);
    const rows: (string | number | null)[][] = [["seller_local_customer_reference", "order_reference", "accepted_total_minor", "currency", "payment_state", "settlement_state", "handover", "fulfilment_state", "created_at", "observed_at"]];
    for (const order of view.orders) rows.push([view.reference, order.id, order.totalMinor, order.currency, order.paymentState, order.settlementState, order.handover, order.handover === "shipping" ? order.shippingFulfilmentState : order.fulfilmentState, order.createdAt, view.observedAt]);
    return new Response(merchantCsv(rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="treido-customer-orders-page.csv"' } });
  } catch (error) {
    if (error instanceof SellerError) {
      if (error.code === "INVALID_INPUT") return failure("INVALID_INPUT", 400);
      if (["NOT_FOUND", "FORBIDDEN"].includes(error.code)) return failure("FORBIDDEN", 403);
    }
    return failure("NOT_AVAILABLE", 503);
  }
}
