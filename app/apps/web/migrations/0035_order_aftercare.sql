-- ORIGINAL UNNUMBERED T64 proposal. No approved policy, account, order or provider seed.
CREATE TABLE treido.order_service_policies(
 id uuid PRIMARY KEY, base_policy_id uuid NOT NULL REFERENCES treido.payment_policies(id), version integer NOT NULL CHECK(version>0),
 terms jsonb NOT NULL, terms_hash varchar(64) NOT NULL CHECK(terms_hash~'^[a-f0-9]{64}$'),
 retention_description jsonb NOT NULL CHECK(coalesce(jsonb_typeof(retention_description->'bg')='string' AND jsonb_typeof(retention_description->'en')='string' AND length(retention_description->>'bg') BETWEEN 1 AND 2000 AND length(retention_description->>'en') BETWEEN 1 AND 2000,false)),
 case_limit integer NOT NULL CHECK(case_limit BETWEEN 1 AND 5), event_limit integer NOT NULL CHECK(event_limit BETWEEN 1 AND 500), appeal_seconds integer CHECK(appeal_seconds BETWEEN 1 AND 31536000),
 platform_account text NOT NULL CHECK(platform_account~'^acct_[A-Za-z0-9]+$'), livemode boolean NOT NULL, environment text NOT NULL CHECK(environment IN ('development','test','preview','production')), application_id text NOT NULL CHECK(application_id~'^[a-z][a-z0-9-]{1,79}$'), approved_at timestamptz NOT NULL, approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200), revoked_at timestamptz, CHECK(revoked_at IS NULL OR revoked_at>=approved_at), CHECK(coalesce(jsonb_typeof(terms)='object' AND jsonb_typeof(terms->'bg')='string' AND jsonb_typeof(terms->'en')='string' AND length(terms->>'bg') BETWEEN 1 AND 5000 AND length(terms->>'en') BETWEEN 1 AND 5000,false)), UNIQUE(base_policy_id,version)
);
CREATE TABLE treido.order_financial_policies(
 id uuid PRIMARY KEY, base_policy_id uuid NOT NULL REFERENCES treido.payment_policies(id), version integer NOT NULL CHECK(version>0),
 purpose text NOT NULL CHECK(purpose='goods_aftercare_v2'), method text NOT NULL CHECK(method IN ('pickup','shipping')),
 refund_contract text NOT NULL CHECK(refund_contract='bounded_partial_v2'), terms jsonb NOT NULL, terms_hash varchar(64) NOT NULL CHECK(terms_hash~'^[a-f0-9]{64}$'),
 execution_seconds integer NOT NULL CHECK(execution_seconds BETWEEN 60 AND 86400),refund_request_limit integer NOT NULL CHECK(refund_request_limit BETWEEN 1 AND 30),
 tax_basis text NOT NULL CHECK(tax_basis='inclusive_unspecified'), fee_basis text NOT NULL CHECK(fee_basis='original_proportional_provider_reversal'),
 reverse_transfer boolean NOT NULL CHECK(reverse_transfer), refund_application_fee boolean NOT NULL CHECK(refund_application_fee),
 tracking_allowed boolean NOT NULL, recipient_retention_description jsonb NOT NULL CHECK(coalesce(jsonb_typeof(recipient_retention_description->'bg')='string' AND jsonb_typeof(recipient_retention_description->'en')='string',false)),
 platform_account text NOT NULL CHECK(platform_account~'^acct_[A-Za-z0-9]+$'), livemode boolean NOT NULL, environment text NOT NULL CHECK(environment IN ('development','test','preview','production')), application_id text NOT NULL CHECK(application_id~'^[a-z][a-z0-9-]{1,79}$'), approved_at timestamptz NOT NULL, approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200), revoked_at timestamptz, CHECK(revoked_at IS NULL OR revoked_at>=approved_at), CHECK(coalesce(jsonb_typeof(terms)='object' AND jsonb_typeof(terms->'bg')='string' AND jsonb_typeof(terms->'en')='string' AND length(terms->>'bg') BETWEEN 1 AND 5000 AND length(terms->>'en') BETWEEN 1 AND 5000,false)), UNIQUE(base_policy_id,version),CHECK(NOT tracking_allowed OR method='shipping')
);
CREATE TABLE treido.quote_aftercare_acceptances(
 quote_id uuid PRIMARY KEY REFERENCES treido.payable_quotes(id), policy_id uuid NOT NULL REFERENCES treido.order_financial_policies(id),
 buyer_id uuid NOT NULL REFERENCES treido.users(id), seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
 version integer NOT NULL CHECK(version>0), terms_hash varchar(64) NOT NULL CHECK(terms_hash~'^[a-f0-9]{64}$'),
 choice_hash varchar(64) NOT NULL CHECK(choice_hash~'^[a-f0-9]{64}$'), method text NOT NULL CHECK(method IN ('pickup','shipping')),
 language text NOT NULL CHECK(language IN ('bg','en')),accepted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE treido.order_cases(
 id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES treido.paid_orders(id),buyer_id uuid NOT NULL REFERENCES treido.users(id),seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
 policy_id uuid NOT NULL REFERENCES treido.order_service_policies(id),reason text NOT NULL CHECK(reason IN ('handover','item_condition','refund_question','other')),
 state text NOT NULL CHECK(state IN ('open','awaiting_buyer','review_requested','reviewed','resolved')),revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 appeal_until timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,order_id)
);
CREATE TABLE treido.order_case_events(
 id uuid PRIMARY KEY,case_id uuid NOT NULL REFERENCES treido.order_cases(id),actor_id uuid NOT NULL REFERENCES treido.users(id),
 side text NOT NULL CHECK(side IN ('buyer','merchant','operator')),kind text NOT NULL CHECK(kind IN ('open','message','propose','accept','reopen','escalate','appeal','operator_recommendation','operator_information','operator_no_decision')),
 body text NOT NULL CHECK(length(body)<=2000),evidence jsonb NOT NULL CHECK(coalesce(jsonb_typeof(evidence)='array' AND jsonb_array_length(evidence)<=4,false)),
 accepted_revision integer NOT NULL CHECK(accepted_revision>=0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(case_id,accepted_revision)
);
CREATE TABLE treido.order_aftercare_receipts(
 order_id uuid NOT NULL REFERENCES treido.paid_orders(id),actor_id uuid NOT NULL REFERENCES treido.users(id),request_id uuid NOT NULL,
 input_hash varchar(64) NOT NULL CHECK(input_hash~'^[a-f0-9]{64}$'),action text NOT NULL,case_id uuid REFERENCES treido.order_cases(id),
 intent_id uuid,accepted_revision integer NOT NULL CHECK(accepted_revision>=0),accepted_state text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(order_id,actor_id,request_id)
);
CREATE TABLE treido.order_fulfilments(
 order_id uuid PRIMARY KEY REFERENCES treido.paid_orders(id),quote_id uuid NOT NULL REFERENCES treido.quote_aftercare_acceptances(quote_id),
 method text NOT NULL CHECK(method IN ('pickup','shipping')),state text NOT NULL CHECK(state IN ('pending','seller_reported_dispatched','buyer_confirmed_delivery','blocked')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),carrier text CHECK(length(carrier) BETWEEN 1 AND 80),tracking_reference text CHECK(length(tracking_reference) BETWEEN 1 AND 100),
 description text CHECK(length(description)<=500),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(method='shipping' OR (carrier IS NULL AND tracking_reference IS NULL)),CHECK(state<>'seller_reported_dispatched' OR (method='shipping' AND carrier IS NOT NULL AND tracking_reference IS NOT NULL))
);
CREATE TABLE treido.order_fulfilment_events(
 id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES treido.order_fulfilments(order_id),actor_id uuid NOT NULL REFERENCES treido.users(id),
 kind text NOT NULL CHECK(kind IN ('seller_reported_dispatched','buyer_confirmed_delivery')),description text NOT NULL CHECK(length(description) BETWEEN 1 AND 500),
 accepted_revision integer NOT NULL CHECK(accepted_revision>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(order_id,accepted_revision)
);
CREATE TABLE treido.order_refund_intents(
 id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES treido.paid_orders(id),quote_id uuid NOT NULL REFERENCES treido.quote_aftercare_acceptances(quote_id),
 policy_id uuid NOT NULL REFERENCES treido.order_financial_policies(id),seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),buyer_id uuid NOT NULL REFERENCES treido.users(id),actor_id uuid NOT NULL REFERENCES treido.users(id),
 case_id uuid REFERENCES treido.order_cases(id),request_id uuid NOT NULL,input_hash varchar(64) NOT NULL CHECK(input_hash~'^[a-f0-9]{64}$'),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),amount_minor integer NOT NULL CHECK(amount_minor BETWEEN 1 AND 99999999),fee_minor integer NOT NULL CHECK(fee_minor BETWEEN 0 AND amount_minor),
 currency text NOT NULL CHECK(currency='EUR'),tax_basis text NOT NULL CHECK(tax_basis='inclusive_unspecified'),
 platform_account text NOT NULL CHECK(platform_account~'^acct_[A-Za-z0-9]+$'),livemode boolean NOT NULL,environment text NOT NULL,application_id text NOT NULL,
 payment_intent_id text NOT NULL CHECK(payment_intent_id~'^pi_[A-Za-z0-9]+$'),charge_id text NOT NULL CHECK(charge_id~'^ch_[A-Za-z0-9]+$'),connected_account text NOT NULL CHECK(connected_account~'^acct_[A-Za-z0-9]+$'),
 api_version text NOT NULL CHECK(api_version='2026-09-30.endive'),operation_key text NOT NULL UNIQUE CHECK(length(operation_key) BETWEEN 1 AND 200),
 parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object'),parameter_hash varchar(64) NOT NULL CHECK(parameter_hash~'^[a-f0-9]{64}$'),expires_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('prepared','creating','pending','reconciling','succeeded','remedy_required','expired')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),first_attempt_at timestamptz,provider_id text UNIQUE CHECK(provider_id IS NULL OR provider_id~'^re_[A-Za-z0-9]+$'),
 provider_status text CHECK(provider_status IN ('pending','requires_action','succeeded','failed','canceled')),settlement_state text NOT NULL DEFAULT 'unobserved' CHECK(settlement_state IN ('unobserved','verified','reconciling','remedy_required')),
 generation integer NOT NULL DEFAULT 0 CHECK(generation>=0),reconcile_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(order_id,actor_id,request_id),CHECK(expires_at>created_at),CHECK(state<>'expired' OR (first_attempt_at IS NULL AND provider_id IS NULL)),CHECK(first_attempt_at IS NULL OR first_attempt_at<=expires_at)
);
ALTER TABLE treido.order_aftercare_receipts ADD CONSTRAINT order_aftercare_intent_reference FOREIGN KEY(intent_id) REFERENCES treido.order_refund_intents(id);
CREATE TABLE treido.order_refund_lines(
 intent_id uuid NOT NULL REFERENCES treido.order_refund_intents(id),quote_id uuid NOT NULL,sku_id uuid NOT NULL,from_quantity integer NOT NULL CHECK(from_quantity>=0),quantity integer NOT NULL CHECK(quantity>0),
 amount_minor integer NOT NULL CHECK(amount_minor>0),fee_minor integer NOT NULL CHECK(fee_minor BETWEEN 0 AND amount_minor),tax_minor integer CHECK(tax_minor IS NULL),
 tax_basis text NOT NULL CHECK(tax_basis='inclusive_unspecified'),PRIMARY KEY(intent_id,sku_id),FOREIGN KEY(quote_id,sku_id) REFERENCES treido.payable_quote_lines(quote_id,sku_id)
);
CREATE TABLE treido.order_refund_observations(
 id uuid PRIMARY KEY,intent_id uuid NOT NULL REFERENCES treido.order_refund_intents(id),generation integer NOT NULL CHECK(generation>0),
 provider_id text,provider_status text,amount_minor integer NOT NULL CHECK(amount_minor>0),settlement_state text NOT NULL,
 refund_fact jsonb NOT NULL CHECK(jsonb_typeof(refund_fact)='object'),observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(intent_id,generation)
);
CREATE TABLE treido.order_aftercare_operator_grants(
 user_id uuid NOT NULL REFERENCES treido.users(id),capability text NOT NULL CHECK(capability IN ('cases.read','cases.decide','feedback.moderate')),
 environment text NOT NULL,application_id text NOT NULL,approved_at timestamptz NOT NULL,approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),revoked_at timestamptz,
 PRIMARY KEY(user_id,capability,environment,application_id),CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE INDEX order_case_scope ON treido.order_cases(order_id,created_at DESC,id DESC);
