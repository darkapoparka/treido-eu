import "server-only";

/** Existing a/q aliases only. A quarantined charge is terminal only when the
 * original full refund, reversal and applicable fee facts are all persisted. */
export const terminalFullRefundSql = `(
  a.state='quarantined' AND EXISTS (
    SELECT 1 FROM treido.paid_orders o
    JOIN treido.payment_refunds r ON r.order_id=o.id AND r.attempt_id=a.id AND r.seller_id=a.seller_id
    JOIN treido.inventory_allocations allocation ON allocation.id=q.allocation_id
    WHERE o.attempt_id=a.id AND o.quote_id=q.id AND o.buyer_id=q.buyer_id AND o.seller_id=q.seller_id
      AND a.seller_id=q.seller_id AND a.platform_account=q.platform_account AND a.livemode=q.livemode
      AND q.currency='EUR' AND q.terms_snapshot->>'refundPolicy'='full_fee_and_transfer_reversal'
      AND o.payment_state='refunded' AND o.settlement_state='reversed' AND o.fulfilment_state='blocked'
      AND allocation.buyer_id=q.buyer_id AND allocation.seller_id=q.seller_id AND allocation.state='consumed'
      AND allocation.resolution_reference='stripe:' || a.provider_id
      AND r.state='succeeded' AND r.provider_id IS NOT NULL
      AND r.parameters->>'payment_intent'=a.provider_id
      AND r.parameters->'amount'=to_jsonb(q.total_minor)
      AND r.parameters->'reverse_transfer'='true'::jsonb
      AND r.parameters->'refund_application_fee'=to_jsonb(q.application_fee_minor>0)
      AND r.parameters->'metadata'->>'refund_id'=r.id::text
      AND r.parameters->'metadata'->>'attempt_id'=a.id::text
      AND r.parameters->'metadata'->>'application_id'=a.parameters->'metadata'->>'application_id'
      AND r.parameters->'metadata'->>'environment'=a.parameters->'metadata'->>'environment'
      AND EXISTS (SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=a.id AND f.platform_account=a.platform_account AND f.livemode=a.livemode AND f.kind='charge' AND f.currency='eur' AND f.amount_minor=q.total_minor)
      AND EXISTS (SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=a.id AND f.platform_account=a.platform_account AND f.livemode=a.livemode AND f.kind='transfer' AND f.currency='eur' AND f.amount_minor=q.total_minor)
      AND EXISTS (SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=a.id AND f.platform_account=a.platform_account AND f.livemode=a.livemode AND f.kind='refund' AND f.object_id=r.provider_id AND f.currency='eur' AND f.amount_minor=q.total_minor)
      AND EXISTS (SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=a.id AND f.platform_account=a.platform_account AND f.livemode=a.livemode AND f.kind='transfer_reversal' AND f.currency='eur' AND f.amount_minor=q.total_minor)
      AND (q.application_fee_minor=0 OR EXISTS (SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=a.id AND f.platform_account=a.platform_account AND f.livemode=a.livemode AND f.kind='application_fee' AND f.currency='eur' AND f.amount_minor=q.application_fee_minor))
      AND (SELECT coalesce(sum(f.amount_minor),0) FROM treido.payment_facts f WHERE f.attempt_id=a.id AND f.platform_account=a.platform_account AND f.livemode=a.livemode AND f.kind='fee_refund' AND f.currency='eur')=q.application_fee_minor
      AND NOT EXISTS (SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=a.id AND f.kind='dispute')
  )
)`;
