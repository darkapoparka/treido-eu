import "server-only";
import type { PoolClient } from "pg";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import { readOrderShippingRecipient } from "../order-shipping/recipient.server";
import { readShippingLifecycleFacts } from "../order-shipping/lifecycle.server";
import { orderContext, aftercareStorageAvailable } from "./storage.server";
import { readServicePolicy, acceptedFinancialPolicy } from "./policy.server";
import { orderRefundProviderAvailable } from "./refund-provider.server";
import type {
  Language,
  CaseReason,
  CaseState,
  RefundState,
  RefundPortion,
} from "./model";
import type { AftercareView, AftercareOwnExport } from "./view";
async function capability(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string,
  cap: "order.fulfil" | "refund.request",
) {
  try {
    await authorizeSeller(tx, identity, sellerId, cap);
    return true;
  } catch (error) {
    if (error instanceof SellerError && error.code === "FORBIDDEN")
      return false;
    throw error;
  }
}
export async function readOrderAftercare(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string | null,
  orderId: string,
  language: Language = "bg",
): Promise<AftercareView> {
  if (language !== "bg" && language !== "en")
    throw new SellerError("INVALID_INPUT");
  const result = await inTransaction(database, async (tx) => {
    const order = await orderContext(tx, identity, {
      orderId,
      sellerId,
      actorKey: libraryActorKey(identity),
    });
    const view: AftercareView = {
      actorKey: libraryActorKey(identity),
      actorSubject: identity.subject,
      orderId,
      sellerId,
      sellerName: order.sellerName,
      side: order.side,
      orderRevision: order.orderRevision,
      currency: "EUR",
      totalMinor: order.totalMinor,
      refundedMinor: null,
      unresolvedMinor: null,
      paymentState: order.paymentState,
      originalFulfilmentState: order.fulfilmentState,
      originalSettlementState: order.settlementState,
      available: false,
      availability: "policy_unavailable",
      policy: null,
      cases: [],
      refunds: [],
      fulfilment: {
        method: order.terms.handover === "shipping" ? "shipping" : "pickup",
        state: order.fulfilmentState === "blocked" ? "blocked" : "pending",
        revision: 0,
        carrier: null,
        trackingReference: null,
        description: null,
        events: [],
      },
      canReply: false,
      canRefund: false,
      canPrepareRefund: false,
      canTrack: false,
      shippingContractAvailable: false,
      shippingRecipient: null,
      acceptedCarrier: null,
      shippingRefund: null,
      partialContract: null,
      lines: [],
      moreCases: false,
      moreRefunds: false,
      language,
    };
    if (!(await aftercareStorageAvailable(tx))) return view;
    const policy = await readServicePolicy(tx, order);
    if (policy) {
      view.available = true;
      view.availability = "ready";
      view.policy = {
        id: policy.id,
        version: policy.version,
        termsHash: policy.termsHash,
        terms: policy.terms[language],
        retentionDescription: policy.retentionDescription[language],
      };
    }
    const canReply =
      order.side === "buyer" ||
      (await capability(tx, identity, order.sellerId, "order.fulfil"));
    view.canReply = Boolean(policy) && canReply;
    const cases = (
      await tx.client.query<{
        id: string;
        reason: CaseReason;
        state: CaseState;
        revision: number;
        policyVersion: number;
        createdAt: Date;
      }>(
        'SELECT c.id,c.reason,c.state,c.revision,p.version AS "policyVersion",c.created_at AS "createdAt" FROM treido.order_cases c JOIN treido.order_service_policies p ON p.id=c.policy_id WHERE c.order_id=$1 ORDER BY c.created_at DESC,c.id DESC LIMIT 6',
        [orderId],
      )
    ).rows;
    view.moreCases = cases.length > 5;
    for (const item of cases.slice(0, 5)) {
      const events = (
        await tx.client.query<{
          id: string;
          kind: string;
          side: "buyer" | "merchant" | "operator";
          body: string;
          evidence: string[];
          createdAt: Date;
        }>(
          'SELECT id,kind,side,body,evidence,created_at AS "createdAt" FROM treido.order_case_events WHERE case_id=$1 ORDER BY accepted_revision DESC LIMIT 51',
          [item.id],
        )
      ).rows;
      view.cases.push({
        ...item,
        createdAt: item.createdAt.toISOString(),
        events: events
          .slice(0, 50)
          .reverse()
          .map((event) => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
          })),
        moreEvents: events.length > 50,
      });
    }
    const financial = await acceptedFinancialPolicy(tx, order);
    if (financial)
      view.partialContract = {
        policyId: financial.id,
        version: financial.version,
        terms: financial.terms[language],
        termsHash: financial.termsHash,
      };
    view.canRefund =
      order.side === "merchant" &&
      order.paymentState === "paid" &&
      order.settlementState === "transferred" &&
      Boolean(financial) &&
      orderRefundProviderAvailable() &&
      (await capability(tx, identity, order.sellerId, "refund.request"));
    view.shippingContractAvailable = Boolean(
      financial?.method === "shipping" &&
      financial.trackingAllowed &&
      order.terms.handover === "shipping",
    );
    view.canTrack =
      view.shippingContractAvailable && order.side === "merchant" && canReply;
    const refunds = (
      await tx.client.query<{
        id: string;
        state: RefundState;
        revision: number;
        requestId: string;
        actorId: string;
        reason: string;
        amountMinor: number;
        feeMinor: number;
        taxBasis: "inclusive_unspecified";
        expiresAt: Date;
        firstAttemptAt: Date | null;
        providerStatus: string | null;
        settlementState:
          "unobserved" | "verified" | "reconciling" | "remedy_required";
        createdAt: Date;
      }>(
        'SELECT id,state,revision,request_id AS "requestId",actor_id AS "actorId",reason,amount_minor AS "amountMinor",fee_minor AS "feeMinor",tax_basis AS "taxBasis",expires_at AS "expiresAt",first_attempt_at AS "firstAttemptAt",provider_status AS "providerStatus",settlement_state AS "settlementState",created_at AS "createdAt" FROM treido.order_refund_intents WHERE order_id=$1 ORDER BY created_at DESC,id DESC LIMIT 31',
        [orderId],
      )
    ).rows;
    view.moreRefunds = refunds.length > 30;
    for (const refund of refunds.slice(0, 30)) {
      const lines = (
        await tx.client.query<RefundPortion>(
          'SELECT sku_id AS "skuId",from_quantity AS "fromQuantity",quantity,amount_minor AS "amountMinor",fee_minor AS "feeMinor",tax_minor AS "taxMinor",tax_basis AS "taxBasis" FROM treido.order_refund_lines WHERE intent_id=$1 ORDER BY sku_id',
          [refund.id],
        )
      ).rows;
      const { actorId, ...publicRefund } = refund;
      view.refunds.push({
        ...publicRefund,
        ownedByCurrentActor: actorId === order.actorId,
        expiresAt: refund.expiresAt.toISOString(),
        firstAttemptAt: refund.firstAttemptAt?.toISOString() ?? null,
        createdAt: refund.createdAt.toISOString(),
        lines,
        shippingComponent:
          order.terms.handover === "shipping"
            ? ((
                await tx.client.query<{
                  amountMinor: number;
                  feeMinor: number;
                }>(
                  'SELECT amount_minor AS "amountMinor",fee_minor AS "feeMinor" FROM treido.order_refund_shipping_components WHERE intent_id=$1',
                  [refund.id],
                )
              ).rows[0] ?? null)
            : null,
      });
    }
    const totals = (
      await tx.client.query<{ confirmed: number; unresolved: number }>(
        "SELECT coalesce(sum(amount_minor) FILTER(WHERE provider_status='succeeded'),0)::int AS confirmed,coalesce(sum(amount_minor) FILTER(WHERE state NOT IN ('succeeded','expired')),0)::int AS unresolved FROM treido.order_refund_intents WHERE order_id=$1",
        [orderId],
      )
    ).rows[0];
    const legacy = (
      await tx.client.query<{ amountMinor: number; state: string }>(
        'SELECT q.total_minor AS "amountMinor",r.state FROM treido.payment_refunds r JOIN treido.paid_orders o ON o.id=r.order_id JOIN treido.payable_quotes q ON q.id=o.quote_id WHERE r.order_id=$1',
        [orderId],
      )
    ).rows[0];
    view.refundedMinor =
      totals.confirmed +
      (legacy?.state === "succeeded" ? legacy.amountMinor : 0);
    view.unresolvedMinor =
      totals.unresolved +
      (legacy && legacy.state !== "succeeded" ? legacy.amountMinor : 0);
    if (legacy) view.canRefund = false;
    view.lines = (
      await tx.client.query<AftercareView["lines"][number]>(
        'SELECT q.sku_id AS "skuId",q.title,q.quantity,q.unit_price_minor AS "unitPriceMinor",(q.quantity-coalesce((SELECT sum(l.quantity) FROM treido.order_refund_lines l JOIN treido.order_refund_intents r ON r.id=l.intent_id WHERE l.quote_id=q.quote_id AND l.sku_id=q.sku_id AND r.state<>\'expired\'),0))::int AS "remainingQuantity" FROM treido.payable_quote_lines q WHERE q.quote_id=$1 ORDER BY q.position',
        [order.quoteId],
      )
    ).rows;
    view.canPrepareRefund =
      view.canRefund &&
      view.unresolvedMinor === 0 &&
      view.lines.some((line) => line.remainingQuantity > 0);
    if (legacy)
      view.lines = view.lines.map((line) => ({
        ...line,
        remainingQuantity: 0,
      }));
    const fulfilment = (
      await tx.client.query<Omit<AftercareView["fulfilment"], "events">>(
        'SELECT method,state,revision,carrier,tracking_reference AS "trackingReference",description FROM treido.order_fulfilments WHERE order_id=$1',
        [orderId],
      )
    ).rows[0];
    if (fulfilment) {
      const events = (
        await tx.client.query<{
          id: string;
          kind: string;
          description: string;
          createdAt: Date;
        }>(
          'SELECT id,kind,description,created_at AS "createdAt" FROM treido.order_fulfilment_events WHERE order_id=$1 ORDER BY accepted_revision DESC LIMIT 30',
          [orderId],
        )
      ).rows;
      view.fulfilment = {
        ...fulfilment,
        events: events.reverse().map((event) => ({
          ...event,
          createdAt: event.createdAt.toISOString(),
        })),
      };
    }
    if (view.shippingContractAvailable) {
      const accepted = (
        await tx.client.query<{
          code: string;
          label: string;
          shippingMinor: number;
          refundTerms: string;
          before: string;
          after: string;
          reserved: number;
          currentReady: boolean;
        }>(
          "SELECT c.snapshot->'option'->'binding'->>'carrierCode' AS code,c.snapshot->'option'->'binding'->'carrierLabel'->>$2 AS label,q.delivery_minor AS \"shippingMinor\",q.terms_snapshot->'shipping'->>'refundTerms' AS \"refundTerms\",q.terms_snapshot->'shipping'->'shippingRefund'->>'beforeDispatch' AS before,q.terms_snapshot->'shipping'->'shippingRefund'->>'afterDispatch' AS after,coalesce((SELECT sum(s.amount_minor) FROM treido.order_refund_shipping_components s JOIN treido.order_refund_intents r ON r.id=s.intent_id WHERE r.quote_id=q.id AND r.state<>'expired'),0)::integer AS reserved,treido.order_shipping_retention_ready(p.id,p.environment,p.application_id) AS \"currentReady\" FROM treido.order_shipping_choices c JOIN treido.payable_quotes q ON q.id=c.quote_id AND q.buyer_id=c.buyer_id AND q.seller_id=c.seller_id JOIN treido.order_shipping_policies p ON p.id=(c.snapshot->'option'->'policy'->>'id')::uuid AND p.terms_hash=c.snapshot->'option'->'policy'->>'termsHash' WHERE q.id=$1 AND c.state='bound'",
          [order.quoteId, language],
        )
      ).rows[0];
      if (!accepted) throw new SellerError("NOT_AVAILABLE");
      view.shippingContractAvailable =
        view.shippingContractAvailable && accepted.currentReady === true;
      view.canTrack = view.canTrack && view.shippingContractAvailable;
      view.acceptedCarrier = { code: accepted.code, label: accepted.label };
      const remaining = accepted.shippingMinor - accepted.reserved;
      const stage = view.fulfilment.state;
      const eligible =
        remaining > 0 &&
        (stage === "pending"
          ? accepted.before === "refundable"
          : ["seller_reported_dispatched", "buyer_confirmed_delivery"].includes(
              stage,
            ) && accepted.after === "refundable");
      view.shippingRefund = {
        remainingMinor: remaining,
        eligible,
        terms: accepted.refundTerms,
      };
      view.canPrepareRefund =
        view.canRefund &&
        view.unresolvedMinor === 0 &&
        (view.lines.some((line) => line.remainingQuantity > 0) || eligible);
    }
    return view;
  });
  if (
    result.shippingContractAvailable &&
    (result.side === "buyer" || result.canTrack)
  ) {
    result.shippingRecipient = await readOrderShippingRecipient(
      database,
      identity,
      { actorKey: result.actorKey, orderId, sellerId },
    );
    result.canTrack = result.canTrack && result.shippingRecipient.available;
    result.shippingContractAvailable =
      result.shippingContractAvailable &&
      result.paymentState === "paid" &&
      result.originalSettlementState === "transferred" &&
      result.unresolvedMinor === 0;
  }
  return result;
}
export async function readAftercareOwnExport(
  client: Pick<PoolClient, "query">,
  userId: string,
): Promise<AftercareOwnExport> {
  if (!validId(userId)) throw new SellerError("INVALID_INPUT");
  const present = (
    await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM unnest(ARRAY['order_cases','order_refund_intents']) name WHERE to_regclass('treido.'||name) IS NOT NULL",
    )
  ).rows[0];
  if (present?.n !== 2) throw new SellerError("NOT_AVAILABLE");
  const cases = (
    await client.query<{
      id: string;
      orderId: string;
      state: string;
      revision: number;
      createdAt: Date;
    }>(
      'SELECT id,order_id AS "orderId",state,revision,created_at AS "createdAt" FROM treido.order_cases WHERE buyer_id=$1 ORDER BY created_at DESC,id DESC LIMIT 51',
      [userId],
    )
  ).rows;
  const refunds = (
    await client.query<{
      id: string;
      orderId: string;
      amountMinor: number;
      currency: "EUR";
      state: string;
      createdAt: Date;
    }>(
      'SELECT id,order_id AS "orderId",amount_minor AS "amountMinor",currency,state,created_at AS "createdAt" FROM treido.order_refund_intents WHERE buyer_id=$1 AND actor_id=$1 ORDER BY created_at DESC,id DESC LIMIT 51',
      [userId],
    )
  ).rows;
  return {
    cases: cases
      .slice(0, 50)
      .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    refundRequests: refunds
      .slice(0, 50)
      .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    more: cases.length > 50 || refunds.length > 50,
  };
}
export async function readAftercareClosureFacts(
  tx: SellerTransaction,
  userId: string,
) {
  if (!validId(userId)) throw new SellerError("INVALID_INPUT");
  if (!(await aftercareStorageAvailable(tx)))
    return {
      available: false,
      openCases: null,
      unresolvedRefunds: null,
      unconfirmedShipping: null,
      retainedEvents: null,
    } as const;
  const facts = (
    await tx.client.query<{
      openCases: number;
      unresolvedRefunds: number;
      unconfirmedShipping: number;
      retainedEvents: number;
    }>(
      "SELECT (SELECT count(*)::int FROM treido.order_cases c WHERE (c.buyer_id=$1 OR EXISTS(SELECT 1 FROM treido.personal_seller_owners po WHERE po.seller_id=c.seller_id AND po.user_id=$1)) AND c.state<>'resolved') AS \"openCases\",(SELECT count(*)::int FROM treido.order_refund_intents r WHERE (r.buyer_id=$1 OR r.actor_id=$1 OR EXISTS(SELECT 1 FROM treido.personal_seller_owners po WHERE po.seller_id=r.seller_id AND po.user_id=$1)) AND (r.state NOT IN ('succeeded','expired') OR r.settlement_state<>'verified' AND r.state<>'expired')) AS \"unresolvedRefunds\",(SELECT count(*)::int FROM treido.order_fulfilments f JOIN treido.paid_orders o ON o.id=f.order_id WHERE o.buyer_id=$1 AND f.method='shipping' AND f.state<>'buyer_confirmed_delivery') AS \"unconfirmedShipping\",(SELECT count(*)::int FROM treido.order_case_events WHERE actor_id=$1) AS \"retainedEvents\"",
      [userId],
    )
  ).rows[0];
  const registered = (
    await tx.client.query<{ present: boolean }>(
      "SELECT to_regclass(\'treido.order_shipping_choices\') IS NOT NULL AS present",
    )
  ).rows[0];
  if (!registered?.present) return { available: true, ...facts } as const;
  const shipping = await readShippingLifecycleFacts(tx, userId);
  return {
    available: true,
    ...facts,
    unconfirmedShipping: shipping.unconfirmedShipping,
    retainedShippingRecipients: shipping.retainedAcceptedRecipients,
    unboundShippingPrivateInputs: shipping.unboundPrivateInputs,
  } as const;
}
