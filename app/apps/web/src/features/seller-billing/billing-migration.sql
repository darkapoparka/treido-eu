-- Additive proposal. No commercial approval, provider mapping or customer is seeded.
CREATE TABLE treido.billing_catalogue (
 id uuid PRIMARY KEY, plan_id text NOT NULL CHECK(plan_id IN ('personal_pro','business_pro')),
 version integer NOT NULL CHECK(version>0), seller_kind text NOT NULL CHECK(seller_kind IN ('personal','business')),
 platform_account text NOT NULL CHECK(platform_account ~ '^acct_[A-Za-z0-9]+$'), livemode boolean NOT NULL,
 environment text NOT NULL, application_id text NOT NULL, purpose text NOT NULL DEFAULT 'seller_subscription' CHECK(purpose='seller_subscription'),
 product_id text NOT NULL CHECK(product_id ~ '^prod_[A-Za-z0-9]+$'), price_id text NOT NULL CHECK(price_id ~ '^price_[A-Za-z0-9]+$'),
 amount_minor integer NOT NULL CHECK(amount_minor>0), currency text NOT NULL CHECK(currency='EUR'),
 terms jsonb NOT NULL CHECK((jsonb_typeof(terms)='object' AND octet_length(terms::text)<=24000 AND length(btrim(terms->>'bg')) BETWEEN 1 AND 12000 AND length(btrim(terms->>'en')) BETWEEN 1 AND 12000) IS TRUE),
 limits jsonb NOT NULL CHECK(jsonb_typeof(limits)='object'), terms_version text NOT NULL, tax_policy text NOT NULL CHECK(tax_policy='automatic'),
 change_configuration text NOT NULL CHECK(change_configuration ~ '^bpc_[A-Za-z0-9]+$'),
 portal_configuration text NOT NULL CHECK(portal_configuration ~ '^bpc_[A-Za-z0-9]+$'),
 approved_at timestamptz NOT NULL, revoked_at timestamptz,
 UNIQUE(platform_account,livemode,environment,application_id,plan_id,version),
 UNIQUE(platform_account,livemode,environment,application_id,price_id),
 CHECK(plan_id=seller_kind||'_pro'), CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE TABLE treido.billing_customers (
 id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
 platform_account text NOT NULL, livemode boolean NOT NULL, environment text NOT NULL, application_id text NOT NULL,
 purpose text NOT NULL DEFAULT 'seller_subscription' CHECK(purpose='seller_subscription'),
 provider_id text NOT NULL CHECK(provider_id ~ '^cus_[A-Za-z0-9]+$'), approved_at timestamptz NOT NULL, revoked_at timestamptz,
 UNIQUE(seller_id,platform_account,livemode,environment,application_id), UNIQUE(platform_account,livemode,provider_id), UNIQUE(id,seller_id), CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE TABLE treido.billing_intents (
 id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id), actor_id uuid NOT NULL REFERENCES treido.users(id),
 request_id uuid NOT NULL, input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 operation text NOT NULL CHECK(operation IN ('checkout','portal','cancel','preview','change')),
 catalogue_id uuid NOT NULL REFERENCES treido.billing_catalogue(id), customer_binding_id uuid NOT NULL REFERENCES treido.billing_customers(id),
 subscription_id text CHECK(subscription_id ~ '^sub_[A-Za-z0-9]+$'), preview_id uuid REFERENCES treido.billing_intents(id),
 expected_price_id text NOT NULL CHECK(expected_price_id ~ '^price_[A-Za-z0-9]+$'),
 parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object' AND octet_length(parameters::text)<=16000),
 parameter_hash varchar(64) NOT NULL CHECK(parameter_hash ~ '^[a-f0-9]{64}$'), idempotency_key text NOT NULL UNIQUE,
 api_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','creating','reconciling','ready','complete','failed','expired')),
 provider_id text, hosted_url text, result jsonb, first_attempt_at timestamptz, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(seller_id,actor_id,request_id), CHECK(expires_at>created_at),
 CHECK((operation='change')=(preview_id IS NOT NULL)), CHECK(operation='checkout' OR subscription_id IS NOT NULL)
);
CREATE UNIQUE INDEX billing_one_pending_money ON treido.billing_intents(seller_id,customer_binding_id)
 WHERE operation IN ('checkout','change') AND state IN ('prepared','creating','reconciling','ready');
CREATE TABLE treido.billing_subscriptions (
 id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id), customer_binding_id uuid NOT NULL REFERENCES treido.billing_customers(id),
 provider_id text NOT NULL CHECK(provider_id ~ '^sub_[A-Za-z0-9]+$'), origin_intent_id uuid NOT NULL REFERENCES treido.billing_intents(id),
 catalogue_id uuid NOT NULL REFERENCES treido.billing_catalogue(id), item_id text NOT NULL,
 state text NOT NULL, cancel_at_period_end boolean NOT NULL DEFAULT false, period_end timestamptz,
 generation integer NOT NULL DEFAULT 0 CHECK(generation>=0), observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 retired_at timestamptz, UNIQUE(customer_binding_id,provider_id),
 UNIQUE(id,seller_id)
);
CREATE UNIQUE INDEX billing_one_current_subscription ON treido.billing_subscriptions(seller_id,customer_binding_id) WHERE retired_at IS NULL;
CREATE TABLE treido.billing_invoice_observations (
 id uuid PRIMARY KEY, subscription_id uuid NOT NULL REFERENCES treido.billing_subscriptions(id),
 provider_id text NOT NULL CHECK(provider_id ~ '^in_[A-Za-z0-9]+$'), fact_hash varchar(64) NOT NULL,
 status text NOT NULL, amount_minor integer NOT NULL CHECK(amount_minor>=0), currency text NOT NULL CHECK(currency='EUR'),
 hosted_url text, paid boolean NOT NULL, observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(subscription_id,provider_id,fact_hash)
);
CREATE TABLE treido.billing_paid_intervals (
 id uuid PRIMARY KEY, subscription_id uuid NOT NULL REFERENCES treido.billing_subscriptions(id),
 catalogue_id uuid NOT NULL REFERENCES treido.billing_catalogue(id), invoice_id text NOT NULL, line_id text NOT NULL,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, evidence_hash varchar(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK(ends_at>starts_at), UNIQUE(subscription_id,invoice_id,line_id)
);
CREATE TABLE treido.billing_revocations (
 subscription_id uuid NOT NULL REFERENCES treido.billing_subscriptions(id), invoice_id text NOT NULL,
 reason text NOT NULL CHECK(reason IN ('reversed','invalidated')), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(subscription_id,invoice_id)
);
CREATE FUNCTION treido.guard_billing_intent() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
 OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.input_hash IS DISTINCT FROM OLD.input_hash OR NEW.operation IS DISTINCT FROM OLD.operation
 OR NEW.catalogue_id IS DISTINCT FROM OLD.catalogue_id OR NEW.customer_binding_id IS DISTINCT FROM OLD.customer_binding_id
 OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id OR NEW.preview_id IS DISTINCT FROM OLD.preview_id
 OR NEW.expected_price_id IS DISTINCT FROM OLD.expected_price_id OR NEW.parameters IS DISTINCT FROM OLD.parameters OR NEW.parameter_hash IS DISTINCT FROM OLD.parameter_hash OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
 OR NEW.api_version IS DISTINCT FROM OLD.api_version OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
 OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id)
 OR (OLD.hosted_url IS NOT NULL AND NEW.hosted_url IS DISTINCT FROM OLD.hosted_url)
 OR (OLD.result IS NOT NULL AND NEW.result IS DISTINCT FROM OLD.result)
 OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at)
 OR (OLD.state IN ('complete','failed','expired') AND NEW.state IS DISTINCT FROM OLD.state)
 THEN RAISE EXCEPTION 'Immutable billing intent'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_intent_guard BEFORE UPDATE ON treido.billing_intents FOR EACH ROW EXECUTE FUNCTION treido.guard_billing_intent();