CREATE INDEX order_case_events_scope ON treido.order_case_events(case_id,accepted_revision DESC);
CREATE INDEX order_refund_repair ON treido.order_refund_intents(reconcile_at,id) WHERE state IN ('prepared','creating','pending','reconciling');
CREATE FUNCTION treido.guard_order_aftercare_registry() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Approved aftercare registry history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) OR (NEW.revoked_at IS NOT NULL AND NEW.revoked_at<OLD.approved_at) THEN RAISE EXCEPTION 'Approved aftercare registry is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_service_registry_immutable BEFORE UPDATE OR DELETE ON treido.order_service_policies FOR EACH ROW EXECUTE FUNCTION treido.guard_order_aftercare_registry();
CREATE TRIGGER order_financial_registry_immutable BEFORE UPDATE OR DELETE ON treido.order_financial_policies FOR EACH ROW EXECUTE FUNCTION treido.guard_order_aftercare_registry();
CREATE TRIGGER order_operator_registry_immutable BEFORE UPDATE OR DELETE ON treido.order_aftercare_operator_grants FOR EACH ROW EXECUTE FUNCTION treido.guard_order_aftercare_registry();
CREATE FUNCTION treido.lock_order_aftercare_registry(kind text,policy uuid,base uuid,platform text,mode boolean,env text,app text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
BEGIN
 IF kind='service' THEN PERFORM id FROM treido.order_service_policies WHERE id=policy AND base_policy_id=base AND platform_account=platform AND livemode=mode AND environment=env AND application_id=app AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 ELSIF kind='financial' THEN PERFORM id FROM treido.order_financial_policies WHERE id=policy AND base_policy_id=base AND platform_account=platform AND livemode=mode AND environment=env AND application_id=app AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 ELSE RAISE EXCEPTION 'Unsupported registry kind' USING ERRCODE='22023'; END IF;
 RETURN FOUND;
END $$;
CREATE FUNCTION treido.lock_order_aftercare_operator(human uuid,cap text,env text,app text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
BEGIN
 IF cap NOT IN ('cases.read','cases.decide','feedback.moderate') THEN RETURN false; END IF;
 PERFORM user_id FROM treido.order_aftercare_operator_grants WHERE user_id=human AND capability=cap AND environment=env AND application_id=app AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 RETURN FOUND;
END $$;
CREATE FUNCTION treido.guard_order_refund_intent() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['state','revision','first_attempt_at','provider_id','provider_status','settlement_state','generation','reconcile_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','revision','first_attempt_at','provider_id','provider_status','settlement_state','generation','reconcile_at','updated_at']) OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at) OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id) OR NEW.generation<OLD.generation OR NEW.revision<OLD.revision OR (OLD.first_attempt_at IS NULL AND NEW.first_attempt_at IS NOT NULL AND (OLD.state<>'prepared' OR NEW.state<>'creating' OR NEW.first_attempt_at>OLD.expires_at)) OR (NEW.state IN ('creating','pending','reconciling','succeeded','remedy_required') AND NEW.first_attempt_at IS NULL) OR (OLD.state IN ('succeeded','remedy_required','expired') AND NEW.state<>OLD.state) THEN RAISE EXCEPTION 'Original refund intent is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_refund_original_immutable BEFORE UPDATE ON treido.order_refund_intents FOR EACH ROW EXECUTE FUNCTION treido.guard_order_refund_intent();
CREATE FUNCTION treido.check_quote_aftercare_acceptance() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE q treido.payable_quotes%ROWTYPE; p treido.order_financial_policies%ROWTYPE;
BEGIN
 SELECT * INTO q FROM treido.payable_quotes WHERE id=NEW.quote_id;
 SELECT * INTO p FROM treido.order_financial_policies WHERE id=NEW.policy_id;
 IF q.id IS NULL OR p.id IS NULL OR q.buyer_id<>NEW.buyer_id OR q.seller_id<>NEW.seller_id OR q.policy_id<>p.base_policy_id OR p.version<>NEW.version OR p.terms_hash<>NEW.terms_hash OR p.method<>NEW.method OR q.language<>NEW.language OR q.platform_account<>p.platform_account OR q.livemode<>p.livemode OR p.approved_at>clock_timestamp() OR p.revoked_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM treido.payment_policies b WHERE b.id=q.policy_id AND b.environment=p.environment AND b.application_id=p.application_id) OR q.terms_snapshot->>'handover' IS DISTINCT FROM NEW.method OR NEW.accepted_at>q.expires_at OR q.terms_snapshot->'aftercare'->>'format' IS DISTINCT FROM 'goods-aftercare-acceptance-v2' OR q.terms_snapshot->'aftercare'->>'version' IS DISTINCT FROM NEW.version::text OR q.terms_snapshot->'aftercare'->>'method' IS DISTINCT FROM NEW.method OR q.terms_snapshot->'aftercare'->>'buyerTerms' IS DISTINCT FROM p.terms->>NEW.language OR q.terms_snapshot->'aftercare'->>'policyId' IS DISTINCT FROM NEW.policy_id::text OR q.terms_snapshot->'aftercare'->>'termsHash' IS DISTINCT FROM NEW.terms_hash OR q.terms_snapshot->'aftercare'->>'choiceHash' IS DISTINCT FROM NEW.choice_hash THEN RAISE EXCEPTION 'Aftercare acceptance differs from original quote' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER quote_aftercare_same_original AFTER INSERT ON treido.quote_aftercare_acceptances DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION treido.check_quote_aftercare_acceptance();
