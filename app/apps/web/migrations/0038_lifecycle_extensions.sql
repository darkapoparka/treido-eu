-- UNNUMBERED original T63 extension, after reviewed T63/T65 relations.
-- T64 owns canonical aggregation/registration/grants. No runtime EXECUTE is
-- granted for private mutations below; the accepted T65 functions call them.
CREATE FUNCTION treido.assistant_input_closure_facts(u uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,treido AS $$
DECLARE pending bigint; writers bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM treido.users WHERE id=u) THEN RAISE EXCEPTION 'Unknown assistant owner' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO pending FROM treido.assistant_run_reservations WHERE user_id=u AND status IN('reserved','calling','unknown');
 pending:=pending+(SELECT count(*) FROM treido.seller_helper_acceptance_intents WHERE user_id=u);
 SELECT count(*) INTO writers FROM treido.assistant_media_objects WHERE user_id=u AND state<>'deleted' AND (write_until>clock_timestamp() OR retain_until>clock_timestamp() OR state='deleting');
 RETURN jsonb_build_object('assistantRuns',pending+writers,'assistantLifecycleVersion','assistant-input-v1');
END $$;
CREATE FUNCTION treido.account_closure_assistant_targets(u uuid,scope text,v text) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,treido AS $$
DECLARE targets jsonb; n bigint;
BEGIN
 IF v IS DISTINCT FROM 'assistant-input-v1' OR scope IS NULL OR scope !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM treido.users WHERE id=u) THEN RAISE EXCEPTION 'Assistant lifecycle binding unavailable' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM treido.assistant_media_objects WHERE user_id=u AND state<>'deleted' AND storage_scope<>scope) THEN RAISE EXCEPTION 'Assistant scope mismatch' USING ERRCODE='55000'; END IF;
 SELECT count(*) INTO n FROM treido.assistant_media_objects WHERE user_id=u AND state<>'deleted';
 IF n>100 THEN RAISE EXCEPTION 'Assistant target limit' USING ERRCODE='55000'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('ownerKind','assistant','ownerUserId',o.user_id,'storageScope',o.storage_scope,'objectKey',o.object_key,'assetId',o.asset_id) ORDER BY o.storage_scope,o.object_key),'[]'::jsonb) INTO targets
 FROM treido.assistant_media_objects o JOIN treido.assistant_media_assets a ON a.id=o.asset_id AND a.user_id=o.user_id WHERE o.user_id=u AND o.state<>'deleted';
 RETURN targets;
END $$;
CREATE FUNCTION treido.account_closure_claim_assistant_object(u uuid,p uuid,e uuid,t uuid) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects; plan treido.account_execution_plans; current_object treido.assistant_media_objects;
BEGIN
 IF t IS NULL THEN RAISE EXCEPTION 'Missing assistant tombstone token' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.users WHERE id=u AND status='restricted' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assistant closure owner denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=p AND user_id=u FOR UPDATE;
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e AND plan_id=p AND user_id=u FOR UPDATE;
 IF plan.id IS NULL OR effect.id IS NULL OR plan.accepted_at IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') OR effect.kind IS DISTINCT FROM 'media.delete' OR effect.state='confirmed' OR effect.target->>'ownerKind' IS DISTINCT FROM 'assistant' OR effect.target->>'ownerUserId' IS DISTINCT FROM u::text OR effect.due_at>clock_timestamp() OR effect.lease_until>clock_timestamp() OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') item WHERE item->>'kind'='media.delete' AND item->'target'=effect.target) THEN RAISE EXCEPTION 'Frozen assistant target denied' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings b JOIN treido.account_closure_policies c ON c.id=plan.policy_id WHERE b.id=plan.binding_id AND b.id=effect.binding_id AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL AND b.closure_enabled AND b.media_unversioned AND b.assistant_lifecycle_version='assistant-input-v1' AND b.media_scope=effect.target->>'storageScope' AND c.approved_at<=clock_timestamp() AND c.revoked_at IS NULL AND c.payload=plan.payload->'policy' FOR SHARE OF b,c;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'policy'->'rules') rule WHERE rule->>'category'='assistantMedia' AND rule->>'handling'='remove' AND rule->>'trigger'='closure' AND rule->>'delaySeconds' IS NOT NULL AND effect.due_at>=plan.accepted_at+make_interval(secs=>(rule->>'delaySeconds')::integer)) THEN RAISE EXCEPTION 'Assistant handling policy unavailable' USING ERRCODE='55000'; END IF;
 SELECT * INTO current_object FROM treido.assistant_media_objects WHERE user_id=u AND storage_scope=effect.target->>'storageScope' AND object_key=effect.target->>'objectKey' AND asset_id::text=effect.target->>'assetId' FOR UPDATE;
 IF current_object.asset_id IS NULL OR current_object.write_until>clock_timestamp() OR current_object.retain_until>clock_timestamp() OR current_object.deletion_until>clock_timestamp() THEN RAISE EXCEPTION 'Assistant object lease held' USING ERRCODE='55000'; END IF;
 IF current_object.state='deleted' THEN RETURN true; END IF;
 UPDATE treido.assistant_media_assets SET state='cancelled' WHERE id=current_object.asset_id AND user_id=u;
 UPDATE treido.assistant_media_objects SET state='deleting',deletion_token=t,deletion_until=clock_timestamp()+interval '60 seconds' WHERE user_id=u AND storage_scope=current_object.storage_scope AND object_key=current_object.object_key;
 RETURN true;
