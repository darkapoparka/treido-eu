import Stripe from "../../apps/web/node_modules/stripe/esm/stripe.esm.node.js";
import type { RefundIntent } from "../../apps/web/src/features/order-aftercare/refund-storage.server";
/** Explicit synthetic local SDK transport only. Retains the original owned refund/account/charge GET behavior; adds one bounded payment POST for ORIGINAL beginPayment/processor execution. No network request or provider qualification. */
export function shippingLocalTransport() {
  const charges = new Map<string, { id: string; paymentIntentId: string; connected: string; total: number; fee: number; refunded: number; feeRefunded: number; disputed?: boolean }>();
  const intents = new Map<string, Record<string, unknown>>();
  const refunds = new Map<string, Record<string, unknown>>(), reversals = new Map<string, Record<string, unknown>>();
  let posts = 0, gets = 0;
  // Actual installed Stripe SDK through its explicit local transport seam. All
  // provider-shaped responses are synthetic; every unexpected request fails.
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "api.stripe.com") throw Error("Unexpected synthetic provider host");
    const method = init?.method ?? "GET";
    if (method === "POST" && url.pathname === "/v1/payment_intents") {
      posts++;
      const form = new URLSearchParams(String(init?.body ?? ""));
      const metadata: Record<string, string> = {};
      for (const [key, value] of form) {
        const match = /^metadata\[([^\]]+)\]$/.exec(key);
        if (match) metadata[match[1]] = value;
      }
      const total = Number(form.get("amount")), fee = Number(form.get("application_fee_amount"));
      const connected = form.get("transfer_data[destination]");
      if (!metadata.attempt_id || !metadata.quote_id || !connected || form.get("currency") !== "eur" ||
          !Number.isSafeInteger(total) || total < 50 || !Number.isSafeInteger(fee) || fee < 0 || fee > total ||
          form.get("capture_method") !== "automatic") throw Error("Invalid original synthetic payment parameters");
      const id = "pi_T61" + metadata.attempt_id.replaceAll("-", ""), chargeId = "ch_T61" + metadata.attempt_id.replaceAll("-", "");
      if (intents.has(id)) throw Error("Unexpected duplicate synthetic payment POST");
      const intent = { id, object: "payment_intent", status: "succeeded", livemode: false,
        amount: total, amount_received: total, currency: "eur", application_fee_amount: fee,
        transfer_data: { destination: connected }, on_behalf_of: form.get("on_behalf_of"),
        capture_method: "automatic", latest_charge: chargeId, metadata };
      intents.set(id, intent);
      charges.set(chargeId, { id: chargeId, paymentIntentId: id, connected, total, fee, refunded: 0, feeRefunded: 0 });
      return Response.json(intent, { headers: { "request-id": "req_T61Synthetic", "stripe-version": "2026-09-30.endive" } });
    }
    if (method === "POST") {
      if (url.pathname !== "/v1/refunds") throw Error("Unexpected provider POST");
      posts++; throw Error("SYNTHETIC refund acknowledgment lost after emission");
    }
    if (method !== "GET") throw Error("Unexpected provider mutation");
    gets++;
    let result: unknown;
    if (url.pathname.startsWith("/v1/accounts/")) result = { id: url.pathname.split("/").at(-1), object: "account", country: "BG", default_currency: "eur", charges_enabled: true, payouts_enabled: true,
      details_submitted: true, capabilities: { transfers: "active", card_payments: "active" }, requirements: { currently_due: [], past_due: [], pending_verification: [], disabled_reason: null } };
    else if (url.pathname.startsWith("/v1/payment_intents/")) result = intents.get(url.pathname.split("/").at(-1)!);
    else if (url.pathname.startsWith("/v1/charges/")) {
      const row = charges.get(url.pathname.split("/").at(-1)!); if (!row) throw Error("Unknown original synthetic charge");
      result = { id: row.id, object: "charge", livemode: false, currency: "eur", amount: row.total, amount_refunded: row.refunded,
        paid: true, captured: true, disputed: row.disputed ?? false, payment_intent: row.paymentIntentId, transfer_data: { destination: row.connected },
        balance_transaction: { id: "bt_" + row.id, object: "balance_transaction", fee: 123, currency: "eur" },
        transfer: { id: "tr_" + row.id, object: "transfer", livemode: false, currency: "eur", amount: row.total,
          destination: row.connected, source_transaction: row.id, amount_reversed: row.refunded, reversed: row.refunded === row.total },
        application_fee: { id: "fee_" + row.id, object: "application_fee", livemode: false, currency: "eur", charge: row.id, amount: row.fee, amount_refunded: row.feeRefunded } };
    } else if (url.pathname === "/v1/refunds") result = { object: "list", data: [...refunds.values()].filter(row => row.payment_intent === url.searchParams.get("payment_intent")), has_more: false };
    else if (url.pathname.startsWith("/v1/refunds/")) result = refunds.get(url.pathname.split("/").at(-1)!);
    else if (url.pathname.startsWith("/v1/transfers/")) {
      const parts = url.pathname.split("/"), transferId = parts[3];
      const row = charges.get(transferId.replace(/^tr_/, "")); if (!row) throw Error("Unknown original transfer");
      result = parts[4] === "reversals" ? reversals.get(parts[5])
        : { id: transferId, object: "transfer", livemode: false, currency: "eur", amount: row.total, destination: row.connected, source_transaction: row.id };
    } else if (url.pathname.startsWith("/v1/application_fees/")) {
      const parts = url.pathname.split("/"), row = charges.get(parts[3].replace(/^fee_/, "")); if (!row) throw Error("Unknown original fee");
      result = parts[4] === "refunds" ? { object: "list", data: [{ id: "fr_" + row.id, amount: row.feeRefunded }], has_more: false }
        : { id: parts[3], object: "application_fee", livemode: false, currency: "eur", charge: row.id, amount: row.fee, amount_refunded: row.feeRefunded };
    }
    else throw Error("Unexpected provider GET");
    if (!result) throw Error("Unknown exact synthetic provider object");
    return Response.json(result, { headers: { "request-id": "req_T61Synthetic", "stripe-version": "2026-09-30.endive" } });
  };
  const stripe = new Stripe("SYNTHETIC-LOCAL-TRANSPORT-ONLY", { apiVersion: "2026-09-30.endive", maxNetworkRetries: 0, httpClient: Stripe.createFetchHttpClient(transport) });
  const succeed = (row: RefundIntent) => {
    const charge = charges.get(row.chargeId); if (!charge) throw Error("Unknown frozen original charge");
    const id = "re_T61" + row.id.replaceAll("-", ""), reversalId = "trr_T61" + row.id.replaceAll("-", "");
    if (refunds.has(id)) throw Error("Synthetic observation already provided");
    charge.refunded += row.amountMinor; charge.feeRefunded += row.feeMinor;
    refunds.set(id, { id, object: "refund", status: "succeeded", payment_intent: row.paymentIntentId, charge: row.chargeId,
      currency: "eur", amount: row.amountMinor, metadata: row.parameters.metadata, transfer_reversal: reversalId });
    reversals.set(reversalId, { id: reversalId, object: "transfer_reversal", currency: "eur", amount: row.amountMinor, source_refund: id });
  };
  return { stripe, charges, intents, succeed, counts: () => ({ posts, gets }) };
}