REVOKE ALL ON FUNCTION treido.guard_order_aftercare_registry(),treido.lock_order_aftercare_registry(text,uuid,uuid,text,boolean,text,text),treido.lock_order_aftercare_operator(uuid,text,text,text),treido.guard_order_refund_intent(),treido.check_quote_aftercare_acceptance() FROM PUBLIC;
REVOKE ALL ON treido.order_service_policies,treido.order_financial_policies,treido.quote_aftercare_acceptances,treido.order_cases,treido.order_case_events,treido.order_aftercare_receipts,treido.order_fulfilments,treido.order_fulfilment_events,treido.order_refund_intents,treido.order_refund_lines,treido.order_refund_observations,treido.order_aftercare_operator_grants FROM PUBLIC;

-- One allocation/order lock serializes old full refunds and every new line reservation.
CREATE FUNCTION treido.check_order_refund_budget() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE target uuid; o treido.paid_orders%ROWTYPE; q treido.payable_quotes%ROWTYPE; allocation uuid; gross bigint; fees bigint; legacy bigint;
BEGIN
 IF TG_TABLE_NAME='order_refund_lines' THEN SELECT order_id INTO target FROM treido.order_refund_intents WHERE id=NEW.intent_id;
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
 IF EXISTS(SELECT 1 FROM treido.order_refund_intents r LEFT JOIN treido.quote_aftercare_acceptances ac ON ac.quote_id=r.quote_id WHERE r.order_id=target AND (r.quote_id<>o.quote_id OR r.seller_id<>o.seller_id OR r.buyer_id<>o.buyer_id OR r.policy_id IS DISTINCT FROM ac.policy_id OR r.platform_account<>q.platform_account OR r.livemode<>q.livemode OR r.connected_account<>q.connected_account OR r.payment_intent_id IS DISTINCT FROM (SELECT provider_id FROM treido.payment_attempts WHERE id=o.attempt_id) OR r.case_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM treido.order_cases c WHERE c.id=r.case_id AND c.order_id=target) OR r.amount_minor IS DISTINCT FROM (SELECT sum(l.amount_minor) FROM treido.order_refund_lines l WHERE l.intent_id=r.id) OR r.fee_minor IS DISTINCT FROM (SELECT sum(l.fee_minor) FROM treido.order_refund_lines l WHERE l.intent_id=r.id))) THEN RAISE EXCEPTION 'Refund differs from immutable order lines' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM treido.order_refund_lines l JOIN treido.order_refund_intents r ON r.id=l.intent_id JOIN treido.payable_quote_lines line ON line.quote_id=l.quote_id AND line.sku_id=l.sku_id WHERE r.order_id=target AND (l.quote_id<>r.quote_id OR l.from_quantity+l.quantity>line.quantity OR l.amount_minor::bigint<>l.quantity::bigint*line.unit_price_minor OR l.fee_minor<>floor(((coalesce((SELECT sum(prev.quantity::bigint*prev.unit_price_minor) FROM treido.payable_quote_lines prev WHERE prev.quote_id=q.id AND prev.position<line.position),0)+(l.from_quantity+l.quantity)::numeric*line.unit_price_minor)*q.application_fee_minor+floor(q.total_minor/2))/q.total_minor)-floor(((coalesce((SELECT sum(prev.quantity::bigint*prev.unit_price_minor) FROM treido.payable_quote_lines prev WHERE prev.quote_id=q.id AND prev.position<line.position),0)+l.from_quantity::numeric*line.unit_price_minor)*q.application_fee_minor+floor(q.total_minor/2))/q.total_minor))) THEN RAISE EXCEPTION 'Refund line amount or original fee share differs' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM treido.order_refund_lines l JOIN treido.order_refund_intents r ON r.id=l.intent_id WHERE r.order_id=target AND r.state<>'expired' GROUP BY l.sku_id HAVING max(l.from_quantity+l.quantity)<>sum(l.quantity)) OR EXISTS(SELECT 1 FROM treido.order_refund_lines a JOIN treido.order_refund_intents ra ON ra.id=a.intent_id JOIN treido.order_refund_lines b ON b.quote_id=a.quote_id AND b.sku_id=a.sku_id AND b.intent_id>a.intent_id JOIN treido.order_refund_intents rb ON rb.id=b.intent_id WHERE ra.order_id=target AND ra.state<>'expired' AND rb.state<>'expired' AND int8range(a.from_quantity::bigint,(a.from_quantity+a.quantity)::bigint,'[)') && int8range(b.from_quantity::bigint,(b.from_quantity+b.quantity)::bigint,'[)')) THEN RAISE EXCEPTION 'Original units cannot be refunded twice or skipped' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER order_refund_budget_intent AFTER INSERT OR UPDATE ON treido.order_refund_intents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION treido.check_order_refund_budget();
