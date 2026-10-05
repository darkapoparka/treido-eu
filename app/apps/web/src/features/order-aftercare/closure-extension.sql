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
