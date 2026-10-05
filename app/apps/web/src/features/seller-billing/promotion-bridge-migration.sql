-- Original unnumbered provider bridge proposal. Depends on reviewed promotions storage.
-- No actual provider/customer/policy row is seeded.
CREATE TABLE treido.promotion_payment_bindings (
 id uuid PRIMARY KEY, product_policy_id uuid NOT NULL REFERENCES treido.promotion_products(id),
 platform_account text NOT NULL CHECK(platform_account ~ '^acct_[A-Za-z0-9]+$'), livemode boolean NOT NULL,
 environment text NOT NULL CHECK(environment IN ('development','test','production')), application_id text NOT NULL CHECK(application_id ~ '^[a-z][a-z0-9-]{1,79}$'), purpose text NOT NULL CHECK(purpose='promotion'),
 product_id text NOT NULL CHECK(product_id ~ '^prod_[A-Za-z0-9]+$'), price_id text NOT NULL CHECK(price_id ~ '^price_[A-Za-z0-9]+$'),
 approved_at timestamptz NOT NULL, revoked_at timestamptz,
 UNIQUE(product_policy_id,platform_account,livemode,environment,application_id),
 CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE TABLE treido.promotion_customer_bindings (
 id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
 platform_account text NOT NULL CHECK(platform_account ~ '^acct_[A-Za-z0-9]+$'), livemode boolean NOT NULL, environment text NOT NULL CHECK(environment IN ('development','test','production')), application_id text NOT NULL CHECK(application_id ~ '^[a-z][a-z0-9-]{1,79}$'),
 purpose text NOT NULL CHECK(purpose='promotion'), provider_id text NOT NULL CHECK(provider_id ~ '^cus_[A-Za-z0-9]+$'),
 approved_at timestamptz NOT NULL, revoked_at timestamptz,
 UNIQUE(seller_id,platform_account,livemode,environment,application_id), UNIQUE(platform_account,livemode,provider_id),
 CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE TABLE treido.promotion_checkout_intents (
 attempt_id uuid PRIMARY KEY REFERENCES treido.promotion_attempts(id),
 payment_binding_id uuid NOT NULL REFERENCES treido.promotion_payment_bindings(id), customer_binding_id uuid NOT NULL REFERENCES treido.promotion_customer_bindings(id),
 parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object' AND octet_length(parameters::text)<=16000),
 parameter_hash varchar(64) NOT NULL CHECK(parameter_hash ~ '^[a-f0-9]{64}$'),
 idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 1 AND 255), api_version text NOT NULL CHECK(api_version='2026-09-30.endive'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 first_attempt_at timestamptz, checkout_session_id text CHECK(checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
 CHECK(expires_at>created_at),
 CHECK(first_attempt_at IS NULL OR (first_attempt_at>=created_at AND first_attempt_at<expires_at))
);
CREATE FUNCTION treido.lock_promotion_payment_bindings(payment uuid,customer uuid,policy uuid,seller uuid,platform text,mode boolean,env text,app text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
BEGIN
 PERFORM id FROM treido.promotion_payment_bindings WHERE id=payment AND product_policy_id=policy AND platform_account=platform AND livemode=mode AND environment=env AND application_id=app AND purpose='promotion' AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Promotion payment binding unavailable'; END IF;
 PERFORM id FROM treido.promotion_customer_bindings WHERE id=customer AND seller_id=seller AND platform_account=platform AND livemode=mode AND environment=env AND application_id=app AND purpose='promotion' AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Promotion customer binding unavailable'; END IF;
END $$;
CREATE FUNCTION treido.guard_promotion_checkout_intent() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF to_jsonb(NEW)-'first_attempt_at'-'checkout_session_id' IS DISTINCT FROM to_jsonb(OLD)-'first_attempt_at'-'checkout_session_id'
 OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at)
 OR (OLD.checkout_session_id IS NOT NULL AND NEW.checkout_session_id IS DISTINCT FROM OLD.checkout_session_id)
 THEN RAISE EXCEPTION 'Immutable promotion checkout identity'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER promotion_checkout_intent_guard BEFORE UPDATE ON treido.promotion_checkout_intents FOR EACH ROW EXECUTE FUNCTION treido.guard_promotion_checkout_intent();
CREATE TRIGGER promotion_payment_version_guard BEFORE UPDATE ON treido.promotion_payment_bindings FOR EACH ROW EXECUTE FUNCTION treido.guard_billing_registry_version();
CREATE TRIGGER promotion_customer_version_guard BEFORE UPDATE ON treido.promotion_customer_bindings FOR EACH ROW EXECUTE FUNCTION treido.guard_billing_registry_version();
REVOKE ALL ON treido.promotion_payment_bindings,treido.promotion_customer_bindings,treido.promotion_checkout_intents FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.lock_promotion_payment_bindings(uuid,uuid,uuid,uuid,text,boolean,text,text),treido.guard_promotion_checkout_intent() FROM PUBLIC;