END $$;
CREATE FUNCTION treido.account_closure_confirm_assistant_object(u uuid,p uuid,e uuid,t uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e AND plan_id=p AND user_id=u AND kind='media.delete' AND state='confirmed' AND confirmed_at IS NOT NULL FOR UPDATE;
 IF t IS NULL OR effect.id IS NULL OR effect.target->>'ownerKind' IS DISTINCT FROM 'assistant' OR effect.target->>'ownerUserId' IS DISTINCT FROM u::text OR NOT EXISTS(SELECT 1 FROM treido.account_effect_observations WHERE effect_id=e AND state='confirmed' AND source='provider') THEN RAISE EXCEPTION 'Assistant deletion observation denied' USING ERRCODE='23514'; END IF;
 UPDATE treido.assistant_media_objects SET state='deleted',deleted_at=clock_timestamp(),deletion_token=NULL,deletion_until=NULL WHERE user_id=u AND storage_scope=effect.target->>'storageScope' AND object_key=effect.target->>'objectKey' AND asset_id::text=effect.target->>'assetId' AND state='deleting' AND deletion_token=t AND deletion_until>clock_timestamp();
 IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM treido.assistant_media_objects WHERE user_id=u AND storage_scope=effect.target->>'storageScope' AND object_key=effect.target->>'objectKey' AND asset_id::text=effect.target->>'assetId' AND state='deleted') THEN RAISE EXCEPTION 'Assistant tombstone lease denied' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION treido.account_closure_remove_extension(u uuid,p uuid,e uuid,t uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects; plan treido.account_execution_plans;
BEGIN
 PERFORM 1 FROM treido.users WHERE id=u AND status='restricted' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assistant removal owner denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=p AND user_id=u FOR UPDATE;
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e AND plan_id=p AND user_id=u FOR UPDATE;
 IF t IS NULL OR plan.id IS NULL OR effect.id IS NULL OR plan.accepted_at IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') OR effect.kind IS DISTINCT FROM 'data.remove' OR effect.state NOT IN('attempting','unknown') OR effect.target<>jsonb_build_object('category','assistantMedia') OR effect.lease_token IS DISTINCT FROM t OR effect.lease_until IS NULL OR effect.lease_until<=clock_timestamp() OR effect.due_at>clock_timestamp() OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') item WHERE item->>'kind'='data.remove' AND item->'target'=effect.target) THEN RAISE EXCEPTION 'Assistant removal acceptance denied' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM treido.assistant_run_reservations WHERE user_id=u AND status IN('reserved','calling','unknown')) OR EXISTS(SELECT 1 FROM treido.assistant_media_objects WHERE user_id=u AND state<>'deleted') OR EXISTS(SELECT 1 FROM treido.seller_helper_acceptance_intents WHERE user_id=u) THEN RAISE EXCEPTION 'Assistant evidence or object held' USING ERRCODE='55000'; END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings b JOIN treido.account_closure_policies c ON c.id=plan.policy_id WHERE b.id=plan.binding_id AND b.id=effect.binding_id AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL AND b.closure_enabled AND b.assistant_lifecycle_version='assistant-input-v1' AND c.approved_at<=clock_timestamp() AND c.revoked_at IS NULL AND c.payload=plan.payload->'policy' FOR SHARE OF b,c;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'policy'->'rules') rule WHERE rule->>'category'='assistantMedia' AND rule->>'handling'='remove' AND rule->>'trigger'='closure' AND rule->>'delaySeconds' IS NOT NULL AND effect.due_at>=plan.accepted_at+make_interval(secs=>(rule->>'delaySeconds')::integer)) THEN RAISE EXCEPTION 'Assistant removal policy unavailable' USING ERRCODE='55000'; END IF;
 UPDATE treido.buyer_assistant_consents SET granted=false,expires_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() WHERE user_id=u AND granted;
 UPDATE treido.assistant_runs SET state='cancelled',input_json=NULL,proposal=NULL,accepted_criteria=NULL WHERE user_id=u;
 UPDATE treido.assistant_media_assets SET state='cancelled' WHERE user_id=u;
 UPDATE treido.buyer_assistant_workspaces SET current_run_id=NULL,current_asset_id=NULL,revision=revision+1 WHERE user_id=u;
 -- Existing personal optional assistant contexts share this accepted removal
 -- category. Business draft context and every accepted helper intent survive.
 DELETE FROM treido.buyer_gift_observations WHERE user_id=u;
 UPDATE treido.buyer_gift_workspaces SET brief=NULL,selected_ids='{}'::uuid[],next_cursor=NULL,updated_at=clock_timestamp(),revision=revision+1 WHERE user_id=u;
 DELETE FROM treido.buyer_compatibility_observations WHERE user_id=u;
 UPDATE treido.buyer_compatibility_workspaces SET requirements=NULL,updated_at=clock_timestamp(),revision=revision+1 WHERE user_id=u;
 DELETE FROM treido.seller_helper_proposals proposal WHERE proposal.user_id=u AND EXISTS(SELECT 1 FROM treido.personal_seller_owners own JOIN treido.seller_accounts seller ON seller.id=own.seller_id AND seller.kind='personal' WHERE own.user_id=u AND own.seller_id=proposal.seller_id);
 -- Immutable minimal accepted spend/reservations/usage/receipts/registered
 -- tombstones survive. No unknown liability or counterpart evidence is erased.
