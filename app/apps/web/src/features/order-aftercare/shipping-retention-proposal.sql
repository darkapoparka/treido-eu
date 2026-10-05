-- ORIGINAL T64 accepted-recipient retention proposal, UNNUMBERED/UNAPPLIED.
-- Install only after final original shipping producer ACK. No approval seed,
-- scheduler, provider effect, new allocation or replacement financial executor.
-- The original signed executor/finite kind/enqueue/closure registration and
-- producer's bound-clear guard integration remain mandatory canonical seams.
CREATE TABLE treido.order_shipping_retention_approvals(
 id uuid PRIMARY KEY, policy_id uuid NOT NULL REFERENCES treido.order_shipping_policies(id),
 policy_hash text NOT NULL CHECK(policy_hash~'^[a-f0-9]{64}$'),
 version text NOT NULL CHECK(version='order-shipping-retention-v1'),
 platform_account text NOT NULL CHECK(platform_account~'^acct_[A-Za-z0-9]+$'),
 livemode boolean NOT NULL, environment text NOT NULL CHECK(environment IN('development','test','preview','production')),
 application_id text NOT NULL CHECK(application_id~'^[a-z][a-z0-9-]{1,79}$'),
 executor_application_id text NOT NULL CHECK(executor_application_id~'^[a-z][a-z0-9-]{1,79}$'),
 executor_environment text NOT NULL CHECK(executor_environment~'^[a-z][a-z0-9-]{1,63}$'),
 clerk_instance_id text NOT NULL CHECK(length(clerk_instance_id) BETWEEN 1 AND 200),
 clerk_mode text NOT NULL CHECK(clerk_mode IN('test','live')),
 aftercare_lifecycle_version text NOT NULL CHECK(aftercare_lifecycle_version='order-aftercare-shipping-v2'),
 deletes_due_unbound boolean NOT NULL CHECK(deletes_due_unbound),
 deletes_due_accepted boolean NOT NULL CHECK(deletes_due_accepted),
 preserves_accepted_history boolean NOT NULL CHECK(preserves_accepted_history),
 requires_zero_obligations boolean NOT NULL CHECK(requires_zero_obligations),
 legal_holds_reviewed boolean NOT NULL CHECK(legal_holds_reviewed),
 approved_at timestamptz NOT NULL, approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),
 revoked_at timestamptz, CHECK(revoked_at IS NULL OR revoked_at>=approved_at),
 UNIQUE(policy_id,version,executor_application_id,executor_environment)
);
CREATE TRIGGER shipping_retention_approval_immutable BEFORE UPDATE OR DELETE ON treido.order_shipping_retention_approvals
 FOR EACH ROW EXECUTE FUNCTION treido.guard_order_aftercare_registry();

CREATE FUNCTION treido.order_shipping_retention_intent_hash(u uuid,c uuid) RETURNS text
 LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT encode(sha256(convert_to('{"actorId":null,"authority":"shipping","buyerId":'||to_json(u)::text||',"kind":"shipping.recipient-expiry","operationKey":'||to_json(c)::text||',"resourceId":'||to_json(c)::text||',"sellerId":null}','UTF8')),'hex')
$$;

