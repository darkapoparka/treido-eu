-- Read-only optimization, never authority to execute a maintenance effect.
-- Eligibility is deliberately a superset: frozen bindings, protected payment
-- holds, leases and provider readiness remain the original consumers' checks.
CREATE FUNCTION treido.repair_any_due_v1() RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
SELECT
 -- Billing includes never-attempted expiry and still-active subscriptions.
 EXISTS(SELECT 1 FROM treido.billing_intents i WHERE
   (i.state='prepared' AND i.first_attempt_at IS NULL AND i.expires_at<=clock_timestamp()) OR
   (i.updated_at<clock_timestamp()-interval '60 seconds' AND
    (i.state IN('creating','reconciling','ready') AND i.operation IN('checkout','cancel','change') OR
     EXISTS(SELECT 1 FROM treido.billing_subscriptions s WHERE s.origin_intent_id=i.id AND s.retired_at IS NULL)) AND
    NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='billing.reconcile' AND j.resource_id=i.id AND j.seller_id=i.seller_id AND j.state IN('pending','accepted'))))
 OR EXISTS(SELECT 1 FROM treido.promotion_metrics WHERE expires_at<=clock_timestamp())
 OR EXISTS(SELECT 1 FROM treido.promotion_attempts pa WHERE pa.updated_at<clock_timestamp()-interval '5 minutes' AND
   (pa.state IN('creating','reconciling','pending') OR (pa.state='prepared' AND (pa.intent->>'checkoutExpiresAt')::timestamptz<=clock_timestamp())) AND
   NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='promotion.reconcile' AND j.resource_id=pa.id AND j.state IN('pending','accepted')))
 OR EXISTS(SELECT 1 FROM treido.promotion_campaigns pc JOIN treido.promotion_intervals pi ON pi.campaign_id=pc.id WHERE pc.state IN('active','scheduled','paused') AND pi.ends_at<=clock_timestamp())
 OR EXISTS(SELECT 1 FROM treido.order_refund_intents WHERE reconcile_at<=clock_timestamp() AND state IN('prepared','creating','pending','reconciling'))
 OR EXISTS(SELECT 1 FROM treido.payment_attempts a WHERE a.state<>'cancelled' AND a.reconcile_at<=clock_timestamp() AND
   NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='payment.reconcile' AND j.resource_id=a.id AND j.state IN('pending','accepted','dead')))
 OR EXISTS(SELECT 1 FROM treido.payment_refunds r WHERE r.state NOT IN('succeeded','failed') AND r.reconcile_at<=clock_timestamp() AND
   NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='payment.refund' AND j.resource_id=r.id AND j.state IN('pending','accepted','dead')))
 OR EXISTS(SELECT 1 FROM treido.buyer_saved_searches s WHERE s.status='enabled' AND s.due_at<=clock_timestamp() AND
   NOT EXISTS(SELECT 1 FROM treido.buyer_saved_search_runs r WHERE r.search_id=s.id AND r.state='running'))
 -- Same lifecycle artifact identities, including voice usage from migration 51.
 OR EXISTS(SELECT 1 FROM (
   SELECT 'assistant.media-expiry'::text AS kind,a.id FROM treido.assistant_media_assets a WHERE (a.expires_at<=clock_timestamp() OR a.state='cancelled') AND
     EXISTS(SELECT 1 FROM treido.assistant_media_objects o WHERE o.asset_id=a.id AND o.state<>'deleted' AND o.write_until<=clock_timestamp() AND o.retain_until<=clock_timestamp())
   UNION ALL
   SELECT 'assistant.run-expiry',r.id FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.expires_at<=clock_timestamp() AND
     (r.input_json IS NOT NULL OR r.proposal IS NOT NULL OR r.accepted_criteria IS NOT NULL OR r.state NOT IN('cancelled','failed') OR b.status IN('reserved','calling'))
   UNION ALL
   SELECT 'assistant.usage',r.id FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.emission_started_at IS NOT NULL AND r.provider_id IS NOT NULL AND b.status IN('reserved','calling','unknown')
 ) candidate WHERE NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.kind=candidate.kind AND j.operation_key=candidate.id AND
   (j.state IN('pending','accepted','completed','cancelled') OR j.dispatch_until>clock_timestamp() OR e.execution_until>clock_timestamp())))
 OR EXISTS(SELECT 1 FROM treido.account_execution_plans p WHERE p.accepted_at IS NOT NULL AND p.state IN('accepted','processing','blocked','reconciling') AND
   NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.kind='account.closure' AND j.operation_key=p.acceptance_key AND
    (j.state IN('pending','accepted','completed','cancelled') OR j.dispatch_until>clock_timestamp() OR e.execution_until>clock_timestamp())))
 OR EXISTS(SELECT 1 FROM treido.order_shipping_choices c JOIN treido.order_shipping_recipients r ON r.choice_id=c.id AND r.buyer_id=c.buyer_id WHERE r.value IS NOT NULL AND r.retain_until<=clock_timestamp() AND
   ((c.quote_id IS NULL AND c.expires_at<=clock_timestamp()) OR c.state='bound') AND
   NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.kind=CASE WHEN c.quote_id IS NULL THEN 'shipping.input-expiry' ELSE 'shipping.recipient-expiry' END AND j.operation_key=c.id AND
    (j.state IN('pending','accepted','completed','cancelled') OR j.dispatch_until>clock_timestamp() OR e.execution_until>clock_timestamp())))
 -- Include exhausted attempts: leasing must still mark them dead.
 OR EXISTS(SELECT 1 FROM treido.outbox_jobs WHERE state IN('pending','accepted') AND available_at<=clock_timestamp())
 OR EXISTS(SELECT 1 FROM treido.inventory_allocations WHERE state='active' AND expires_at<=clock_timestamp())
 OR EXISTS(SELECT 1 FROM treido.listing_offers o LEFT JOIN treido.inventory_allocations a ON a.id=o.allocation_id WHERE
   (o.state='pending' AND o.expires_at<=clock_timestamp()) OR
   (o.state='expired' AND NOT EXISTS(SELECT 1 FROM treido.offer_events e WHERE e.offer_id=o.id AND e.kind='expired')) OR
   (o.state='accepted' AND (a.state='expired' OR (a.state='active' AND a.expires_at<=clock_timestamp())) AND NOT EXISTS(SELECT 1 FROM treido.offer_events e WHERE e.offer_id=o.id AND e.kind='hold_expired')))
 OR EXISTS(SELECT 1 FROM treido.catalogue_imports WHERE state='uploading' AND expires_at<=clock_timestamp())
 OR EXISTS(SELECT 1 FROM treido.invitation_deliveries WHERE provider_id IS NOT NULL AND request_payload IS NOT NULL AND state IN('submitted','sent','delivered') AND
   (last_checked_at IS NULL OR last_checked_at<clock_timestamp()-interval '10 minutes') AND submitted_at>clock_timestamp()-interval '30 days')
 OR EXISTS(SELECT 1 FROM treido.message_attachment_objects o WHERE o.state<>'deleted' AND o.write_until<clock_timestamp() AND o.retain_until<=clock_timestamp() AND (o.deletion_until IS NULL OR o.deletion_until<clock_timestamp()) AND
   NOT EXISTS(SELECT 1 FROM treido.message_attachments a WHERE a.id=o.attachment_id AND
    ((o.kind='ready' AND a.object_key=o.object_key AND EXISTS(SELECT 1 FROM treido.message_attachment_links l WHERE l.attachment_id=a.id)) OR
     (o.kind='source' AND a.source_key=o.object_key AND a.state='processing' AND a.expires_at>clock_timestamp()))))
 OR EXISTS(SELECT 1 FROM treido.seller_invitations WHERE status='pending' AND expires_at<=clock_timestamp())
 OR EXISTS(SELECT 1 FROM treido.media_storage_objects o JOIN treido.media_assets a ON a.seller_id=o.seller_id AND a.id=o.asset_id LEFT JOIN treido.outbox_jobs j ON j.id=a.job_id AND j.seller_id=a.seller_id WHERE
   o.state<>'deleted' AND o.write_until<clock_timestamp() AND o.retain_until<=clock_timestamp() AND o.available_at<=clock_timestamp() AND (o.deletion_until IS NULL OR o.deletion_until<clock_timestamp()) AND
   NOT(o.kind='ready' AND a.state='ready' AND a.derivative_key=o.object_key) AND
   NOT(o.kind='staging' AND a.state='staged' AND a.expires_at>clock_timestamp()) AND
   NOT(o.kind='immutable' AND a.state='processing' AND a.immutable_key=o.object_key AND coalesce(j.state,'pending') NOT IN('dead','cancelled')))
$$;
REVOKE ALL ON FUNCTION treido.repair_any_due_v1() FROM PUBLIC;