END $$;
REVOKE ALL ON FUNCTION treido.assistant_input_closure_facts(uuid),treido.account_closure_assistant_targets(uuid,text,text),treido.account_closure_claim_assistant_object(uuid,uuid,uuid,uuid),treido.account_closure_confirm_assistant_object(uuid,uuid,uuid,uuid),treido.account_closure_remove_extension(uuid,uuid,uuid,uuid) FROM PUBLIC;

-- UNNUMBERED T64 lifecycle proposal, after the actual T63/T65 relations.
-- No retention, legal-hold, restoration, provider or commercial approval seed.
CREATE TABLE treido.order_aftercare_lifecycle_policies(
 id uuid PRIMARY KEY,version text NOT NULL CHECK(version='order-aftercare-v1'),environment text NOT NULL,application_id text NOT NULL,
 preserves_accepted_evidence boolean NOT NULL CHECK(preserves_accepted_evidence),legal_holds_reviewed boolean NOT NULL CHECK(legal_holds_reviewed),allow_restore_restriction boolean NOT NULL,
 retention_description jsonb NOT NULL CHECK(coalesce(jsonb_typeof(retention_description->'bg')='string' AND jsonb_typeof(retention_description->'en')='string',false)),
 approved_at timestamptz NOT NULL,approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),revoked_at timestamptz,CHECK(revoked_at IS NULL OR revoked_at>=approved_at),UNIQUE(environment,application_id,version)
);
CREATE TABLE treido.order_aftercare_legal_holds(
 id uuid PRIMARY KEY,user_id uuid REFERENCES treido.users(id),order_id uuid REFERENCES treido.paid_orders(id),environment text NOT NULL,application_id text NOT NULL,
 approved_at timestamptz NOT NULL,approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),revoked_at timestamptz,
 CHECK((user_id IS NULL)<>(order_id IS NULL)),CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE TRIGGER order_aftercare_lifecycle_registry_immutable BEFORE UPDATE OR DELETE ON treido.order_aftercare_lifecycle_policies FOR EACH ROW EXECUTE FUNCTION treido.guard_order_aftercare_registry();