-- This function is a current fact check, not a browser/payment/refund authority.
-- A full refund must be authoritatively verified; a reason or local flag is not
-- sufficient. Unknown/prepared/failed refund reservations continue to hold.
CREATE OR REPLACE FUNCTION treido.order_shipping_never_emitted_quote_clear(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
 SELECT EXISTS(SELECT 1 FROM treido.order_shipping_choices choice JOIN treido.payable_quotes q ON q.id=choice.quote_id AND q.buyer_id=choice.buyer_id AND q.seller_id=choice.seller_id JOIN treido.inventory_allocations a ON a.id=q.allocation_id AND a.buyer_id=q.buyer_id AND a.seller_id=q.seller_id LEFT JOIN treido.payment_attempts p ON p.quote_id=q.id WHERE choice.id=c AND choice.state='bound' AND q.expires_at=a.expires_at AND q.expires_at<=clock_timestamp() AND a.state IN('expired','released') AND NOT EXISTS(SELECT 1 FROM treido.paid_orders o WHERE o.quote_id=q.id) AND (p.id IS NULL OR (p.state IN('prepared','cancelled') AND p.first_attempt_at IS NULL AND p.provider_id IS NULL AND NOT EXISTS(SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=p.id))))
$$;
CREATE FUNCTION treido.order_shipping_recipient_obligations_clear(c uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
 SELECT treido.order_shipping_never_emitted_quote_clear(c) OR coalesce((
 SELECT
  a.state='paid' AND a.provider_id IS NOT NULL
  AND EXISTS(SELECT 1 FROM treido.payment_facts fact WHERE fact.attempt_id=a.id AND fact.kind='charge' AND fact.platform_account=q.platform_account AND fact.livemode=q.livemode AND fact.currency='eur' AND fact.amount_minor=q.total_minor)
  AND (
   (o.payment_state='paid' AND o.settlement_state='transferred'
    AND EXISTS(SELECT 1 FROM treido.order_fulfilments f WHERE f.order_id=o.id AND f.quote_id=q.id AND f.method='shipping' AND f.state='buyer_confirmed_delivery'))
   OR
   (o.payment_state='refunded' AND o.settlement_state='reversed'
    AND q.total_minor=(
     coalesce((SELECT sum(i.amount_minor) FROM treido.order_refund_intents i WHERE i.order_id=o.id AND i.quote_id=q.id AND i.state='succeeded' AND i.provider_status='succeeded' AND i.settlement_state='verified' AND i.provider_id IS NOT NULL AND EXISTS(SELECT 1 FROM treido.order_refund_observations observed WHERE observed.intent_id=i.id AND observed.provider_id=i.provider_id AND observed.provider_status='succeeded' AND observed.settlement_state='verified' AND observed.amount_minor=i.amount_minor)),0)
     +coalesce(q.total_minor * (SELECT count(*) FROM treido.payment_refunds r WHERE r.order_id=o.id AND r.attempt_id=a.id AND r.state='succeeded' AND r.provider_id IS NOT NULL),0)))
  )
  AND NOT EXISTS(SELECT 1 FROM treido.order_cases case_record WHERE case_record.order_id=o.id AND case_record.state<>'resolved')
  AND NOT EXISTS(SELECT 1 FROM treido.order_refund_intents i WHERE i.order_id=o.id AND i.state<>'expired' AND (i.state<>'succeeded' OR i.provider_status IS DISTINCT FROM 'succeeded' OR i.settlement_state<>'verified'))
  AND NOT EXISTS(SELECT 1 FROM treido.payment_refunds r WHERE r.order_id=o.id AND r.state<>'succeeded')
 FROM treido.order_shipping_choices choice
 JOIN treido.payable_quotes q ON q.id=choice.quote_id AND q.buyer_id=choice.buyer_id AND q.seller_id=choice.seller_id
 JOIN treido.paid_orders o ON o.quote_id=q.id AND o.buyer_id=q.buyer_id AND o.seller_id=q.seller_id
 JOIN treido.payment_attempts a ON a.id=o.attempt_id AND a.quote_id=q.id
 WHERE choice.id=c AND choice.state='bound'
 ),false)
$$;

-- Prevent a concurrent owner legal hold INSERT from racing a private clear.
-- Lock order matches the original handler: buyer -> allocation -> order.
CREATE FUNCTION treido.order_shipping_serialize_legal_hold() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE buyer uuid; allocation uuid;
BEGIN
 IF NEW.user_id IS NOT NULL THEN
  PERFORM 1 FROM treido.users WHERE id=NEW.user_id FOR UPDATE;
 ELSE
  SELECT o.buyer_id,q.allocation_id INTO buyer,allocation FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id WHERE o.id=NEW.order_id;
  IF buyer IS NOT NULL THEN
   PERFORM 1 FROM treido.users WHERE id=buyer FOR UPDATE;
   PERFORM 1 FROM treido.inventory_allocations WHERE id=allocation FOR UPDATE;
   PERFORM 1 FROM treido.paid_orders WHERE id=NEW.order_id FOR UPDATE;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipping_retention_hold_serialization BEFORE INSERT ON treido.order_aftercare_legal_holds
 FOR EACH ROW EXECUTE FUNCTION treido.order_shipping_serialize_legal_hold();

CREATE FUNCTION treido.order_shipping_validate_recipient_job(j uuid,u uuid,c uuid,g integer,t uuid,executor_app text,executor_env text,backend_env text,clerk_app text,clerk_mode_value text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE choice treido.order_shipping_choices; private treido.order_shipping_recipients; q treido.payable_quotes;
 p treido.order_shipping_policies; acceptance treido.quote_aftercare_acceptances; approval treido.order_shipping_retention_approvals;
 allocation uuid; original_order uuid; ready boolean;
BEGIN
 IF j IS NULL OR u IS NULL OR c IS NULL OR g IS NULL OR g<1 OR t IS NULL OR executor_app IS NULL OR executor_env IS NULL OR backend_env IS NULL OR clerk_app IS NULL OR clerk_mode_value IS NULL THEN RAISE EXCEPTION 'Original accepted retention scope missing' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.users WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original recipient owner denied' USING ERRCODE='23514'; END IF;
 SELECT quoted.allocation_id,orders.id INTO allocation,original_order FROM treido.order_shipping_choices candidate JOIN treido.payable_quotes quoted ON quoted.id=candidate.quote_id LEFT JOIN treido.paid_orders orders ON orders.quote_id=quoted.id WHERE candidate.id=c AND candidate.buyer_id=u;
 IF allocation IS NULL THEN RAISE EXCEPTION 'Original accepted recipient allocation denied' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.inventory_allocations WHERE id=allocation FOR UPDATE;
 PERFORM 1 FROM treido.paid_orders WHERE id=original_order FOR UPDATE;
 SELECT * INTO choice FROM treido.order_shipping_choices WHERE id=c AND buyer_id=u FOR UPDATE;
 SELECT * INTO private FROM treido.order_shipping_recipients WHERE choice_id=c AND buyer_id=u FOR UPDATE;
 SELECT * INTO q FROM treido.payable_quotes WHERE id=choice.quote_id;
 IF choice.id IS NULL OR private.choice_id IS NULL OR q.id IS NULL OR choice.state<>'bound' OR choice.revision<>2 OR choice.bound_at IS NULL OR private.retain_until>clock_timestamp() OR q.buyer_id<>u OR q.seller_id<>choice.seller_id OR q.currency<>'EUR' OR q.language IS DISTINCT FROM choice.snapshot->>'language' OR q.source IS DISTINCT FROM choice.snapshot->'source' OR q.total_minor::text IS DISTINCT FROM choice.snapshot->'option'->'costs'->>'totalMinor' OR q.application_fee_minor::text IS DISTINCT FROM choice.snapshot->'option'->'costs'->>'applicationFeeMinor' OR q.terms_snapshot->>'handover' IS DISTINCT FROM 'shipping' OR q.terms_snapshot->'shipping'->>'recipientRef' IS DISTINCT FROM c::text OR q.terms_snapshot->'shipping'->'choice'->>'id' IS DISTINCT FROM c::text OR q.terms_snapshot->'shipping'->'choice'->>'revision' IS DISTINCT FROM '1' OR q.terms_snapshot->'shipping'->'choice'->>'snapshotHash' IS DISTINCT FROM choice.snapshot_hash OR q.terms_snapshot->'shipping'->'choice'->>'acknowledged' IS DISTINCT FROM 'true' OR NOT EXISTS(SELECT 1 FROM treido.inventory_allocations held WHERE held.id=q.allocation_id AND held.buyer_id=u AND held.seller_id=q.seller_id AND held.expires_at=q.expires_at AND ((original_order IS NOT NULL AND held.state='consumed' AND held.resolution_reference='stripe:'||(SELECT provider_id FROM treido.payment_attempts WHERE quote_id=q.id)) OR (original_order IS NULL AND treido.order_shipping_never_emitted_quote_clear(c)))) THEN RAISE EXCEPTION 'Original accepted recipient correlation denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO p FROM treido.order_shipping_policies WHERE id=(choice.snapshot->'option'->'policy'->>'id')::uuid AND terms_hash=choice.snapshot->'option'->'policy'->>'termsHash' AND platform_account=q.platform_account AND livemode=q.livemode AND environment=backend_env AND application_id=choice.snapshot->'option'->'policy'->>'applicationId' AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 IF p.id IS NULL OR private.retain_until IS DISTINCT FROM choice.bound_at+make_interval(secs=>(p.payload->>'acceptedRecipientSeconds')::integer) THEN RAISE EXCEPTION 'Original immutable retention date unavailable' USING ERRCODE='55000'; END IF;
 SELECT * INTO approval FROM treido.order_shipping_retention_approvals WHERE policy_id=p.id AND policy_hash=p.terms_hash AND platform_account=p.platform_account AND livemode=p.livemode AND environment=p.environment AND application_id=p.application_id AND executor_application_id=executor_app AND executor_environment=executor_env AND clerk_instance_id=clerk_app AND clerk_mode=clerk_mode_value AND version='order-shipping-retention-v1' AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 IF approval.id IS NULL OR NOT approval.deletes_due_unbound OR NOT approval.deletes_due_accepted OR NOT approval.preserves_accepted_history OR NOT approval.requires_zero_obligations OR NOT approval.legal_holds_reviewed THEN RAISE EXCEPTION 'Reviewed accepted retention approval unavailable' USING ERRCODE='55000'; END IF;
 PERFORM 1 FROM treido.order_aftercare_lifecycle_policies lifecycle JOIN treido.account_lifecycle_bindings binding ON binding.environment=lifecycle.environment AND binding.application_id=lifecycle.application_id WHERE lifecycle.version=approval.aftercare_lifecycle_version AND lifecycle.environment=backend_env AND lifecycle.application_id=clerk_app AND lifecycle.preserves_accepted_evidence AND lifecycle.legal_holds_reviewed AND lifecycle.approved_at<=clock_timestamp() AND lifecycle.revoked_at IS NULL AND binding.clerk_instance_id=clerk_app AND binding.clerk_mode=clerk_mode_value AND binding.aftercare_lifecycle_version=lifecycle.version AND binding.closure_enabled AND binding.approved_at<=clock_timestamp() AND binding.revoked_at IS NULL FOR SHARE OF lifecycle,binding;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current accepted retention lifecycle unavailable' USING ERRCODE='55000'; END IF;
 IF to_regprocedure('treido.order_shipping_retention_ready(uuid,text,text)') IS NULL THEN RAISE EXCEPTION 'Original shipping lifecycle unregistered' USING ERRCODE='55000'; END IF;
 EXECUTE 'SELECT treido.order_shipping_retention_ready($1,$2,$3)' INTO ready USING p.id,p.environment,p.application_id;
 IF ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Original shipping lifecycle unavailable' USING ERRCODE='55000'; END IF;
 SELECT * INTO acceptance FROM treido.quote_aftercare_acceptances WHERE quote_id=q.id AND buyer_id=u AND seller_id=q.seller_id AND policy_id=p.financial_policy_id AND method='shipping' AND language=q.language;
 IF acceptance.quote_id IS NULL OR acceptance.version::text IS DISTINCT FROM choice.snapshot->'option'->'financial'->>'version' OR acceptance.terms_hash IS DISTINCT FROM choice.snapshot->'option'->'financial'->>'termsHash' OR q.terms_snapshot->'aftercare'->>'policyId' IS DISTINCT FROM acceptance.policy_id::text OR q.terms_snapshot->'aftercare'->>'version' IS DISTINCT FROM acceptance.version::text OR q.terms_snapshot->'aftercare'->>'termsHash' IS DISTINCT FROM acceptance.terms_hash THEN RAISE EXCEPTION 'Original accepted aftercare differs' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.order_financial_policies financial WHERE financial.id=acceptance.policy_id AND financial.version=acceptance.version AND financial.terms_hash=acceptance.terms_hash AND financial.method='shipping' AND financial.base_policy_id=q.policy_id AND financial.platform_account=q.platform_account AND financial.livemode=q.livemode AND financial.environment=p.environment AND financial.application_id=p.application_id AND financial.approved_at<=clock_timestamp() AND financial.revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current accepted financial policy unavailable' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM treido.order_aftercare_legal_holds hold WHERE hold.approved_at<=clock_timestamp() AND hold.revoked_at IS NULL AND (hold.user_id=u OR hold.order_id=original_order) AND ((hold.environment=backend_env AND hold.application_id=clerk_app) OR (hold.environment=p.environment AND hold.application_id=p.application_id))) OR NOT treido.order_shipping_recipient_obligations_clear(c) THEN RAISE EXCEPTION 'Original recipient evidence remains held' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM treido.outbox_jobs job JOIN treido.job_effects effect ON effect.job_id=job.id WHERE job.id=j AND job.kind='shipping.recipient-expiry' AND job.authority='shipping' AND job.seller_id IS NULL AND job.buyer_id=u AND job.actor_id IS NULL AND job.resource_id=c AND job.operation_key=c AND job.intent_hash=treido.order_shipping_retention_intent_hash(u,c) AND job.generation=g AND job.state IN('pending','accepted') AND effect.kind=job.kind AND effect.operation_key=job.operation_key AND effect.state='running' AND effect.execution_token=t AND effect.execution_until>clock_timestamp()) THEN RAISE EXCEPTION 'Actual original accepted retention lease denied' USING ERRCODE='23514'; END IF;
END $$;

-- The producer's original guard can call this ONLY when a bound value is being
-- cleared. Context alone grants nothing: the entire original live lease,
-- current namespace/approvals/due date/obligations are checked again.
CREATE FUNCTION treido.order_shipping_accepted_clear_allowed(c uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE j uuid; u uuid; original uuid; g integer; t uuid;
BEGIN
 j:=nullif(current_setting('treido.shipping_retention_job',true),'')::uuid;
 u:=nullif(current_setting('treido.shipping_retention_buyer',true),'')::uuid;
 original:=nullif(current_setting('treido.shipping_retention_choice',true),'')::uuid;
 g:=nullif(current_setting('treido.shipping_retention_generation',true),'')::integer;
 t:=nullif(current_setting('treido.shipping_retention_token',true),'')::uuid;
 IF original IS DISTINCT FROM c OR j IS NULL OR u IS NULL OR g IS NULL OR t IS NULL THEN RETURN false; END IF;
 PERFORM treido.order_shipping_validate_recipient_job(j,u,c,g,t,current_setting('treido.shipping_retention_executor_app',true),current_setting('treido.shipping_retention_executor_env',true),current_setting('treido.shipping_retention_backend_env',true),current_setting('treido.shipping_retention_clerk_app',true),current_setting('treido.shipping_retention_clerk_mode',true));
 RETURN true;
END $$;

CREATE FUNCTION treido.order_shipping_clear_accepted_recipient(j uuid,u uuid,c uuid,g integer,t uuid,executor_app text,executor_env text,backend_env text,clerk_app text,clerk_mode_value text) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
BEGIN
 PERFORM treido.order_shipping_validate_recipient_job(j,u,c,g,t,executor_app,executor_env,backend_env,clerk_app,clerk_mode_value);
 IF EXISTS(SELECT 1 FROM treido.order_shipping_recipients WHERE choice_id=c AND buyer_id=u AND value IS NULL AND cleared_at IS NOT NULL) THEN RETURN 'already_cleared'; END IF;
 PERFORM set_config('treido.shipping_retention_job',j::text,true),set_config('treido.shipping_retention_buyer',u::text,true),set_config('treido.shipping_retention_choice',c::text,true),set_config('treido.shipping_retention_generation',g::text,true),set_config('treido.shipping_retention_token',t::text,true),set_config('treido.shipping_retention_executor_app',executor_app,true),set_config('treido.shipping_retention_executor_env',executor_env,true),set_config('treido.shipping_retention_backend_env',backend_env,true),set_config('treido.shipping_retention_clerk_app',clerk_app,true),set_config('treido.shipping_retention_clerk_mode',clerk_mode_value,true);
 UPDATE treido.order_shipping_recipients SET value=NULL,cleared_at=clock_timestamp() WHERE choice_id=c AND buyer_id=u AND value IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original recipient removal conflict' USING ERRCODE='23514'; END IF;
 PERFORM set_config('treido.shipping_retention_job','',true),set_config('treido.shipping_retention_buyer','',true),set_config('treido.shipping_retention_choice','',true),set_config('treido.shipping_retention_generation','',true),set_config('treido.shipping_retention_token','',true),set_config('treido.shipping_retention_executor_app','',true),set_config('treido.shipping_retention_executor_env','',true),set_config('treido.shipping_retention_backend_env','',true),set_config('treido.shipping_retention_clerk_app','',true),set_config('treido.shipping_retention_clerk_mode','',true);
 -- Same transaction and lease; no term, row, source or financial record removed.
 RETURN 'cleared';
END $$;
REVOKE ALL ON treido.order_shipping_retention_approvals FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.order_shipping_never_emitted_quote_clear(uuid),treido.order_shipping_retention_intent_hash(uuid,uuid),treido.order_shipping_recipient_obligations_clear(uuid),treido.order_shipping_serialize_legal_hold(),treido.order_shipping_validate_recipient_job(uuid,uuid,uuid,integer,uuid,text,text,text,text,text),treido.order_shipping_accepted_clear_allowed(uuid),treido.order_shipping_clear_accepted_recipient(uuid,uuid,uuid,integer,uuid,text,text,text,text,text) FROM PUBLIC;
