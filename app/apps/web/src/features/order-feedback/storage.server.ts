import "server-only";
import type { PoolClient } from "pg";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import type { OrderContext } from "../order-aftercare/storage.server";
import { completedPurchaseEligible, type FeedbackEligibility } from "./model";
export type FeedbackPolicy = {
  id: string;
  version: number;
  termsHash: string;
  terms: { bg: string; en: string };
  retentionDescription: { bg: string; en: string };
  eligibility: "completed_paid_no_refund";
  moderation: "explicit_approved_operator";
};
export async function feedbackStorageAvailable(
  client: Pick<PoolClient, "query">,
) {
  const row = (
    await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM unnest(ARRAY['order_feedback_policies','order_purchase_feedback','order_feedback_events','order_feedback_receipts']) name WHERE to_regclass('treido.'||name) IS NOT NULL",
    )
  ).rows[0];
  if (row?.n === 0) return false;
  if (row?.n !== 4) throw new SellerError("NOT_AVAILABLE");
  return true;
}
export function feedbackPolicyHash(
  p: Omit<FeedbackPolicy, "id" | "termsHash">,
) {
  return inputHash({
    format: "order-feedback-policy-v1",
    version: p.version,
    terms: p.terms,
    retentionDescription: p.retentionDescription,
    eligibility: p.eligibility,
    moderation: p.moderation,
  });
}
export async function readFeedbackPolicy(
  tx: SellerTransaction,
  order: OrderContext,
  id?: string,
): Promise<FeedbackPolicy | null> {
  const row = (
    await tx.client.query<FeedbackPolicy>(
      'SELECT id,version,terms_hash AS "termsHash",terms,retention_description AS "retentionDescription",eligibility,moderation FROM treido.order_feedback_policies WHERE base_policy_id=$1 AND platform_account=$2 AND livemode=$3 AND environment=$4 AND application_id=$5 AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND ($6::uuid IS NULL OR id=$6) ORDER BY version DESC LIMIT 1',
      [
        order.policyId,
        order.platformAccount,
        order.livemode,
        order.environment,
        order.applicationId,
        id ?? null,
      ],
    )
  ).rows[0];
  if (!row) return null;
  const locked = (
    await tx.client.query<{ allowed: boolean }>(
      "SELECT treido.lock_order_feedback_policy($1,$2,$3,$4,$5,$6) AS allowed",
      [
        row.id,
        order.policyId,
        order.platformAccount,
        order.livemode,
        order.environment,
        order.applicationId,
      ],
    )
  ).rows[0];
  if (!locked?.allowed) return null;
  if (feedbackPolicyHash(row) !== row.termsHash)
    throw new SellerError("NOT_AVAILABLE");
  return row;
}
export const eligibilitySql =
  'SELECT o.payment_state AS "paymentState",o.settlement_state AS "settlementState",o.fulfilment_state AS "fulfilmentState",EXISTS(SELECT 1 FROM treido.order_fulfilments f WHERE f.order_id=o.id AND f.method=\'shipping\' AND f.state=\'buyer_confirmed_delivery\') AS "shippingCompleted",coalesce((SELECT sum(amount_minor) FROM treido.order_refund_intents r WHERE r.order_id=o.id AND r.provider_status=\'succeeded\'),0)::int AS "aftercareRefundedMinor",EXISTS(SELECT 1 FROM treido.order_refund_intents r WHERE r.order_id=o.id AND r.state<>\'expired\') AS "hasUnresolvedRefund",(SELECT state FROM treido.payment_refunds r WHERE r.order_id=o.id) AS "legacyRefundState",EXISTS(SELECT 1 FROM treido.order_cases c WHERE c.order_id=o.id AND c.state<>\'resolved\') AS "hasOpenCase",EXISTS(SELECT 1 FROM treido.payment_attempts a JOIN treido.payment_facts f ON f.attempt_id=a.id AND f.kind=\'charge\' AND f.platform_account=q.platform_account AND f.livemode=q.livemode AND f.amount_minor=q.total_minor AND f.currency=\'eur\' WHERE a.id=o.attempt_id AND a.quote_id=q.id AND a.state=\'paid\') AS "paymentEvidence" FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id WHERE o.id=$1';
export async function feedbackEligible(
  client: Pick<PoolClient, "query">,
  orderId: string,
) {
  const facts = (
    await client.query<FeedbackEligibility>(eligibilitySql, [orderId])
  ).rows[0];
  return Boolean(
    facts &&
    completedPurchaseEligible(facts, {
      allowRefundedFeedback: false,
      allowOpenCaseFeedback: false,
    }),
  );
}
