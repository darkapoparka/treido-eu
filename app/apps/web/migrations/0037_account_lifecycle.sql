-- UNNUMBERED T65 proposal. T64 alone reviews, numbers, grants and applies.
-- No policy, retention deadline, provider approval, human or financial seed.
-- Required extension_facts(uuid) belongs to T63/T64, not a default zero stub.
CREATE TABLE treido.account_lifecycle_workspaces (
 user_id uuid PRIMARY KEY REFERENCES treido.users(id), revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 locale text CHECK(locale IN('bg','en')), browse_scope text CHECK(browse_scope IN('all','personal','business')),
 CHECK((locale IS NULL)=(browse_scope IS NULL))
);
CREATE TABLE treido.account_closure_policies (
 id uuid PRIMARY KEY, version text NOT NULL UNIQUE, payload jsonb NOT NULL,
 approved_at timestamptz NOT NULL, revoked_at timestamptz,
 CHECK((jsonb_typeof(payload)='object' AND payload->>'version'=version AND payload->'preservesAcceptedEvidence'='true'::jsonb AND payload->'reversibleBeforeEffects'='true'::jsonb AND jsonb_array_length(payload->'rules')=10 AND length(btrim(payload->>'approvalReference'))>0 AND octet_length(payload::text)<=100000) IS TRUE),
 CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE TABLE treido.account_lifecycle_bindings (
 id uuid PRIMARY KEY, environment text NOT NULL CHECK(environment IN('development','test','preview','production')), application_id text NOT NULL,
 clerk_instance_id text NOT NULL, clerk_mode text NOT NULL CHECK(clerk_mode IN('test','live')),
 media_scope varchar(64) CHECK(media_scope ~ '^[0-9a-f]{64}$'), media_unversioned boolean NOT NULL DEFAULT false,
 stripe_account text CHECK(stripe_account ~ '^acct_[A-Za-z0-9]+$'), stripe_livemode boolean, stripe_application_id text,
 assistant_lifecycle_version text NOT NULL, aftercare_lifecycle_version text NOT NULL,
 security_enabled boolean NOT NULL DEFAULT false, closure_enabled boolean NOT NULL DEFAULT false,
 approved_at timestamptz NOT NULL, revoked_at timestamptz,
 CHECK((stripe_account IS NULL)=(stripe_livemode IS NULL) AND (stripe_account IS NULL)=(stripe_application_id IS NULL)),
 CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE TABLE treido.account_execution_plans (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES treido.account_lifecycle_workspaces(user_id), closure_request_id uuid NOT NULL,
 policy_id uuid NOT NULL REFERENCES treido.account_closure_policies(id), binding_id uuid NOT NULL REFERENCES treido.account_lifecycle_bindings(id),
 plan_hash varchar(64) NOT NULL CHECK(plan_hash ~ '^[0-9a-f]{64}$'), payload jsonb NOT NULL,
 state text NOT NULL CHECK(state IN('reviewed','accepted','processing','blocked','reconciling','cancelled','completed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 accepted_at timestamptz, acceptance_key uuid, first_effect_at timestamptz, completed_at timestamptz,
 FOREIGN KEY(user_id,closure_request_id) REFERENCES treido.account_closure_requests(user_id,id), UNIQUE(user_id,id),
 CHECK((jsonb_typeof(payload)='object' AND payload->>'userId'=user_id::text AND payload->>'closureRequestId'=closure_request_id::text AND payload->>'policyId'=policy_id::text AND payload->>'bindingId'=binding_id::text AND jsonb_typeof(payload->'targets')='array' AND jsonb_array_length(payload->'targets')<=125 AND octet_length(payload::text)<=100000) IS TRUE),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '16 minutes'),
 CHECK((accepted_at IS NULL)=(acceptance_key IS NULL)), CHECK(first_effect_at IS NULL OR accepted_at IS NOT NULL), CHECK((state='completed')=(completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX account_one_execution ON treido.account_execution_plans(user_id) WHERE state IN('accepted','processing','blocked','reconciling');
CREATE INDEX account_execution_history ON treido.account_execution_plans(user_id,created_at DESC,id);
CREATE TABLE treido.account_lifecycle_status_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid NOT NULL REFERENCES treido.users(id),plan_id uuid,
 previous_status text NOT NULL,next_status text NOT NULL,cause text NOT NULL CHECK(cause IN('closure_claim','closure_cancel','closure_finish','external')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),FOREIGN KEY(user_id,plan_id) REFERENCES treido.account_execution_plans(user_id,id)
);
CREATE INDEX account_lifecycle_current_restriction ON treido.account_lifecycle_status_events(user_id,id DESC);
CREATE TABLE treido.account_lifecycle_effects (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES treido.users(id), plan_id uuid, binding_id uuid NOT NULL REFERENCES treido.account_lifecycle_bindings(id),
 subject text NOT NULL CHECK(subject ~ '^user_[A-Za-z0-9_-]{1,120}$'),
 kind text NOT NULL CHECK(kind IN('session.revoke','identity.delete','media.delete','billing.stop-renewal','data.remove')),
 target jsonb NOT NULL CHECK(jsonb_typeof(target)='object' AND octet_length(target::text)<=4096),
 target_hash varchar(64) NOT NULL CHECK(target_hash ~ '^[0-9a-f]{64}$'), operation_key uuid NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'prepared' CHECK(state IN('prepared','attempting','unknown','confirmed','blocked')),
 due_at timestamptz NOT NULL, first_attempt_at timestamptz, lease_token uuid, lease_until timestamptz, confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), FOREIGN KEY(user_id,plan_id) REFERENCES treido.account_execution_plans(user_id,id),
 UNIQUE(plan_id,kind,target_hash), CHECK(plan_id IS NOT NULL OR kind='session.revoke'),
 CHECK((lease_token IS NULL)=(lease_until IS NULL)), CHECK((state='confirmed')=(confirmed_at IS NOT NULL))
);
CREATE TABLE treido.account_lifecycle_receipts (
 user_id uuid NOT NULL REFERENCES treido.account_lifecycle_workspaces(user_id), request_id uuid NOT NULL,
 input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'), acknowledgment jsonb NOT NULL CHECK(jsonb_typeof(acknowledgment)='object' AND octet_length(acknowledgment::text)<=2048),
 accepted_revision integer NOT NULL CHECK(accepted_revision>0), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,request_id), UNIQUE(user_id,accepted_revision)
);
CREATE TABLE treido.account_effect_observations (
 effect_id uuid NOT NULL REFERENCES treido.account_lifecycle_effects(id), evidence_hash varchar(64) NOT NULL CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK(state IN('confirmed','unknown','blocked')), source text NOT NULL CHECK(source IN('provider','database')),
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(effect_id,evidence_hash)
);
CREATE UNIQUE INDEX account_one_pending_session_effect ON treido.account_lifecycle_effects(user_id,kind,target_hash) WHERE plan_id IS NULL AND state<>'confirmed';
CREATE FUNCTION treido.account_keep_registry() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable lifecycle registry' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN RAISE EXCEPTION 'Immutable lifecycle registry' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER account_policy_immutable BEFORE UPDATE OR DELETE ON treido.account_closure_policies FOR EACH ROW EXECUTE FUNCTION treido.account_keep_registry();
CREATE TRIGGER account_binding_immutable BEFORE UPDATE OR DELETE ON treido.account_lifecycle_bindings FOR EACH ROW EXECUTE FUNCTION treido.account_keep_registry();
CREATE FUNCTION treido.account_keep_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable closure plan' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-ARRAY['state','accepted_at','acceptance_key','first_effect_at','completed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','accepted_at','acceptance_key','first_effect_at','completed_at']) OR (OLD.acceptance_key IS NOT NULL AND NEW.acceptance_key IS DISTINCT FROM OLD.acceptance_key) OR (OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at) OR (OLD.first_effect_at IS NOT NULL AND NEW.first_effect_at IS DISTINCT FROM OLD.first_effect_at) THEN RAISE EXCEPTION 'Immutable closure plan' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER account_plan_immutable BEFORE UPDATE OR DELETE ON treido.account_execution_plans FOR EACH ROW EXECUTE FUNCTION treido.account_keep_plan();
CREATE FUNCTION treido.account_keep_effect() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable lifecycle effect' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-ARRAY['state','first_attempt_at','lease_token','lease_until','confirmed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','first_attempt_at','lease_token','lease_until','confirmed_at']) OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at) OR (OLD.state='confirmed' AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Immutable lifecycle effect' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER account_effect_immutable BEFORE UPDATE OR DELETE ON treido.account_lifecycle_effects FOR EACH ROW EXECUTE FUNCTION treido.account_keep_effect();
CREATE FUNCTION treido.account_keep_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$ BEGIN RAISE EXCEPTION 'Immutable lifecycle receipt' USING ERRCODE='23514'; END $$;
CREATE TRIGGER account_receipt_immutable BEFORE UPDATE OR DELETE ON treido.account_lifecycle_receipts FOR EACH ROW EXECUTE FUNCTION treido.account_keep_receipt();
CREATE TRIGGER account_observation_immutable BEFORE UPDATE OR DELETE ON treido.account_effect_observations FOR EACH ROW EXECUTE FUNCTION treido.account_keep_receipt();
CREATE TRIGGER account_status_event_immutable BEFORE UPDATE OR DELETE ON treido.account_lifecycle_status_events FOR EACH ROW EXECUTE FUNCTION treido.account_keep_receipt();
CREATE FUNCTION treido.account_record_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE marker text; plan treido.account_execution_plans; cause text:='external';
BEGIN
 marker:=current_setting('treido.account_closure_plan',true);
 IF marker IS NOT NULL AND marker ~ '^[0-9a-f-]{36}$' THEN
  SELECT * INTO plan FROM treido.account_execution_plans WHERE id=marker::uuid AND user_id=NEW.id;
  IF plan.accepted_at IS NOT NULL THEN
   IF OLD.status='active' AND NEW.status='restricted' AND plan.state='accepted' THEN cause:='closure_claim';
   ELSIF OLD.status='restricted' AND NEW.status='active' AND plan.first_effect_at IS NULL AND plan.state IN('accepted','blocked') THEN cause:='closure_cancel';
   ELSIF OLD.status='restricted' AND NEW.status='closed' AND plan.state IN('accepted','processing','blocked','reconciling') THEN cause:='closure_finish'; END IF;
  END IF;
 END IF;
 INSERT INTO treido.account_lifecycle_status_events(user_id,plan_id,previous_status,next_status,cause) VALUES(NEW.id,CASE WHEN cause='external' THEN NULL ELSE plan.id END,OLD.status,NEW.status,cause);
 RETURN NEW;
END $$;
-- Also records an explicit same-status security/operator restriction, which must prevent restoration.
CREATE TRIGGER account_lifecycle_status_guard AFTER UPDATE OF status ON treido.users FOR EACH ROW EXECUTE FUNCTION treido.account_record_status();
CREATE FUNCTION treido.account_lock_resources(u uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$ BEGIN
 PERFORM 1 FROM treido.seller_accounts s WHERE s.id IN(SELECT seller_id FROM treido.personal_seller_owners WHERE user_id=u UNION SELECT seller_id FROM treido.seller_memberships WHERE user_id=u AND status='active') ORDER BY s.id FOR UPDATE;
 PERFORM 1 FROM treido.seller_memberships m WHERE m.seller_id IN(SELECT seller_id FROM treido.seller_memberships WHERE user_id=u AND status='active') ORDER BY m.seller_id,m.user_id FOR UPDATE;
END $$;
CREATE FUNCTION treido.account_closure_obligations(u uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,treido AS $$
DECLARE x jsonb; f jsonb;
BEGIN
 x:=treido.account_closure_extension_facts(u);
 IF x IS NULL OR NOT(x ?& ARRAY['assistantRuns','aftercareCases','legalHolds']) OR EXISTS(SELECT 1 FROM jsonb_each_text(x) p WHERE p.key IN('assistantRuns','aftercareCases','legalHolds') AND (p.value IS NULL OR p.value !~ '^[0-9]+$')) THEN RAISE EXCEPTION 'Closure lifecycle extension unavailable' USING ERRCODE='55000'; END IF;
 WITH scope AS (SELECT seller_id FROM treido.personal_seller_owners WHERE user_id=u UNION SELECT seller_id FROM treido.seller_memberships WHERE user_id=u AND status='active' AND role='owner')
 SELECT jsonb_build_object(
 'soleBusinessOwners',(SELECT count(*) FROM treido.seller_memberships m WHERE m.user_id=u AND m.status='active' AND m.role='owner' AND NOT EXISTS(SELECT 1 FROM treido.seller_memberships o WHERE o.seller_id=m.seller_id AND o.user_id<>u AND o.role='owner' AND o.status='active')),
 'allocations',(SELECT count(*) FROM treido.inventory_allocations WHERE (buyer_id=u OR seller_id IN(SELECT seller_id FROM scope)) AND state IN('active','reconciliation')),
 'offers',(SELECT count(*) FROM treido.listing_offers WHERE (buyer_id=u OR seller_id IN(SELECT seller_id FROM scope)) AND state IN('pending','accepted')),
 'payments',(SELECT count(*) FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id AND q.seller_id=a.seller_id WHERE (q.buyer_id=u OR a.seller_id IN(SELECT seller_id FROM scope)) AND a.state NOT IN('cancelled','paid')),
 'orders',(SELECT count(*) FROM treido.paid_orders WHERE (buyer_id=u OR seller_id IN(SELECT seller_id FROM scope)) AND (payment_state IN('refund_pending','disputed','reconciliation') OR (payment_state<>'refunded' AND fulfilment_state<>'collected') OR settlement_state='reconciliation')),
 'refunds',(SELECT count(*) FROM treido.payment_refunds r JOIN treido.paid_orders o ON o.id=r.order_id AND o.seller_id=r.seller_id WHERE (o.buyer_id=u OR r.seller_id IN(SELECT seller_id FROM scope)) AND r.state NOT IN('succeeded','failed')),
 'cases',(SELECT count(*) FROM treido.reports r WHERE r.state='open' AND (r.reporter_id=u OR (r.resource_kind='listing' AND EXISTS(SELECT 1 FROM treido.listings l WHERE l.id=r.resource_id AND l.seller_id IN(SELECT seller_id FROM scope))) OR (r.resource_kind='message' AND EXISTS(SELECT 1 FROM treido.messages m WHERE m.id=r.resource_id AND m.author_id=u))))+(SELECT count(*) FROM treido.moderation_appeals a JOIN treido.moderation_actions action ON action.id=a.action_id JOIN treido.listings l ON l.id=action.listing_id WHERE (a.actor_id=u OR l.seller_id IN(SELECT seller_id FROM scope)) AND NOT EXISTS(SELECT 1 FROM treido.trust_case_decisions d WHERE d.appeal_id=a.id))+(x->>'aftercareCases')::bigint,
 'billingIntents',(SELECT count(*) FROM treido.billing_intents WHERE (actor_id=u OR seller_id IN(SELECT seller_id FROM scope)) AND operation IN('checkout','change','cancel') AND state IN('prepared','creating','reconciling','ready')),
 'billingInvoices',(SELECT count(*) FROM (SELECT DISTINCT ON(i.subscription_id,i.provider_id) i.status,i.paid FROM treido.billing_invoice_observations i JOIN treido.billing_subscriptions s ON s.id=i.subscription_id WHERE s.seller_id IN(SELECT seller_id FROM scope) ORDER BY i.subscription_id,i.provider_id,i.observed_at DESC,i.id DESC) latest WHERE NOT paid AND status NOT IN('void','uncollectible')),
 'promotionAttempts',(SELECT count(*) FROM treido.promotion_attempts WHERE seller_id IN(SELECT seller_id FROM scope) AND state IN('prepared','creating','reconciling','pending','quarantined')),
 'promotionReservations',(SELECT count(*) FROM treido.promotion_reservations r JOIN treido.promotion_campaigns c ON c.id=r.campaign_id WHERE c.seller_id IN(SELECT seller_id FROM scope) AND r.status<>'released'),
 'promotionRemedies',(SELECT count(*) FROM treido.promotion_remedy_reviews r JOIN treido.promotion_campaigns c ON c.id=r.campaign_id WHERE c.seller_id IN(SELECT seller_id FROM scope)),
 'mediaWriters',(SELECT count(*) FROM treido.media_storage_objects o JOIN treido.personal_seller_owners p ON p.seller_id=o.seller_id WHERE p.user_id=u AND o.state<>'deleted' AND (o.write_until>clock_timestamp() OR o.state='deleting')),
 'assistantRuns',(x->>'assistantRuns')::bigint,'sessionEffects',(SELECT count(*) FROM treido.account_lifecycle_effects WHERE user_id=u AND plan_id IS NULL AND state<>'confirmed'),'legalHolds',(x->>'legalHolds')::bigint) INTO f;
 RETURN f;
END $$;
CREATE FUNCTION treido.account_assert_clear(u uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_each_text(treido.account_closure_obligations(u)) p WHERE p.value IS NULL OR p.value::bigint<>0) THEN RAISE EXCEPTION 'Held closure obligations' USING ERRCODE='55000'; END IF;
END $$;
-- Cross-feature mutations are deliberately constrained to this exact accepted plan.
-- Canonical owner reviews additional lock order / restricted grants before enabling.
CREATE FUNCTION treido.account_accept_closure(u uuid,p uuid,h text,k uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE plan treido.account_execution_plans; current_status text;
BEGIN
 SELECT status INTO current_status FROM treido.users WHERE id=u FOR UPDATE;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE user_id=u AND id=p FOR UPDATE;
 IF current_status IS DISTINCT FROM 'active' OR plan.id IS NULL OR plan.plan_hash<>h OR plan.state<>'reviewed' OR plan.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Closure conflict' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.account_closure_requests WHERE user_id=u AND id=plan.closure_request_id AND state='requested' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Closure request withdrawn' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.account_closure_policies WHERE id=plan.policy_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND payload=plan.payload->'policy' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Closure policy unavailable' USING ERRCODE='55000'; END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings WHERE id=plan.binding_id AND closure_enabled AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND assistant_lifecycle_version=treido.account_closure_extension_facts(u)->>'assistantLifecycleVersion' AND aftercare_lifecycle_version=treido.account_closure_extension_facts(u)->>'aftercareLifecycleVersion' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Closure binding unavailable' USING ERRCODE='55000'; END IF;
 PERFORM treido.account_lock_resources(u);
 PERFORM treido.account_assert_clear(u);
 IF treido.account_closure_obligations(u) IS DISTINCT FROM plan.payload->'obligations' THEN RAISE EXCEPTION 'Changed closure facts' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.seller_accounts s JOIN treido.personal_seller_owners o ON o.seller_id=s.id WHERE o.user_id=u ORDER BY s.id FOR UPDATE OF s;
 PERFORM 1 FROM treido.seller_memberships WHERE user_id=u ORDER BY seller_id FOR UPDATE;
 UPDATE treido.account_execution_plans SET state='accepted',accepted_at=clock_timestamp(),acceptance_key=k WHERE id=p;
 PERFORM set_config('treido.account_closure_plan',p::text,true);
 UPDATE treido.users SET status='restricted' WHERE id=u AND status='active';
 PERFORM set_config('treido.account_closure_plan','',true);
 UPDATE treido.seller_accounts SET status='restricted',revision=revision+1 WHERE id IN(SELECT seller_id FROM treido.personal_seller_owners WHERE user_id=u) AND status='active';
 UPDATE treido.buyer_saved_searches SET status='paused',consent_at=NULL,due_at=NULL,consent_generation=consent_generation+1 WHERE user_id=u AND status='enabled';
 UPDATE treido.buyer_saved_search_runs SET state='cancelled' WHERE user_id=u AND state='running';
 DELETE FROM treido.account_privacy_exports WHERE user_id=u;
END $$;
CREATE FUNCTION treido.account_cancel_closure(u uuid,p uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE plan treido.account_execution_plans; current_status text;
BEGIN
 SELECT status INTO current_status FROM treido.users WHERE id=u FOR UPDATE;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=p AND user_id=u FOR UPDATE;
 IF plan.id IS NULL OR plan.state NOT IN('reviewed','accepted','blocked') OR plan.first_effect_at IS NOT NULL OR EXISTS(SELECT 1 FROM treido.account_lifecycle_effects WHERE plan_id=p AND first_attempt_at IS NOT NULL) THEN RAISE EXCEPTION 'Closure irreversible' USING ERRCODE='23514'; END IF;
 IF current_status IS DISTINCT FROM 'active' AND plan.accepted_at IS NULL THEN RAISE EXCEPTION 'Inactive closure recovery scope denied' USING ERRCODE='23514'; END IF;
 IF plan.accepted_at IS NOT NULL THEN
  PERFORM treido.account_lock_resources(u);PERFORM treido.account_assert_clear(u);
  IF treido.account_closure_extension_facts(u)->'mayRestoreClosureRestriction' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Reviewed restoration unavailable' USING ERRCODE='55000'; END IF;
  -- A closure receipt cannot override a later operator/security restriction.
  IF NOT EXISTS(SELECT 1 FROM (SELECT plan_id,cause FROM treido.account_lifecycle_status_events WHERE user_id=u ORDER BY id DESC LIMIT 1) current_event WHERE current_event.plan_id=p AND current_event.cause='closure_claim') THEN RAISE EXCEPTION 'A later restriction prevents restoration' USING ERRCODE='55000'; END IF;
  PERFORM set_config('treido.account_closure_plan',p::text,true);
  UPDATE treido.users SET status='active' WHERE id=u AND status='restricted';
  PERFORM set_config('treido.account_closure_plan','',true);
  UPDATE treido.seller_accounts s SET status='active',revision=s.revision+1 FROM jsonb_to_recordset(plan.payload->'personalSellers') AS original(id uuid,status text,revision integer) WHERE s.id=original.id AND original.status='active' AND s.status='restricted' AND s.revision=original.revision+1 AND EXISTS(SELECT 1 FROM treido.personal_seller_owners o WHERE o.seller_id=s.id AND o.user_id=u);
 END IF;
 UPDATE treido.account_execution_plans SET state='cancelled' WHERE id=p;
END $$;
-- No direct runtime source-account UPDATE or evidence DELETE is needed.
CREATE FUNCTION treido.account_claim_effect(e uuid,t uuid,j uuid,execution uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects; plan treido.account_execution_plans; status text; first_call boolean; current_object treido.media_storage_objects;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e;
 IF effect.id IS NULL THEN RAISE EXCEPTION 'Unknown lifecycle effect' USING ERRCODE='23514'; END IF;
 SELECT users.status INTO status FROM treido.users WHERE id=effect.user_id AND clerk_subject=effect.subject FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle subject mismatch' USING ERRCODE='23514'; END IF;
 IF effect.plan_id IS NOT NULL THEN
  SELECT * INTO plan FROM treido.account_execution_plans WHERE id=effect.plan_id AND user_id=effect.user_id FOR UPDATE;
  IF plan.accepted_at IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') OR effect.binding_id<>plan.binding_id OR effect.subject IS DISTINCT FROM plan.payload->>'subject' OR status<>'restricted' OR NOT EXISTS(SELECT 1 FROM treido.outbox_jobs o JOIN treido.job_effects f ON f.job_id=o.id WHERE o.id=j AND o.kind='account.closure' AND o.authority='closure' AND o.seller_id IS NULL AND o.buyer_id=effect.user_id AND o.actor_id IS NULL AND o.resource_id=plan.id AND o.operation_key=plan.acceptance_key AND f.state='running' AND f.execution_token=execution AND f.execution_until>clock_timestamp()) THEN RAISE EXCEPTION 'Closure lease authority denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF status<>'active' OR j IS NOT NULL OR execution IS NOT NULL THEN RAISE EXCEPTION 'Security authority denied' USING ERRCODE='23514'; END IF;
 END IF;
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e FOR UPDATE;
 IF effect.state='confirmed' THEN RETURN jsonb_build_object('claimed',false,'confirmed',true); END IF;
 IF effect.due_at>clock_timestamp() OR effect.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('claimed',false,'confirmed',false); END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings WHERE id=effect.binding_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND (CASE WHEN effect.plan_id IS NULL THEN security_enabled ELSE closure_enabled AND assistant_lifecycle_version=treido.account_closure_extension_facts(effect.user_id)->>'assistantLifecycleVersion' AND aftercare_lifecycle_version=treido.account_closure_extension_facts(effect.user_id)->>'aftercareLifecycleVersion' END) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle binding unavailable' USING ERRCODE='55000'; END IF;
 first_call:=effect.first_attempt_at IS NULL;
 IF effect.plan_id IS NOT NULL THEN
  PERFORM 1 FROM treido.account_closure_policies WHERE id=plan.policy_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND payload=plan.payload->'policy' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current closure policy unavailable' USING ERRCODE='55000'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') target WHERE target->>'kind'=effect.kind AND target->'target'=effect.target) THEN RAISE EXCEPTION 'Frozen plan authority denied' USING ERRCODE='23514'; END IF;
  IF effect.due_at<plan.accepted_at OR EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') target WHERE target->>'kind'=effect.kind AND target->'target'=effect.target AND effect.due_at<plan.accepted_at+make_interval(secs=>(target->>'dueSeconds')::integer)) THEN RAISE EXCEPTION 'Frozen handling deadline mismatch' USING ERRCODE='23514'; END IF;
  IF effect.kind='identity.delete' AND plan.payload->'policy'->>'identity'<>'delete' THEN RAISE EXCEPTION 'Identity removal policy denied' USING ERRCODE='23514'; END IF;
  IF effect.kind IN('identity.delete','media.delete','data.remove') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'policy'->'rules') rule WHERE rule->>'category'=CASE effect.kind WHEN 'identity.delete' THEN 'identity' WHEN 'media.delete' THEN CASE WHEN effect.target->>'ownerKind'='assistant' THEN 'assistantMedia' ELSE 'personalMedia' END ELSE effect.target->>'category' END AND rule->>'handling'='remove' AND rule->>'trigger'='closure' AND rule->>'delaySeconds' IS NOT NULL AND effect.due_at>=plan.accepted_at+make_interval(secs=>(rule->>'delaySeconds')::integer)) THEN RAISE EXCEPTION 'Reviewed handling rule denied' USING ERRCODE='23514'; END IF;
  IF first_call THEN PERFORM treido.account_lock_resources(effect.user_id);PERFORM treido.account_assert_clear(effect.user_id); END IF;
  IF effect.kind IN('identity.delete','session.revoke') AND EXISTS(SELECT 1 FROM treido.account_lifecycle_effects other WHERE other.plan_id=plan.id AND other.id<>e AND other.kind NOT IN('identity.delete','session.revoke') AND other.state<>'confirmed') THEN RETURN jsonb_build_object('claimed',false,'confirmed',false); END IF;
  IF effect.kind='identity.delete' AND EXISTS(SELECT 1 FROM treido.account_lifecycle_effects other WHERE other.plan_id=plan.id AND other.id<>e AND other.state<>'confirmed') THEN RETURN jsonb_build_object('claimed',false,'confirmed',false); END IF;
  UPDATE treido.account_execution_plans SET state='processing',first_effect_at=coalesce(first_effect_at,clock_timestamp()) WHERE id=plan.id;
 END IF;
 IF effect.kind='media.delete' THEN
  IF effect.target->>'ownerKind'='assistant' THEN
   IF treido.account_closure_claim_assistant_object(effect.user_id,effect.plan_id,e,t) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assistant object lifecycle held' USING ERRCODE='55000'; END IF;
  ELSE
  SELECT * INTO current_object FROM treido.media_storage_objects WHERE storage_scope=effect.target->>'storageScope' AND object_key=effect.target->>'objectKey' FOR UPDATE;
  IF current_object.asset_id::text IS DISTINCT FROM effect.target->>'assetId' OR current_object.seller_id::text IS DISTINCT FROM effect.target->>'sellerId' OR current_object.write_until>clock_timestamp() OR current_object.retain_until>clock_timestamp() OR NOT EXISTS(SELECT 1 FROM treido.personal_seller_owners o JOIN treido.seller_accounts s ON s.id=o.seller_id WHERE o.user_id=effect.user_id AND o.seller_id=current_object.seller_id AND s.kind='personal' AND s.status='restricted') OR EXISTS(SELECT 1 FROM treido.media_assets a JOIN treido.outbox_jobs o ON o.id=a.job_id WHERE a.id=current_object.asset_id AND a.state='processing' AND o.state NOT IN('dead','cancelled','completed')) THEN RAISE EXCEPTION 'Media lifecycle held' USING ERRCODE='55000'; END IF;
  -- Registry tombstone prevents attachment by a late original writer.
  UPDATE treido.media_storage_objects SET state='deleting',deletion_token=t,deletion_until=clock_timestamp()+interval '60 seconds' WHERE storage_scope=current_object.storage_scope AND object_key=current_object.object_key AND state<>'deleted';
  END IF;
 END IF;
 UPDATE treido.account_lifecycle_effects SET state=CASE WHEN first_call THEN 'attempting' ELSE 'unknown' END,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),lease_token=t,lease_until=clock_timestamp()+interval '60 seconds' WHERE id=e;
 RETURN jsonb_build_object('claimed',true,'confirmed',false,'execute',first_call);
END $$;
CREATE FUNCTION treido.account_record_effect(e uuid,t uuid,s text,h text,source_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e FOR UPDATE;
 IF effect.id IS NULL OR effect.lease_token IS DISTINCT FROM t OR effect.lease_until<=clock_timestamp() OR s NOT IN('confirmed','unknown','blocked') OR h !~ '^[0-9a-f]{64}$' OR source_kind NOT IN('provider','database') THEN RAISE EXCEPTION 'Lifecycle receipt lease denied' USING ERRCODE='23514'; END IF;
 INSERT INTO treido.account_effect_observations(effect_id,evidence_hash,state,source) VALUES(e,h,s,source_kind) ON CONFLICT DO NOTHING;
 UPDATE treido.account_lifecycle_effects SET state=s,confirmed_at=CASE WHEN s='confirmed' THEN clock_timestamp() ELSE NULL END,lease_token=NULL,lease_until=NULL WHERE id=e;
 IF effect.kind='media.delete' AND s='confirmed' THEN
  IF effect.target->>'ownerKind'='assistant' THEN PERFORM treido.account_closure_confirm_assistant_object(effect.user_id,effect.plan_id,e,t);
  ELSE UPDATE treido.media_storage_objects SET state='deleted',deleted_at=clock_timestamp(),deletion_token=NULL,deletion_until=NULL WHERE storage_scope=effect.target->>'storageScope' AND object_key=effect.target->>'objectKey' AND deletion_token=t; END IF;
 END IF;
 IF effect.plan_id IS NOT NULL AND s<>'confirmed' THEN UPDATE treido.account_execution_plans SET state=CASE WHEN s='unknown' THEN 'reconciling' ELSE 'blocked' END WHERE id=effect.plan_id; END IF;
END $$;
CREATE FUNCTION treido.account_remove_optional_data(e uuid,t uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects; category text; plan treido.account_execution_plans;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e;
 PERFORM 1 FROM treido.users WHERE id=effect.user_id AND clerk_subject=effect.subject AND status='restricted' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current removal owner denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=effect.plan_id AND user_id=effect.user_id FOR UPDATE;
 IF plan.accepted_at IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') THEN RAISE EXCEPTION 'Current removal plan denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e FOR UPDATE;
 IF effect.kind IS DISTINCT FROM 'data.remove' OR effect.plan_id IS NULL OR effect.lease_token IS DISTINCT FROM t OR effect.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'Optional removal denied' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.account_closure_policies WHERE id=plan.policy_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND payload=plan.payload->'policy' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current removal policy unavailable' USING ERRCODE='55000'; END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings WHERE id=effect.binding_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND closure_enabled AND assistant_lifecycle_version=treido.account_closure_extension_facts(effect.user_id)->>'assistantLifecycleVersion' AND aftercare_lifecycle_version=treido.account_closure_extension_facts(effect.user_id)->>'aftercareLifecycleVersion' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current removal binding unavailable' USING ERRCODE='55000'; END IF;
 PERFORM treido.account_assert_clear(effect.user_id);
 category:=effect.target->>'category';
 IF category='library' THEN
  DELETE FROM treido.buyer_collection_items WHERE user_id=effect.user_id; DELETE FROM treido.buyer_collections WHERE user_id=effect.user_id; DELETE FROM treido.saved_listings WHERE user_id=effect.user_id; DELETE FROM treido.seller_follows WHERE user_id=effect.user_id; DELETE FROM treido.buyer_library_receipts WHERE user_id=effect.user_id;
 ELSIF category='cart' THEN DELETE FROM treido.buyer_cart_lines WHERE user_id=effect.user_id; DELETE FROM treido.buyer_cart_receipts WHERE user_id=effect.user_id;
 ELSIF category='profile' THEN DELETE FROM treido.seller_profiles WHERE seller_id IN(SELECT seller_id FROM treido.personal_seller_owners WHERE user_id=effect.user_id);UPDATE treido.account_lifecycle_workspaces SET locale=NULL,browse_scope=NULL WHERE user_id=effect.user_id;
 ELSIF category='searches' THEN
  DELETE FROM treido.buyer_search_notifications WHERE user_id=effect.user_id; DELETE FROM treido.buyer_search_observations WHERE user_id=effect.user_id; DELETE FROM treido.buyer_saved_search_runs WHERE user_id=effect.user_id; DELETE FROM treido.buyer_saved_search_versions WHERE user_id=effect.user_id; DELETE FROM treido.buyer_saved_search_receipts WHERE user_id=effect.user_id; DELETE FROM treido.buyer_saved_searches WHERE user_id=effect.user_id;
 ELSIF category='assistantMedia' THEN PERFORM treido.account_closure_remove_extension(effect.user_id,effect.plan_id,e,t);
 ELSE RAISE EXCEPTION 'Unsupported optional category' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION treido.account_finish_closure(u uuid,p uuid,j uuid,execution uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE plan treido.account_execution_plans;
BEGIN
 PERFORM 1 FROM treido.users WHERE id=u AND status='restricted' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Closure owner state denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=p AND user_id=u FOR UPDATE;
 IF plan.accepted_at IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') OR EXISTS(SELECT 1 FROM treido.account_lifecycle_effects WHERE plan_id=p AND state<>'confirmed') OR NOT EXISTS(SELECT 1 FROM treido.outbox_jobs o JOIN treido.job_effects f ON f.job_id=o.id WHERE o.id=j AND o.kind='account.closure' AND o.authority='closure' AND o.seller_id IS NULL AND o.buyer_id=u AND o.actor_id IS NULL AND o.resource_id=p AND o.operation_key=plan.acceptance_key AND f.state='running' AND f.execution_token=execution AND f.execution_until>clock_timestamp()) THEN RAISE EXCEPTION 'Closure completion denied' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') AS frozen_target(value) WHERE NOT EXISTS(SELECT 1 FROM treido.account_lifecycle_effects effect WHERE effect.plan_id=p AND effect.kind=frozen_target.value->>'kind' AND effect.target=frozen_target.value->'target' AND effect.state='confirmed')) THEN RAISE EXCEPTION 'Incomplete frozen effects' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.account_closure_policies WHERE id=plan.policy_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND payload=plan.payload->'policy' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current closure policy unavailable' USING ERRCODE='55000'; END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings WHERE id=plan.binding_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND closure_enabled AND assistant_lifecycle_version=treido.account_closure_extension_facts(u)->>'assistantLifecycleVersion' AND aftercare_lifecycle_version=treido.account_closure_extension_facts(u)->>'aftercareLifecycleVersion' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current closure binding unavailable' USING ERRCODE='55000'; END IF;
 PERFORM treido.account_lock_resources(u);PERFORM treido.account_assert_clear(u);
 UPDATE treido.seller_accounts SET status='closed',revision=revision+1 WHERE id IN(SELECT seller_id FROM treido.personal_seller_owners WHERE user_id=u) AND status='restricted';
 UPDATE treido.seller_memberships SET status='revoked',revision=revision+1 WHERE user_id=u AND status='active';
 PERFORM set_config('treido.account_closure_plan',p::text,true);
 UPDATE treido.users SET status='closed' WHERE id=u AND status='restricted';
 PERFORM set_config('treido.account_closure_plan','',true);
 UPDATE treido.account_execution_plans SET state='completed',completed_at=clock_timestamp() WHERE id=p;
END $$;
REVOKE ALL ON FUNCTION treido.account_keep_registry(),treido.account_keep_plan(),treido.account_keep_effect(),treido.account_keep_receipt(),treido.account_record_status(),treido.account_lock_resources(uuid),treido.account_closure_obligations(uuid),treido.account_assert_clear(uuid),treido.account_accept_closure(uuid,uuid,text,uuid),treido.account_cancel_closure(uuid,uuid),treido.account_claim_effect(uuid,uuid,uuid,uuid),treido.account_record_effect(uuid,uuid,text,text,text),treido.account_remove_optional_data(uuid,uuid),treido.account_finish_closure(uuid,uuid,uuid,uuid) FROM PUBLIC;
-- Read-only owner helpers retain transaction-scoped approval/revocation locks.
-- FOR SHARE needs UPDATE privilege; the runtime retains registry SELECT only.
CREATE FUNCTION treido.account_read_approved_binding(target_id uuid) RETURNS SETOF treido.account_lifecycle_bindings LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 RETURN QUERY SELECT b.* FROM treido.account_lifecycle_bindings b
 WHERE b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL AND (target_id IS NULL OR b.id=target_id)
 ORDER BY b.approved_at DESC,b.id DESC LIMIT 1 FOR SHARE OF b;
END $$;
CREATE FUNCTION treido.account_read_approved_policy(target_id uuid) RETURNS SETOF treido.account_closure_policies LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 RETURN QUERY SELECT p.* FROM treido.account_closure_policies p
 WHERE p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL AND (target_id IS NULL OR p.id=target_id)
 ORDER BY p.approved_at DESC,p.id DESC LIMIT 1 FOR SHARE OF p;
END $$;
REVOKE ALL ON FUNCTION treido.account_read_approved_binding(uuid),treido.account_read_approved_policy(uuid) FROM PUBLIC;
-- The caller keeps current actor/accepted-job authority; this reader requires
-- both the original owner and exact plan, and cannot update plan state.
CREATE FUNCTION treido.account_read_closure_plan(target_user uuid,target_plan uuid,exclusive_lock boolean) RETURNS SETOF treido.account_execution_plans LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 IF exclusive_lock IS NULL THEN RAISE EXCEPTION 'Closure plan lock mode required' USING ERRCODE='23514'; END IF;
 IF exclusive_lock THEN
  RETURN QUERY SELECT p.* FROM treido.account_execution_plans p WHERE p.user_id=target_user AND p.id=target_plan FOR UPDATE OF p;
 ELSE
  RETURN QUERY SELECT p.* FROM treido.account_execution_plans p WHERE p.user_id=target_user AND p.id=target_plan FOR SHARE OF p;
 END IF;
END $$;
-- Own active security scope only; preserve the original unresolved target set.
CREATE FUNCTION treido.account_lock_security_effect(target_user uuid,target_subject text,target_hash_value text) RETURNS SETOF treido.account_lifecycle_effects LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 PERFORM 1 FROM treido.users u WHERE u.id=target_user AND u.clerk_subject=target_subject AND u.status='active' FOR SHARE OF u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current security owner denied' USING ERRCODE='23514'; END IF;
 RETURN QUERY SELECT e.* FROM treido.account_lifecycle_effects e WHERE e.user_id=target_user AND e.plan_id IS NULL AND e.kind='session.revoke' AND e.target_hash=target_hash_value AND e.state<>'confirmed' FOR UPDATE OF e;
END $$;
REVOKE ALL ON FUNCTION treido.account_read_closure_plan(uuid,uuid,boolean),treido.account_lock_security_effect(uuid,text,text) FROM PUBLIC;
-- Closure cancels original subscriptions even when their immutable catalogue
-- approval is retired. Original provider/customer authority remains in the
-- effect adapter; preserve this exact own projection and both actual row locks.
CREATE FUNCTION treido.account_read_personal_closure_subscriptions(target_user uuid) RETURNS TABLE(seller_id uuid,subscription_id text,customer_binding_id uuid,catalogue_id uuid,expected_price_id text) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 RETURN QUERY SELECT s.seller_id,s.provider_id,s.customer_binding_id,s.catalogue_id,c.price_id
 FROM treido.billing_subscriptions s JOIN treido.personal_seller_owners o ON o.seller_id=s.seller_id JOIN treido.billing_catalogue c ON c.id=s.catalogue_id AND c.seller_kind='personal'
 WHERE o.user_id=target_user AND s.retired_at IS NULL AND s.state NOT IN('canceled','incomplete_expired')
 ORDER BY s.id LIMIT 11 FOR SHARE OF s,c;
END $$;
REVOKE ALL ON FUNCTION treido.account_read_personal_closure_subscriptions(uuid) FROM PUBLIC;
