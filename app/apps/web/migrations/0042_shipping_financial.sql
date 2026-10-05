-- Additive original financial integration. No approval, provider, recipient or tariff seed.
ALTER TABLE treido.payable_quotes DROP CONSTRAINT payable_quotes_delivery_minor_check;
ALTER TABLE treido.payable_quotes ADD CONSTRAINT payable_quotes_delivery_minor_check CHECK(delivery_minor BETWEEN 0 AND 99999999);
-- Existing zero buyer-fee constraint remains unchanged.
CREATE TABLE treido.order_refund_shipping_components(
 intent_id uuid PRIMARY KEY REFERENCES treido.order_refund_intents(id),quote_id uuid NOT NULL REFERENCES treido.payable_quotes(id),
 amount_minor integer NOT NULL CHECK(amount_minor BETWEEN 1 AND 99999999),fee_minor integer NOT NULL CHECK(fee_minor BETWEEN 0 AND amount_minor),
 tax_basis text NOT NULL CHECK(tax_basis='inclusive_unspecified'),fulfilment_stage text NOT NULL CHECK(fulfilment_stage IN('before_dispatch','after_dispatch')),fulfilment_revision integer NOT NULL CHECK(fulfilment_revision>=0),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION treido.check_payable_quote() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q treido.payable_quotes; a treido.inventory_allocations; b treido.seller_payment_bindings; p treido.payment_policies; n integer; amount bigint; quote_key uuid; c treido.order_shipping_choices; sp treido.order_shipping_policies; rate treido.order_shipping_rates; financial treido.order_financial_policies; expected jsonb; commission bigint; expected_fee bigint;
BEGIN
  IF TG_TABLE_NAME='payable_quotes' THEN quote_key:=NEW.id; ELSE quote_key:=NEW.quote_id; END IF;
  SELECT * INTO q FROM treido.payable_quotes WHERE id=quote_key;
  SELECT * INTO a FROM treido.inventory_allocations WHERE id=q.allocation_id;
  SELECT * INTO b FROM treido.seller_payment_bindings WHERE id=q.binding_id;
  SELECT * INTO p FROM treido.payment_policies WHERE id=q.policy_id;
  SELECT count(*),sum(quantity::bigint*unit_price_minor) INTO n,amount FROM treido.payable_quote_lines WHERE quote_id=q.id;
  expected_fee:=((q.total_minor::bigint*p.fee_bps+5000)/10000+p.fee_fixed_minor);
  IF q.terms_snapshot->>'handover'='shipping' THEN
   SELECT * INTO c FROM treido.order_shipping_choices WHERE quote_id=q.id AND buyer_id=q.buyer_id AND seller_id=q.seller_id AND state='bound' FOR SHARE;
   SELECT * INTO sp FROM treido.order_shipping_policies WHERE id=(c.snapshot->'option'->'policy'->>'id')::uuid AND base_policy_id=q.policy_id AND platform_account=q.platform_account AND livemode=q.livemode AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
   SELECT * INTO rate FROM treido.order_shipping_rates WHERE id=(c.snapshot->'option'->'rate'->>'id')::uuid AND policy_id=sp.id AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
   IF NOT treido.lock_order_aftercare_registry('financial',sp.financial_policy_id,sp.base_policy_id,sp.platform_account,sp.livemode,sp.environment,sp.application_id) THEN RAISE EXCEPTION 'Original qualified shipping quote unavailable' USING ERRCODE='23514'; END IF;
   SELECT * INTO financial FROM treido.order_financial_policies WHERE id=sp.financial_policy_id AND method='shipping' AND approved_at<=clock_timestamp() AND revoked_at IS NULL;
   IF c.id IS NULL OR sp.id IS NULL OR rate.id IS NULL OR financial.id IS NULL OR c.snapshot->>'language' IS DISTINCT FROM q.language OR c.snapshot->'source' IS DISTINCT FROM q.source OR sp.environment IS DISTINCT FROM p.environment OR sp.application_id IS DISTINCT FROM p.application_id OR q.expires_at>rate.valid_until OR sp.payload->>'quoteValidity'<>'original_allocation_within_tariff' OR q.buyer_fee_minor<>0 OR sp.payload->>'taxBasis'<>'inclusive_unspecified' OR NOT treido.order_shipping_quote_ready(sp.id,sp.environment,sp.application_id) THEN RAISE EXCEPTION 'Original qualified shipping quote unavailable' USING ERRCODE='23514'; END IF;
   expected:=jsonb_build_object('format','goods-shipping-v1','choice',jsonb_build_object('id',c.id,'revision',c.revision-1,'snapshotHash',c.snapshot_hash,'acknowledged',true),'policyId',sp.id,'policyVersion',sp.version,'policyHash',sp.terms_hash,'financialPolicyId',sp.financial_policy_id,'carrierBindingId',c.snapshot->'option'->'binding'->'id','carrierBindingHash',c.snapshot->'option'->'binding'->'bindingHash','rateId',rate.id,'rateHash',rate.rate_hash,'recipientRef',c.id,'country',c.snapshot->'country','method','shipping','sourceHash',c.snapshot->'sourceHash','costs',c.snapshot->'option'->'costs','shippingRefund',sp.payload->'shippingRefund','terms',sp.payload->'terms'->q.language,'rights',sp.payload->'rights'->q.language,'refundTerms',sp.payload->'refundTerms'->q.language,'taxDescription',sp.payload->'taxDescription'->q.language,'recipientPurpose',sp.payload->'recipientPurpose'->q.language,'retentionDescription',sp.payload->'retentionDescription'->q.language,'aftercare',jsonb_build_object('policyId',financial.id,'version',financial.version,'termsHash',financial.terms_hash,'acknowledged',true,'buyerTerms',financial.terms->q.language));
   IF q.terms_snapshot->'shipping' IS DISTINCT FROM expected OR q.delivery_minor IS DISTINCT FROM (rate.payload->>'shippingMinor')::integer OR q.total_minor IS DISTINCT FROM (c.snapshot->'option'->'costs'->>'totalMinor')::integer OR NOT EXISTS(SELECT 1 FROM treido.quote_aftercare_acceptances ac WHERE ac.quote_id=q.id AND ac.buyer_id=q.buyer_id AND ac.seller_id=q.seller_id AND ac.policy_id=financial.id AND ac.version=financial.version AND ac.terms_hash=financial.terms_hash AND ac.method='shipping' AND ac.language=q.language) THEN RAISE EXCEPTION 'Original shipping component or acceptance mismatch' USING ERRCODE='23514'; END IF;
   commission:=amount+CASE WHEN sp.payload->>'commissionBasis'='merchandise_and_shipping' THEN q.delivery_minor ELSE 0 END;
   expected_fee:=((commission*p.fee_bps+5000)/10000+p.fee_fixed_minor);
  ELSIF q.terms_snapshot->>'handover' IS DISTINCT FROM 'pickup' OR q.delivery_minor<>0 OR q.buyer_fee_minor<>0 OR q.terms_snapshot ? 'shipping' THEN RAISE EXCEPTION 'Original pickup contract mismatch' USING ERRCODE='23514'; END IF;
  IF a.buyer_id<>q.buyer_id OR a.seller_id<>q.seller_id OR a.expires_at<>q.expires_at OR n NOT BETWEEN 1 AND 30 OR amount<>q.total_minor-q.delivery_minor-q.buyer_fee_minor
    OR b.platform_account<>q.platform_account OR b.livemode<>q.livemode OR b.connected_account<>q.connected_account
    OR q.application_fee_minor<>expected_fee
    OR q.terms_snapshot->>'settlementMerchant' IS DISTINCT FROM p.settlement_merchant
    OR q.terms_snapshot->>'buyerTerms' IS DISTINCT FROM p.buyer_terms->>q.language
    OR EXISTS(SELECT 1 FROM (SELECT * FROM treido.payable_quote_lines WHERE quote_id=q.id) l FULL JOIN (SELECT * FROM treido.inventory_allocation_lines WHERE allocation_id=q.allocation_id) al ON al.sku_id=l.sku_id
      WHERE (l.quote_id IS DISTINCT FROM q.id OR al.allocation_id IS DISTINCT FROM q.allocation_id
       OR l.seller_id IS DISTINCT FROM al.seller_id OR l.listing_id IS DISTINCT FROM al.listing_id OR l.quantity IS DISTINCT FROM al.quantity OR l.unit_price_minor IS DISTINCT FROM al.unit_price_minor OR l.publication_revision IS DISTINCT FROM al.publication_revision OR al.currency<>'EUR'))
  THEN RAISE EXCEPTION 'Immutable quote/allocation mismatch'; END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION treido.guard_order_shipping_refund_component() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE r treido.order_refund_intents; q treido.payable_quotes; f treido.order_fulfilments; stage text; revision integer;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Original shipping refund component is immutable' USING ERRCODE='23514'; END IF;
 SELECT * INTO r FROM treido.order_refund_intents WHERE id=NEW.intent_id;
 SELECT * INTO q FROM treido.payable_quotes WHERE id=r.quote_id;
 PERFORM 1 FROM treido.inventory_allocations WHERE id=q.allocation_id FOR UPDATE;
 PERFORM 1 FROM treido.paid_orders WHERE id=r.order_id FOR UPDATE;
 SELECT * INTO f FROM treido.order_fulfilments WHERE order_id=r.order_id FOR UPDATE;
 stage:=CASE WHEN f.order_id IS NULL OR f.state='pending' THEN 'before_dispatch' WHEN f.state IN('seller_reported_dispatched','buyer_confirmed_delivery') THEN 'after_dispatch' ELSE NULL END;revision:=coalesce(f.revision,0);
 IF r.id IS NULL OR q.id IS NULL OR r.state<>'prepared' OR r.first_attempt_at IS NOT NULL OR NEW.quote_id<>q.id OR q.terms_snapshot->>'handover' IS DISTINCT FROM 'shipping' OR NEW.fulfilment_stage IS DISTINCT FROM stage OR NEW.fulfilment_revision<>revision OR (f.order_id IS NOT NULL AND f.method<>'shipping') OR q.terms_snapshot->'shipping'->'shippingRefund'->>(CASE stage WHEN 'before_dispatch' THEN 'beforeDispatch' ELSE 'afterDispatch' END) IS DISTINCT FROM 'refundable' THEN RAISE EXCEPTION 'Accepted shipping refund disposition unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipping_refund_component_original BEFORE INSERT OR UPDATE OR DELETE ON treido.order_refund_shipping_components FOR EACH ROW EXECUTE FUNCTION treido.guard_order_shipping_refund_component();
CREATE OR REPLACE FUNCTION treido.check_order_refund_budget() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE target uuid; o treido.paid_orders%ROWTYPE; q treido.payable_quotes%ROWTYPE; allocation uuid; gross bigint; fees bigint; legacy bigint;
BEGIN
 IF TG_TABLE_NAME IN('order_refund_lines','order_refund_shipping_components') THEN SELECT order_id INTO target FROM treido.order_refund_intents WHERE id=NEW.intent_id;
 ELSE target:=NEW.order_id; END IF;
 SELECT p.allocation_id INTO allocation FROM treido.paid_orders x JOIN treido.payable_quotes p ON p.id=x.quote_id WHERE x.id=target;
 PERFORM id FROM treido.inventory_allocations WHERE id=allocation FOR UPDATE;
 SELECT * INTO o FROM treido.paid_orders WHERE id=target FOR UPDATE;
 SELECT * INTO q FROM treido.payable_quotes WHERE id=o.quote_id;
 IF o.id IS NULL OR q.id IS NULL THEN RAISE EXCEPTION 'Original refund order missing' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(amount_minor),0),coalesce(sum(fee_minor),0) INTO gross,fees FROM treido.order_refund_intents WHERE order_id=target AND state<>'expired';
 SELECT coalesce(sum(q.total_minor),0) INTO legacy FROM treido.payment_refunds r WHERE r.order_id=target;
 IF gross+legacy>q.total_minor OR fees>q.application_fee_minor OR (legacy>0 AND gross>0) THEN RAISE EXCEPTION 'Original refund balance already reserved' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM treido.order_refund_intents r JOIN treido.order_financial_policies p ON p.id=r.policy_id WHERE r.order_id=target GROUP BY p.refund_request_limit HAVING count(*)>p.refund_request_limit) THEN RAISE EXCEPTION 'Reviewed refund request limit exceeded' USING ERRCODE='23514'; END IF;
 IF (SELECT count(*) FROM treido.order_refund_intents WHERE order_id=target AND state NOT IN ('succeeded','expired'))>1 THEN RAISE EXCEPTION 'Uncertain refund must reconcile first' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM treido.order_refund_intents r LEFT JOIN treido.quote_aftercare_acceptances ac ON ac.quote_id=r.quote_id WHERE r.order_id=target AND (r.quote_id<>o.quote_id OR r.seller_id<>o.seller_id OR r.buyer_id<>o.buyer_id OR r.policy_id IS DISTINCT FROM ac.policy_id OR r.platform_account<>q.platform_account OR r.livemode<>q.livemode OR r.connected_account<>q.connected_account OR r.payment_intent_id IS DISTINCT FROM (SELECT provider_id FROM treido.payment_attempts WHERE id=o.attempt_id) OR r.case_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM treido.order_cases c WHERE c.id=r.case_id AND c.order_id=target) OR r.amount_minor IS DISTINCT FROM ((SELECT coalesce(sum(l.amount_minor),0) FROM treido.order_refund_lines l WHERE l.intent_id=r.id)+(SELECT coalesce(sum(s.amount_minor),0) FROM treido.order_refund_shipping_components s WHERE s.intent_id=r.id)) OR r.fee_minor IS DISTINCT FROM ((SELECT coalesce(sum(l.fee_minor),0) FROM treido.order_refund_lines l WHERE l.intent_id=r.id)+(SELECT coalesce(sum(s.fee_minor),0) FROM treido.order_refund_shipping_components s WHERE s.intent_id=r.id)))) THEN RAISE EXCEPTION 'Refund differs from immutable order lines' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM treido.order_refund_lines l JOIN treido.order_refund_intents r ON r.id=l.intent_id JOIN treido.payable_quote_lines line ON line.quote_id=l.quote_id AND line.sku_id=l.sku_id WHERE r.order_id=target AND (l.quote_id<>r.quote_id OR l.from_quantity+l.quantity>line.quantity OR l.amount_minor::bigint<>l.quantity::bigint*line.unit_price_minor OR l.fee_minor<>floor(((coalesce((SELECT sum(prev.quantity::bigint*prev.unit_price_minor) FROM treido.payable_quote_lines prev WHERE prev.quote_id=q.id AND prev.position<line.position),0)+(l.from_quantity+l.quantity)::numeric*line.unit_price_minor)*q.application_fee_minor+floor(q.total_minor/2))/q.total_minor)-floor(((coalesce((SELECT sum(prev.quantity::bigint*prev.unit_price_minor) FROM treido.payable_quote_lines prev WHERE prev.quote_id=q.id AND prev.position<line.position),0)+l.from_quantity::numeric*line.unit_price_minor)*q.application_fee_minor+floor(q.total_minor/2))/q.total_minor))) THEN RAISE EXCEPTION 'Refund line amount or original fee share differs' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM treido.order_refund_shipping_components s JOIN treido.order_refund_intents r ON r.id=s.intent_id WHERE r.order_id=target AND (s.quote_id<>q.id OR q.terms_snapshot->>'handover'<>'shipping' OR s.amount_minor<>q.delivery_minor OR s.fee_minor<>q.application_fee_minor-floor(((q.total_minor-q.delivery_minor)::numeric*q.application_fee_minor+floor(q.total_minor/2))/q.total_minor) OR q.buyer_fee_minor<>0)) OR (SELECT count(*) FROM treido.order_refund_shipping_components s JOIN treido.order_refund_intents r ON r.id=s.intent_id WHERE r.order_id=target AND r.state<>'expired')>1 THEN RAISE EXCEPTION 'Original shipping component cannot be over-refunded or reserved twice' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM treido.order_refund_lines l JOIN treido.order_refund_intents r ON r.id=l.intent_id WHERE r.order_id=target AND r.state<>'expired' GROUP BY l.sku_id HAVING max(l.from_quantity+l.quantity)<>sum(l.quantity)) OR EXISTS(SELECT 1 FROM treido.order_refund_lines a JOIN treido.order_refund_intents ra ON ra.id=a.intent_id JOIN treido.order_refund_lines b ON b.quote_id=a.quote_id AND b.sku_id=a.sku_id AND b.intent_id>a.intent_id JOIN treido.order_refund_intents rb ON rb.id=b.intent_id WHERE ra.order_id=target AND ra.state<>'expired' AND rb.state<>'expired' AND int8range(a.from_quantity::bigint,(a.from_quantity+a.quantity)::bigint,'[)') && int8range(b.from_quantity::bigint,(b.from_quantity+b.quantity)::bigint,'[)')) THEN RAISE EXCEPTION 'Original units cannot be refunded twice or skipped' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER shipping_refund_budget AFTER INSERT ON treido.order_refund_shipping_components DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION treido.check_order_refund_budget();