CREATE FUNCTION treido.guard_billing_retirement() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.customer_binding_id IS DISTINCT FROM OLD.customer_binding_id
 OR NEW.provider_id IS DISTINCT FROM OLD.provider_id OR NEW.origin_intent_id IS DISTINCT FROM OLD.origin_intent_id
 OR (OLD.retired_at IS NOT NULL AND NEW.retired_at IS DISTINCT FROM OLD.retired_at)
 OR NEW.generation<OLD.generation THEN RAISE EXCEPTION 'Immutable billing subscription identity'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_subscription_guard BEFORE UPDATE ON treido.billing_subscriptions FOR EACH ROW EXECUTE FUNCTION treido.guard_billing_retirement();
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_jobs_kind_check;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_jobs_kind_check CHECK(kind IN ('media.process','system.probe','catalogue.import','team.invitation','payment.reconcile','payment.refund','buyer.saved-search','billing.reconcile','promotion.reconcile'));
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT billing_promotion_service_only CHECK(kind NOT IN ('billing.reconcile','promotion.reconcile') OR authority='service');
REVOKE ALL ON treido.billing_catalogue,treido.billing_customers,treido.billing_intents,treido.billing_subscriptions,treido.billing_invoice_observations,treido.billing_paid_intervals,treido.billing_revocations FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.guard_billing_intent(),treido.guard_billing_retirement() FROM PUBLIC;

