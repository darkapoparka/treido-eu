-- No approval, customer, price, provider resource or financial effect is seeded.
ALTER TABLE treido.billing_intents ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE treido.billing_intents ADD COLUMN change_invoice_id text CHECK(change_invoice_id ~ '^in_[A-Za-z0-9]+$');
CREATE FUNCTION treido.guard_billing_recovery_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF OLD.change_invoice_id IS NOT NULL AND NEW.change_invoice_id IS DISTINCT FROM OLD.change_invoice_id
 THEN RAISE EXCEPTION 'Immutable billing change invoice'; END IF;
 NEW.revision:=OLD.revision+CASE WHEN (NEW.state,NEW.provider_id,NEW.result,NEW.change_invoice_id) IS DISTINCT FROM (OLD.state,OLD.provider_id,OLD.result,OLD.change_invoice_id) THEN 1 ELSE 0 END;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_recovery_revision BEFORE UPDATE ON treido.billing_intents FOR EACH ROW EXECUTE FUNCTION treido.guard_billing_recovery_revision();
ALTER TABLE treido.billing_intents ADD CONSTRAINT billing_recovery_scope UNIQUE(id,seller_id);
CREATE TABLE treido.billing_recovery_requests (
 id uuid PRIMARY KEY, intent_id uuid NOT NULL, seller_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES treido.users(id),
 request_id uuid NOT NULL, input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 operation text NOT NULL CHECK(operation IN ('observe','abandon','escalate')),
 expected_revision integer NOT NULL CHECK(expected_revision>=0), invoice_id text CHECK(invoice_id ~ '^in_[A-Za-z0-9]+$'),
 idempotency_key text NOT NULL UNIQUE, state text NOT NULL CHECK(state IN ('creating','reconciling','complete')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(seller_id,actor_id,request_id), FOREIGN KEY(intent_id,seller_id) REFERENCES treido.billing_intents(id,seller_id)
);
CREATE UNIQUE INDEX billing_one_recovery_effect ON treido.billing_recovery_requests(intent_id)
 WHERE operation='abandon' AND state IN ('creating','reconciling');
CREATE FUNCTION treido.guard_billing_recovery_request() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF to_jsonb(NEW)-'state'-'updated_at' IS DISTINCT FROM to_jsonb(OLD)-'state'-'updated_at'
 OR (OLD.state='complete' AND NEW.state IS DISTINCT FROM OLD.state)
 THEN RAISE EXCEPTION 'Immutable billing recovery request'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_recovery_request_guard BEFORE UPDATE ON treido.billing_recovery_requests FOR EACH ROW EXECUTE FUNCTION treido.guard_billing_recovery_request();
REVOKE ALL ON treido.billing_recovery_requests FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.guard_billing_recovery_revision(),treido.guard_billing_recovery_request() FROM PUBLIC;