CREATE CONSTRAINT TRIGGER order_refund_budget_lines AFTER INSERT ON treido.order_refund_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION treido.check_order_refund_budget();
CREATE CONSTRAINT TRIGGER order_refund_budget_legacy AFTER INSERT ON treido.payment_refunds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION treido.check_order_refund_budget();
CREATE FUNCTION treido.check_order_case_parent() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF NEW.state<>'open' OR NEW.revision<>0 OR NOT EXISTS(SELECT 1 FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id JOIN treido.order_service_policies p ON p.id=NEW.policy_id WHERE o.id=NEW.order_id AND o.buyer_id=NEW.buyer_id AND o.seller_id=NEW.seller_id AND p.base_policy_id=q.policy_id AND p.platform_account=q.platform_account AND p.livemode=q.livemode AND p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL) THEN RAISE EXCEPTION 'Case must reference original owned paid order and current policy' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_case_original_parent BEFORE INSERT ON treido.order_cases FOR EACH ROW EXECUTE FUNCTION treido.check_order_case_parent();
REVOKE ALL ON FUNCTION treido.check_order_refund_budget(),treido.check_order_case_parent() FROM PUBLIC;

CREATE FUNCTION treido.check_order_refund_initial() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF NEW.state<>'prepared' OR NEW.revision<>0 OR NEW.generation<>0 OR NEW.first_attempt_at IS NOT NULL OR NEW.provider_id IS NOT NULL OR NEW.provider_status IS NOT NULL OR NEW.settlement_state<>'unobserved' OR NOT EXISTS(SELECT 1 FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id JOIN treido.payment_policies b ON b.id=q.policy_id JOIN treido.order_financial_policies p ON p.id=NEW.policy_id JOIN treido.quote_aftercare_acceptances ac ON ac.quote_id=q.id AND ac.policy_id=p.id WHERE o.id=NEW.order_id AND o.payment_state='paid' AND o.settlement_state='transferred' AND o.buyer_id=NEW.buyer_id AND o.seller_id=NEW.seller_id AND q.id=NEW.quote_id AND p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL AND p.environment=NEW.environment AND p.application_id=NEW.application_id AND b.environment=NEW.environment AND b.application_id=NEW.application_id AND EXISTS(SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=o.attempt_id AND f.kind='charge' AND f.object_id=NEW.charge_id AND f.amount_minor=q.total_minor AND f.platform_account=q.platform_account AND f.livemode=q.livemode)) THEN RAISE EXCEPTION 'Refund requires original paid order and accepted current financial contract' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_refund_initial BEFORE INSERT ON treido.order_refund_intents FOR EACH ROW EXECUTE FUNCTION treido.check_order_refund_initial();
REVOKE ALL ON FUNCTION treido.check_order_refund_initial() FROM PUBLIC;