CREATE FUNCTION treido.lock_billing_registry(catalogue uuid, customer uuid, seller uuid, platform text, mode boolean, env text, app text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
BEGIN
 PERFORM id FROM treido.billing_customers WHERE id=customer AND seller_id=seller AND platform_account=platform AND livemode=mode AND environment=env AND application_id=app AND purpose='seller_subscription' AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Billing customer unavailable'; END IF;
 IF catalogue IS NOT NULL THEN
 PERFORM id FROM treido.billing_catalogue WHERE id=catalogue AND platform_account=platform AND livemode=mode AND environment=env AND application_id=app AND purpose='seller_subscription' AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Billing catalogue unavailable'; END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION treido.lock_billing_registry(uuid,uuid,uuid,text,boolean,text,text) FROM PUBLIC;

CREATE TABLE treido.billing_sync (customer_binding_id uuid PRIMARY KEY REFERENCES treido.billing_customers(id),seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),generation integer NOT NULL DEFAULT 0 CHECK(generation>=0));
REVOKE ALL ON treido.billing_sync FROM PUBLIC;

CREATE FUNCTION treido.guard_billing_registry_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF to_jsonb(NEW)-'revoked_at' IS DISTINCT FROM to_jsonb(OLD)-'revoked_at' OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN RAISE EXCEPTION 'Immutable billing approval version'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER billing_catalogue_version_guard BEFORE UPDATE ON treido.billing_catalogue FOR EACH ROW EXECUTE FUNCTION treido.guard_billing_registry_version();
CREATE TRIGGER billing_customer_version_guard BEFORE UPDATE ON treido.billing_customers FOR EACH ROW EXECUTE FUNCTION treido.guard_billing_registry_version();
REVOKE ALL ON FUNCTION treido.guard_billing_registry_version() FROM PUBLIC;

ALTER TABLE treido.billing_intents ADD CONSTRAINT billing_intent_customer_scope FOREIGN KEY(customer_binding_id,seller_id) REFERENCES treido.billing_customers(id,seller_id);
ALTER TABLE treido.billing_subscriptions ADD CONSTRAINT billing_subscription_customer_scope FOREIGN KEY(customer_binding_id,seller_id) REFERENCES treido.billing_customers(id,seller_id);
ALTER TABLE treido.billing_sync ADD CONSTRAINT billing_sync_customer_scope FOREIGN KEY(customer_binding_id,seller_id) REFERENCES treido.billing_customers(id,seller_id);

CREATE TABLE treido.billing_payment_links (
 subscription_id uuid NOT NULL REFERENCES treido.billing_subscriptions(id),invoice_id text NOT NULL,charge_id text NOT NULL CHECK(charge_id ~ '^ch_[A-Za-z0-9]+$'),payment_intent_id text CHECK(payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
 PRIMARY KEY(subscription_id,invoice_id,charge_id)
);
CREATE INDEX billing_charge_signal ON treido.billing_payment_links(charge_id);
CREATE INDEX billing_intent_signal ON treido.billing_payment_links(payment_intent_id);
REVOKE ALL ON treido.billing_payment_links FROM PUBLIC;
