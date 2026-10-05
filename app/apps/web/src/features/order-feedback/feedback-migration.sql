-- ORIGINAL UNNUMBERED T64 feedback proposal; no reputation/approval seed.
CREATE TABLE treido.order_feedback_policies(
 id uuid PRIMARY KEY,base_policy_id uuid NOT NULL REFERENCES treido.payment_policies(id),version integer NOT NULL CHECK(version>0),
 eligibility text NOT NULL CHECK(eligibility='completed_paid_no_refund'),moderation text NOT NULL CHECK(moderation='explicit_approved_operator'),
 terms jsonb NOT NULL,terms_hash varchar(64) NOT NULL CHECK(terms_hash~'^[a-f0-9]{64}$'),
 retention_description jsonb NOT NULL CHECK(coalesce(jsonb_typeof(retention_description->'bg')='string' AND jsonb_typeof(retention_description->'en')='string',false)),
 platform_account text NOT NULL CHECK(platform_account~'^acct_[A-Za-z0-9]+$'), livemode boolean NOT NULL, environment text NOT NULL CHECK(environment IN ('development','test','preview','production')), application_id text NOT NULL CHECK(application_id~'^[a-z][a-z0-9-]{1,79}$'), approved_at timestamptz NOT NULL, approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200), revoked_at timestamptz, CHECK(revoked_at IS NULL OR revoked_at>=approved_at), CHECK(coalesce(jsonb_typeof(terms)='object' AND jsonb_typeof(terms->'bg')='string' AND jsonb_typeof(terms->'en')='string' AND length(terms->>'bg') BETWEEN 1 AND 5000 AND length(terms->>'en') BETWEEN 1 AND 5000,false)),UNIQUE(base_policy_id,version)
);
CREATE TABLE treido.order_purchase_feedback(
 id uuid PRIMARY KEY,order_id uuid NOT NULL UNIQUE REFERENCES treido.paid_orders(id),buyer_id uuid NOT NULL REFERENCES treido.users(id),seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
 policy_id uuid NOT NULL REFERENCES treido.order_feedback_policies(id),rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),language text NOT NULL CHECK(language IN ('bg','en')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','published','hidden')),revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),reason text CHECK(length(reason) BETWEEN 1 AND 1000),
 published_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(state<>'published' OR published_at IS NOT NULL)
);
CREATE TABLE treido.order_feedback_events(
 id uuid PRIMARY KEY,feedback_id uuid NOT NULL REFERENCES treido.order_purchase_feedback(id),actor_id uuid NOT NULL REFERENCES treido.users(id),
 action text NOT NULL CHECK(action IN ('submit','publish','hide')),reason text NOT NULL CHECK(length(reason)<=1000),accepted_revision integer NOT NULL CHECK(accepted_revision>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(feedback_id,accepted_revision)
);
CREATE TABLE treido.order_feedback_receipts(
 actor_id uuid NOT NULL REFERENCES treido.users(id),request_id uuid NOT NULL,order_id uuid NOT NULL REFERENCES treido.paid_orders(id),feedback_id uuid NOT NULL REFERENCES treido.order_purchase_feedback(id),
 input_hash varchar(64) NOT NULL CHECK(input_hash~'^[a-f0-9]{64}$'),action text NOT NULL CHECK(action IN ('submit','publish','hide')),accepted_revision integer NOT NULL CHECK(accepted_revision>=0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_id,request_id)
);
CREATE TRIGGER order_feedback_registry_immutable BEFORE UPDATE OR DELETE ON treido.order_feedback_policies FOR EACH ROW EXECUTE FUNCTION treido.guard_order_aftercare_registry();
CREATE INDEX order_feedback_public_scope ON treido.order_purchase_feedback(seller_id,published_at DESC,id DESC) WHERE state='published';
CREATE FUNCTION treido.lock_order_feedback_policy(policy uuid,base uuid,platform text,mode boolean,env text,app text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
BEGIN
 PERFORM id FROM treido.order_feedback_policies WHERE id=policy AND base_policy_id=base AND platform_account=platform AND livemode=mode AND environment=env AND application_id=app AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION treido.lock_order_feedback_policy(uuid,uuid,text,boolean,text,text) FROM PUBLIC;
REVOKE ALL ON treido.order_feedback_policies,treido.order_purchase_feedback,treido.order_feedback_events,treido.order_feedback_receipts FROM PUBLIC;

CREATE FUNCTION treido.order_feedback_eligible(target uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,treido AS $$
 SELECT EXISTS(SELECT 1 FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id JOIN treido.payment_attempts a ON a.id=o.attempt_id AND a.quote_id=q.id WHERE o.id=target AND o.payment_state='paid' AND o.settlement_state='transferred' AND a.state='paid' AND (o.fulfilment_state='collected' OR EXISTS(SELECT 1 FROM treido.order_fulfilments f WHERE f.order_id=o.id AND f.method='shipping' AND f.state='buyer_confirmed_delivery')) AND EXISTS(SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=a.id AND f.kind='charge' AND f.amount_minor=q.total_minor AND f.currency='eur' AND f.platform_account=q.platform_account AND f.livemode=q.livemode) AND NOT EXISTS(SELECT 1 FROM treido.payment_refunds r WHERE r.order_id=o.id) AND NOT EXISTS(SELECT 1 FROM treido.order_refund_intents r WHERE r.order_id=o.id AND r.state<>'expired') AND NOT EXISTS(SELECT 1 FROM treido.order_cases c WHERE c.order_id=o.id AND c.state<>'resolved'))
$$;
CREATE FUNCTION treido.check_order_feedback_original() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF NEW.state<>'pending' OR NEW.revision<>0 OR NEW.published_at IS NOT NULL OR NOT treido.order_feedback_eligible(NEW.order_id) OR NOT EXISTS(SELECT 1 FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id JOIN treido.payment_policies b ON b.id=q.policy_id JOIN treido.order_feedback_policies p ON p.id=NEW.policy_id WHERE o.id=NEW.order_id AND o.buyer_id=NEW.buyer_id AND o.seller_id=NEW.seller_id AND p.base_policy_id=q.policy_id AND p.platform_account=q.platform_account AND p.livemode=q.livemode AND p.environment=b.environment AND p.application_id=b.application_id AND p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL) THEN RAISE EXCEPTION 'Feedback requires actual completed paid order and current explicit policy' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_feedback_original BEFORE INSERT ON treido.order_purchase_feedback FOR EACH ROW EXECUTE FUNCTION treido.check_order_feedback_original();
CREATE FUNCTION treido.moderate_order_feedback(human uuid,target uuid,original uuid,expected integer,decision text,explanation text,hash text,env text,app text,event uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE f treido.order_purchase_feedback%ROWTYPE; receipt treido.order_feedback_receipts%ROWTYPE; allocation uuid;
BEGIN
 IF decision NOT IN ('publish','hide') OR length(explanation) NOT BETWEEN 1 AND 1000 OR hash!~'^[a-f0-9]{64}$' OR expected<0 THEN RAISE EXCEPTION 'Invalid feedback decision' USING ERRCODE='22023'; END IF;
 PERFORM id FROM treido.users WHERE id=human AND status='active' FOR UPDATE; IF NOT FOUND OR NOT treido.lock_order_aftercare_operator(human,'feedback.moderate',env,app) THEN RAISE EXCEPTION 'Current feedback authority required' USING ERRCODE='42501'; END IF;
 SELECT q.allocation_id INTO allocation FROM treido.order_purchase_feedback x JOIN treido.paid_orders o ON o.id=x.order_id JOIN treido.payable_quotes q ON q.id=o.quote_id WHERE x.id=target;
 PERFORM id FROM treido.inventory_allocations WHERE id=allocation FOR UPDATE;
 PERFORM o.id FROM treido.paid_orders o JOIN treido.order_purchase_feedback x ON x.order_id=o.id WHERE x.id=target FOR UPDATE OF o;
 SELECT * INTO f FROM treido.order_purchase_feedback WHERE id=target FOR UPDATE;
 IF f.id IS NULL THEN RAISE EXCEPTION 'Feedback missing' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM treido.order_feedback_receipts WHERE actor_id=human AND request_id=original;
 IF receipt.request_id IS NOT NULL THEN IF receipt.feedback_id<>target OR receipt.input_hash<>hash OR receipt.action<>decision THEN RAISE EXCEPTION 'Original decision differs' USING ERRCODE='23514'; END IF; RETURN receipt.accepted_revision; END IF;
 IF f.revision<>expected THEN RAISE EXCEPTION 'Feedback revision changed' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM treido.order_feedback_policies WHERE id=f.policy_id AND environment=env AND application_id=app AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE) OR decision='publish' AND NOT treido.order_feedback_eligible(f.order_id) THEN RAISE EXCEPTION 'Feedback publication unavailable' USING ERRCODE='23514'; END IF;
 UPDATE treido.order_purchase_feedback SET state=CASE WHEN decision='publish' THEN 'published' ELSE 'hidden' END,revision=revision+1,reason=explanation,published_at=CASE WHEN decision='publish' THEN clock_timestamp() ELSE published_at END,updated_at=clock_timestamp() WHERE id=target;
 INSERT INTO treido.order_feedback_events(id,feedback_id,actor_id,action,reason,accepted_revision) VALUES(event,target,human,decision,explanation,expected+1);
 INSERT INTO treido.order_feedback_receipts(actor_id,request_id,order_id,feedback_id,input_hash,action,accepted_revision) VALUES(human,original,f.order_id,target,hash,decision,expected+1);
 RETURN expected+1;
END $$;
REVOKE ALL ON FUNCTION treido.order_feedback_eligible(uuid),treido.check_order_feedback_original(),treido.moderate_order_feedback(uuid,uuid,uuid,integer,text,text,text,text,text,uuid) FROM PUBLIC;