CREATE TRIGGER order_aftercare_hold_immutable BEFORE UPDATE OR DELETE ON treido.order_aftercare_legal_holds FOR EACH ROW EXECUTE FUNCTION treido.guard_order_aftercare_registry();
CREATE FUNCTION treido.order_aftercare_closure_facts(u uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,treido AS $$
DECLARE policy treido.order_aftercare_lifecycle_policies%ROWTYPE; n integer; cases bigint; refunds bigint; shipping bigint; holds bigint; restore boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM treido.users WHERE id=u) THEN RAISE EXCEPTION 'Unknown aftercare owner' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO n FROM treido.order_aftercare_lifecycle_policies p WHERE p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL AND p.legal_holds_reviewed AND p.preserves_accepted_evidence AND EXISTS(SELECT 1 FROM treido.account_lifecycle_bindings b WHERE b.environment=p.environment AND b.application_id=p.application_id AND b.aftercare_lifecycle_version=p.version AND b.closure_enabled AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL);
 IF n<>1 THEN RAISE EXCEPTION 'Reviewed aftercare lifecycle unavailable' USING ERRCODE='55000'; END IF;
 SELECT p.* INTO policy FROM treido.order_aftercare_lifecycle_policies p WHERE p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL AND p.legal_holds_reviewed AND p.preserves_accepted_evidence AND EXISTS(SELECT 1 FROM treido.account_lifecycle_bindings b WHERE b.environment=p.environment AND b.application_id=p.application_id AND b.aftercare_lifecycle_version=p.version AND b.closure_enabled AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL);
 WITH owned AS(SELECT seller_id FROM treido.personal_seller_owners WHERE user_id=u UNION SELECT seller_id FROM treido.seller_memberships WHERE user_id=u AND status='active' AND role='owner')
 SELECT (SELECT count(*) FROM treido.order_cases c WHERE (c.buyer_id=u OR c.seller_id IN(SELECT seller_id FROM owned)) AND c.state<>'resolved'),
 (SELECT count(*) FROM treido.order_refund_intents r WHERE (r.buyer_id=u OR r.actor_id=u OR r.seller_id IN(SELECT seller_id FROM owned)) AND r.state<>'expired' AND (r.state<>'succeeded' OR r.settlement_state<>'verified')),
 (SELECT count(*) FROM treido.order_fulfilments f JOIN treido.paid_orders o ON o.id=f.order_id WHERE (o.buyer_id=u OR o.seller_id IN(SELECT seller_id FROM owned)) AND f.method='shipping' AND f.state<>'buyer_confirmed_delivery'),
 (SELECT count(*) FROM treido.order_aftercare_legal_holds h WHERE h.environment=policy.environment AND h.application_id=policy.application_id AND h.approved_at<=clock_timestamp() AND h.revoked_at IS NULL AND (h.user_id=u OR EXISTS(SELECT 1 FROM treido.paid_orders o WHERE o.id=h.order_id AND (o.buyer_id=u OR o.seller_id IN(SELECT seller_id FROM owned))))) INTO cases,refunds,shipping,holds;
 restore:=policy.allow_restore_restriction AND holds=0 AND cases+refunds+shipping=0 AND EXISTS(SELECT 1 FROM treido.users human JOIN LATERAL(SELECT * FROM treido.account_lifecycle_status_events e WHERE e.user_id=human.id ORDER BY e.id DESC LIMIT 1) event ON true JOIN treido.account_execution_plans plan ON plan.id=event.plan_id AND plan.user_id=human.id WHERE human.id=u AND human.status='restricted' AND event.cause='closure_claim' AND event.previous_status='active' AND event.next_status='restricted' AND plan.state IN('accepted','processing','blocked','reconciling') AND plan.first_effect_at IS NULL);
 RETURN jsonb_build_object('aftercareCases',cases+refunds+shipping,'aftercareRefunds',refunds,'unconfirmedShipping',shipping,'legalHolds',holds,'aftercareLifecycleVersion',policy.version,'mayRestoreClosureRestriction',restore);
END $$;
CREATE FUNCTION treido.account_closure_extension_facts(u uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,treido AS $$
DECLARE assistant jsonb; aftercare jsonb;
BEGIN
 assistant:=treido.assistant_input_closure_facts(u);aftercare:=treido.order_aftercare_closure_facts(u);
 IF assistant IS NULL OR aftercare IS NULL OR NOT assistant ?& ARRAY['assistantRuns','assistantLifecycleVersion'] OR NOT aftercare ?& ARRAY['aftercareCases','legalHolds','aftercareLifecycleVersion','mayRestoreClosureRestriction'] OR assistant->>'assistantRuns'!~'^[0-9]+$' OR aftercare->>'aftercareCases'!~'^[0-9]+$' OR aftercare->>'legalHolds'!~'^[0-9]+$' OR jsonb_typeof(aftercare->'mayRestoreClosureRestriction') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Current lifecycle extension unavailable' USING ERRCODE='55000'; END IF;
 RETURN assistant||aftercare;
END $$;
REVOKE ALL ON treido.order_aftercare_lifecycle_policies,treido.order_aftercare_legal_holds FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.order_aftercare_closure_facts(uuid),treido.account_closure_extension_facts(uuid) FROM PUBLIC;