CREATE FUNCTION treido.guard_order_shipping_legacy() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE method text;
BEGIN
 IF TG_TABLE_NAME='payment_refunds' THEN SELECT q.terms_snapshot->>'handover' INTO method FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id WHERE o.id=NEW.order_id;
 IF method='shipping' THEN RAISE EXCEPTION 'Shipping requires accepted component refund controls' USING ERRCODE='23514'; END IF;
 ELSE SELECT terms_snapshot->>'handover' INTO method FROM treido.payable_quotes WHERE id=NEW.quote_id;
 IF method='shipping' AND NEW.fulfilment_state IN('ready','collected') THEN RAISE EXCEPTION 'Shipping cannot use pickup controls' USING ERRCODE='23514'; END IF;END IF;RETURN NEW;
END $$;
CREATE TRIGGER shipping_legacy_refund_denied BEFORE INSERT ON treido.payment_refunds FOR EACH ROW EXECUTE FUNCTION treido.guard_order_shipping_legacy();
CREATE TRIGGER shipping_legacy_pickup_denied BEFORE INSERT OR UPDATE ON treido.paid_orders FOR EACH ROW EXECUTE FUNCTION treido.guard_order_shipping_legacy();
REVOKE ALL ON treido.order_refund_shipping_components FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.guard_order_shipping_refund_component(),treido.guard_order_shipping_legacy() FROM PUBLIC;
